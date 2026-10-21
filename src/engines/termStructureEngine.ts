import {
  ContractSymbol,
  NormalizedObservation,
  TermStructurePoint,
  FuturesCurve,
  ConstantMaturityReference,
  RollDownDecomposition
} from '../types/market';

/**
 * Calculates simple annualized implied carry:
 * 100 × ((F / S) - 1) × (365 / ΔD)
 */
export function calculateSimpleCarry(nearPrice: number, farPrice: number, deltaDays: number): number | null {
  if (deltaDays <= 0 || !isFinite(nearPrice) || !isFinite(farPrice) || nearPrice <= 0 || farPrice <= 0) {
    return null;
  }
  return Number((100 * ((farPrice / nearPrice) - 1) * (365 / deltaDays)).toFixed(2));
}

/**
 * Calculates continuously compounded annualized implied carry:
 * 100 × ln(F / S) × (365 / ΔD)
 */
export function calculateContinuousCarry(nearPrice: number, farPrice: number, deltaDays: number): number | null {
  if (deltaDays <= 0 || !isFinite(nearPrice) || !isFinite(farPrice) || nearPrice <= 0 || farPrice <= 0) {
    return null;
  }
  return Number((100 * Math.log(farPrice / nearPrice) * (365 / deltaDays)).toFixed(2));
}

/**
 * Calculates annualized geometric compounding carry:
 * 100 × ((F / S)^(365 / ΔD) - 1)
 *
 * NOTE: This represents geometric annualization and is mathematically distinct
 * from continuous compounding (100 × ln(F/S) × 365/ΔD).
 */
export function calculateGeometricCarry(nearPrice: number, farPrice: number, deltaDays: number): number | null {
  if (deltaDays <= 0 || !isFinite(nearPrice) || !isFinite(farPrice) || nearPrice <= 0 || farPrice <= 0) {
    return null;
  }
  return Number((100 * (Math.pow(farPrice / nearPrice, 365 / deltaDays) - 1)).toFixed(2));
}

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
      points: [],
      carryCalculationStatus: 'INSUFFICIENT_EXPIRIES'
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
      adjacentSpreadPct = prev.normalizedPrice > 0
        ? Number(((adjacentSpread / prev.normalizedPrice) * 100).toFixed(4))
        : undefined;
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
  let annualizedContinuousCarry: number | undefined = undefined;
  let annualizedCompoundedCarry: number | undefined = undefined;
  let annualizedGeometricCarry: number | undefined = undefined;
  let carryCalculationStatus: 'VALID' | 'EQUAL_EXPIRIES' | 'INSUFFICIENT_EXPIRIES' | 'INVALID_PRICES' = 'INSUFFICIENT_EXPIRIES';

  if (nearPoint && farPoint && nearPoint.expiryDate !== farPoint.expiryDate) {
    const rawDeltaD = farPoint.daysToExpiry - nearPoint.daysToExpiry;
    const pNear = nearPoint.normalizedPrice;
    const pFar = farPoint.normalizedPrice;

    if (rawDeltaD <= 0) {
      // Inverted or equal expiries: strictly reject rather than substituting 30 days
      carryCalculationStatus = 'EQUAL_EXPIRIES';
    } else if (!isFinite(pNear) || !isFinite(pFar) || pNear <= 0 || pFar <= 0) {
      // Missing, non-finite, zero or negative prices
      carryCalculationStatus = 'INVALID_PRICES';
    } else {
      carryCalculationStatus = 'VALID';
      daysBetweenExpiries = rawDeltaD;
      spreadNearFar = Number((pFar - pNear).toFixed(2));
      spreadNearFarPct = Number(((spreadNearFar / pNear) * 100).toFixed(4));

      // 1. Annualized simple carry: 100 * ((Far / Near) - 1) * (365 / ΔD)
      annualizedSimpleCarry = calculateSimpleCarry(pNear, pFar, daysBetweenExpiries) ?? undefined;

      // 2. Continuously compounded carry: 100 * ln(Far / Near) * (365 / ΔD)
      annualizedContinuousCarry = calculateContinuousCarry(pNear, pFar, daysBetweenExpiries) ?? undefined;
      annualizedCompoundedCarry = annualizedContinuousCarry; // backwards-compatible alias

      // 3. Annualized geometric carry: 100 * ((Far / Near)^(365 / ΔD) - 1)
      annualizedGeometricCarry = calculateGeometricCarry(pNear, pFar, daysBetweenExpiries) ?? undefined;
    }
  } else if (nearPoint && farPoint && nearPoint.expiryDate === farPoint.expiryDate) {
    carryCalculationStatus = 'EQUAL_EXPIRIES';
  } else {
    carryCalculationStatus = 'INSUFFICIENT_EXPIRIES';
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
    annualizedContinuousCarry,
    annualizedCompoundedCarry,
    annualizedGeometricCarry,
    carryCalculationStatus
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
 *
 * Mathematical identity:
 * Total Change = Mechanical Roll-Down + Curve Shift
 * Where:
 * - Mechanical Roll-Down = P_prev(T - Δt) - P_prev(T)  [Aging along prior curve]
 * - Curve Shift = P_curr(T) - P_prev(T - Δt)           [Or Total Change - Roll-Down]
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

  // Both tenors must be within observed range of previous curve
  if (refPrevAged.status !== 'VALID') {
    return null;
  }

  const mechanicalRollDown = Number((refPrevAged.interpolatedPrice - refPrevAtTenor.interpolatedPrice).toFixed(2));
  const curveShift = Number((totalChange - mechanicalRollDown).toFixed(2));

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
