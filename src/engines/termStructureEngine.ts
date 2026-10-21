import {
  ContractSymbol,
  NormalizedObservation,
  TermStructurePoint,
  FuturesCurve,
  ConstantMaturityReference,
  RollDownDecomposition
} from '../types/market';

/**
 * Builds an official-standard futures term structure curve for a given contract and trading date.
 * Groups observations by verified discrete expiry, sorted strictly by days to expiry (DTE).
 */
export function buildFuturesCurve(
  observations: NormalizedObservation[],
  date: string,
  symbol: ContractSymbol
): FuturesCurve {
  const matches = observations.filter(o => o.date === date && o.symbol === symbol);

  if (matches.length === 0) {
    return {
      date,
      symbol,
      points: []
    };
  }

  // Deduplicate by expiryDate in case of multiple observations
  const byExpiry = new Map<string, NormalizedObservation>();
  for (const obs of matches) {
    if (!byExpiry.has(obs.expiryDate) || obs.volume > (byExpiry.get(obs.expiryDate)?.volume || 0)) {
      byExpiry.set(obs.expiryDate, obs);
    }
  }

  // Sort strictly ascending by daysToExpiry
  const sorted = Array.from(byExpiry.values()).sort((a, b) => a.daysToExpiry - b.daysToExpiry);

  const points: TermStructurePoint[] = sorted.map((obs, idx) => {
    let adjacentSpread: number | undefined = undefined;
    let adjacentSpreadPct: number | undefined = undefined;

    if (idx > 0) {
      const prev = sorted[idx - 1];
      adjacentSpread = Number((obs.normalizedPrice - prev.normalizedPrice).toFixed(2));
      adjacentSpreadPct = Number(((adjacentSpread / prev.normalizedPrice) * 100).toFixed(4));
    }

    return {
      symbol: obs.symbol,
      expiryDate: obs.expiryDate,
      daysToExpiry: obs.daysToExpiry,
      rawPrice: obs.close,
      normalizedPrice: obs.normalizedPrice,
      volume: obs.volume,
      openInterest: obs.openInterest,
      adjacentSpread,
      adjacentSpreadPct
    };
  });

  const nearPoint = points[0];
  const farPoint = points.length > 1 ? points[points.length - 1] : undefined;

  let spreadNearFar: number | undefined = undefined;
  let spreadNearFarPct: number | undefined = undefined;
  let daysBetweenExpiries: number | undefined = undefined;
  let annualizedSimpleCarry: number | undefined = undefined;
  let annualizedCompoundedCarry: number | undefined = undefined;

  if (nearPoint && farPoint && nearPoint.expiryDate !== farPoint.expiryDate) {
    daysBetweenExpiries = Math.max(1, farPoint.daysToExpiry - nearPoint.daysToExpiry);
    spreadNearFar = Number((farPoint.normalizedPrice - nearPoint.normalizedPrice).toFixed(2));
    spreadNearFarPct = Number(((spreadNearFar / nearPoint.normalizedPrice) * 100).toFixed(4));

    // Annualized simple carry: 100 * ((Far / Near) - 1) * (365 / Î”Days)
    const simpleRatio = (farPoint.normalizedPrice / nearPoint.normalizedPrice) - 1;
    annualizedSimpleCarry = Number((100 * simpleRatio * (365 / daysBetweenExpiries)).toFixed(2));

    // Annualized continuously compounded carry: 100 * (365 / Î”Days) * ln(Far / Near)
    const logRatio = Math.log(farPoint.normalizedPrice / nearPoint.normalizedPrice);
    annualizedCompoundedCarry = Number((100 * (365 / daysBetweenExpiries) * logRatio).toFixed(2));
  }

  return {
    date,
    symbol,
    points,
    nearPoint,
    farPoint,
    spreadNearFar,
    spreadNearFarPct,
    daysBetweenExpiries,
    annualizedSimpleCarry,
    annualizedCompoundedCarry
  };
}

/**
 * Constructs constant-maturity reference price (e.g. 7D, 14D, 30D) via linear interpolation.
 * Strictly adheres to rule: only interpolate within the observed expiry range; do not extrapolate beyond it.
 */
export function interpolateConstantMaturity(
  curve: FuturesCurve,
  tenorDays: number
): ConstantMaturityReference {
  if (!curve.points || curve.points.length < 2) {
    return {
      tenorDays,
      interpolatedPrice: 0,
      isExtrapolated: false,
      status: 'INSUFFICIENT_EXPIRIES'
    };
  }

  const minDte = curve.points[0].daysToExpiry;
  const maxDte = curve.points[curve.points.length - 1].daysToExpiry;

  if (tenorDays < minDte || tenorDays > maxDte) {
    return {
      tenorDays,
      interpolatedPrice: 0,
      isExtrapolated: false,
      status: 'OUT_OF_RANGE'
    };
  }

  // Exact match
  const exact = curve.points.find(p => p.daysToExpiry === tenorDays);
  if (exact) {
    return {
      tenorDays,
      interpolatedPrice: exact.normalizedPrice,
      isExtrapolated: false,
      status: 'VALID'
    };
  }

  // Find bounding points
  let p1 = curve.points[0];
  let p2 = curve.points[1];

  for (let i = 0; i < curve.points.length - 1; i++) {
    if (curve.points[i].daysToExpiry <= tenorDays && curve.points[i + 1].daysToExpiry >= tenorDays) {
      p1 = curve.points[i];
      p2 = curve.points[i + 1];
      break;
    }
  }

  const dteSpan = p2.daysToExpiry - p1.daysToExpiry;
  if (dteSpan === 0) {
    return {
      tenorDays,
      interpolatedPrice: p1.normalizedPrice,
      isExtrapolated: false,
      status: 'VALID'
    };
  }

  const weight = (tenorDays - p1.daysToExpiry) / dteSpan;
  const price = p1.normalizedPrice + weight * (p2.normalizedPrice - p1.normalizedPrice);

  return {
    tenorDays,
    interpolatedPrice: Number(price.toFixed(2)),
    isExtrapolated: false,
    status: 'VALID'
  };
}

/**
 * Decomposes price change into mechanical roll-down (aging along previous curve)
 * and true curve movement (shift of curve at matched constant tenor).
 */
export function decomposeRollDownAndCurveShift(
  curveCurrent: FuturesCurve,
  curvePrevious: FuturesCurve,
  tenorDays = 30,
  daysElapsed = 1
): RollDownDecomposition | null {
  const refCurrent = interpolateConstantMaturity(curveCurrent, tenorDays);
  const refPrevAtTenor = interpolateConstantMaturity(curvePrevious, tenorDays);

  if (refCurrent.status !== 'VALID' || refPrevAtTenor.status !== 'VALID') {
    return null;
  }

  // Total change at fixed constant tenor
  const totalChange = Number((refCurrent.interpolatedPrice - refPrevAtTenor.interpolatedPrice).toFixed(2));

  // Mechanical roll-down: aging from tenorDays to (tenorDays - daysElapsed) on PREVIOUS curve
  const agedTenor = Math.max(1, tenorDays - daysElapsed);
  const refPrevAged = interpolateConstantMaturity(curvePrevious, agedTenor);

  let mechanicalRollDown = 0;
  let curveShift = totalChange;

  if (refPrevAged.status === 'VALID') {
    mechanicalRollDown = Number((refPrevAged.interpolatedPrice - refPrevAtTenor.interpolatedPrice).toFixed(2));
    curveShift = Number((totalChange - mechanicalRollDown).toFixed(2));
  }

  let explanation = '';
  if (Math.abs(mechanicalRollDown) > Math.abs(curveShift)) {
    explanation = `Change is predominantly driven by mechanical roll-down (aging along contango curve by ${daysElapsed} day(s): ₹${mechanicalRollDown}/10g).`;
  } else {
    explanation = `Change is predominantly driven by genuine curve repricing / shift (₹${curveShift}/10g) rather than calendar aging.`;
  }

  return {
    symbol: curveCurrent.symbol,
    tenorDays,
    dateCurrent: curveCurrent.date,
    datePrevious: curvePrevious.date,
    priceCurrent: refCurrent.interpolatedPrice,
    pricePrevious: refPrevAtTenor.interpolatedPrice,
    totalChange,
    mechanicalRollDown,
    curveShift,
    explanation
  };
}
