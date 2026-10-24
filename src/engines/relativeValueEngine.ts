import { RelativeValueSpreadPoint, ZScoreAnalysis, NormalizedObservation, ContractSymbol, StatisticalStatus } from '../types/market';

/**
 * Selects the active near-month observation for a contract symbol on a specific date:
 * 1. Highest traded volume
 * 2. If volume is zero or equal, nearest expiry with Days to Expiry >= 3 days
 * 3. Fallback: earliest valid expiry date
 */
export function selectActiveObservation(observations: NormalizedObservation[]): NormalizedObservation | undefined {
  if (!observations || observations.length === 0) return undefined;
  if (observations.length === 1) return observations[0];

  const withVol = observations.filter(o => o.volume > 0);
  if (withVol.length > 0) {
    withVol.sort((a, b) => b.volume - a.volume);
    return withVol[0];
  }

  const nonExpired = observations.filter(o => o.daysToExpiry >= 3);
  if (nonExpired.length > 0) {
    nonExpired.sort((a, b) => a.daysToExpiry - b.daysToExpiry);
    return nonExpired[0];
  }

  const sorted = [...observations].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  return sorted[0];
}

/**
 * Authoritatively selects the active near-month observation for a symbol and date
 * using the documented deterministic exchange policy:
 * 1. Filter observations for symbol on exact date
 * 2. Highest traded volume
 * 3. If volume is zero or equal, nearest expiry with Days to Expiry >= 3 days
 * 4. Fallback: earliest valid expiry date
 * 5. If not available on exact date, falls back to most recent historical date <= date
 */
export function getActiveObservation(
  observations: NormalizedObservation[],
  symbol: ContractSymbol,
  date?: string
): NormalizedObservation | undefined {
  if (!observations || observations.length === 0) return undefined;
  const symbolObs = observations.filter(o => o.symbol === symbol);
  if (symbolObs.length === 0) return undefined;

  if (date) {
    const onDate = symbolObs.filter(o => o.date === date);
    if (onDate.length > 0) {
      const imported = onDate.filter(o => o.provenance !== 'PROTOTYPE SIMULATION');
      return selectActiveObservation(imported.length > 0 ? imported : onDate);
    }
    const priorDates = Array.from(new Set(symbolObs.map(o => o.date)))
      .filter(d => d <= date)
      .sort((a, b) => a.localeCompare(b));
    if (priorDates.length > 0) {
      const latestPriorDate = priorDates[priorDates.length - 1];
      const onPriorDate = symbolObs.filter(o => o.date === latestPriorDate);
      const importedPrior = onPriorDate.filter(o => o.provenance !== 'PROTOTYPE SIMULATION');
      return selectActiveObservation(importedPrior.length > 0 ? importedPrior : onPriorDate);
    }
    return undefined;
  }

  const dates = Array.from(new Set(symbolObs.map(o => o.date))).sort((a, b) => a.localeCompare(b));
  const latestDate = dates[dates.length - 1];
  const onLatestDate = symbolObs.filter(o => o.date === latestDate);
  const importedLatest = onLatestDate.filter(o => o.provenance !== 'PROTOTYPE SIMULATION');
  return selectActiveObservation(importedLatest.length > 0 ? importedLatest : onLatestDate);
}

/**
 * Calculates theoretical price spread between two normalized contract series:
 * S_t(i,j) = Price_norm,t(i) - Price_norm,t(j)
 */
export function calculateSpread(priceA: number, priceB: number): number {
  if (!isFinite(priceA) || !isFinite(priceB)) {
    return 0;
  }
  return Number((priceA - priceB).toFixed(2));
}

/**
 * Aligns two observation series by date and calculates the pair spread series.
 * Enforces active near-month contract selection per trading date to prevent multi-expiry distortion.
 */
export function buildPairSpreadSeries(
  seriesA: NormalizedObservation[],
  seriesB: NormalizedObservation[],
  symbolA: ContractSymbol,
  symbolB: ContractSymbol
): RelativeValueSpreadPoint[] {
  if (!seriesA || !seriesB || seriesA.length === 0 || seriesB.length === 0) {
    return [];
  }

  // Group Series A by date
  const aDateGroups = new Map<string, NormalizedObservation[]>();
  for (const obs of seriesA) {
    if (!obs || !obs.date || !isFinite(obs.normalizedPrice)) continue;
    const list = aDateGroups.get(obs.date) || [];
    list.push(obs);
    aDateGroups.set(obs.date, list);
  }

  // Group Series B by date
  const bDateGroups = new Map<string, NormalizedObservation[]>();
  for (const obs of seriesB) {
    if (!obs || !obs.date || !isFinite(obs.normalizedPrice)) continue;
    const list = bDateGroups.get(obs.date) || [];
    list.push(obs);
    bDateGroups.set(obs.date, list);
  }

  const commonDates = Array.from(aDateGroups.keys())
    .filter(d => bDateGroups.has(d))
    .sort((a, b) => a.localeCompare(b));

  const spreadPoints: RelativeValueSpreadPoint[] = [];

  for (const date of commonDates) {
    const aList = aDateGroups.get(date)!;
    const bList = bDateGroups.get(date)!;

    // Strict single-provenance matching per trading date:
    // If both series have user-imported observations on this date, pair them using imported data.
    // Otherwise, pair them using prototype simulation data.
    // Never cross provenance boundaries within the same date.
    const aImported = aList.filter(o => o.provenance !== 'PROTOTYPE SIMULATION');
    const bImported = bList.filter(o => o.provenance !== 'PROTOTYPE SIMULATION');

    const useImported = aImported.length > 0 && bImported.length > 0;
    const obsA = selectActiveObservation(useImported ? aImported : aList);
    const obsB = selectActiveObservation(useImported ? bImported : bList);
    if (!obsA || !obsB) continue;

    const spread = calculateSpread(obsA.normalizedPrice, obsB.normalizedPrice);
    const avgPrice = (obsA.normalizedPrice + obsB.normalizedPrice) / 2;
    const spreadPercentage = avgPrice > 0 ? Number(((spread / avgPrice) * 100).toFixed(4)) : 0;
    const provA = obsA.provenance || 'PROTOTYPE SIMULATION';
    const provB = obsB.provenance || 'PROTOTYPE SIMULATION';
    const isCrossBoundary = spreadPoints.length > 0 && spreadPoints[spreadPoints.length - 1].provenanceA !== provA;

    spreadPoints.push({
      date,
      symbolA,
      symbolB,
      priceA: obsA.normalizedPrice,
      priceB: obsB.normalizedPrice,
      expiryA: obsA.expiryDate,
      expiryB: obsB.expiryDate,
      spread,
      spreadPercentage,
      provenanceA: provA,
      provenanceB: provB,
      isCrossProvenanceBoundary: isCrossBoundary
    });
  }

  return spreadPoints;
}

/**
 * Calculates statistical metrics (Mean, Volatility, Z-Score) for a spread series.
 * Mathematical guarantee:
 * currentZScore = (Displayed Spread - Displayed Mean) / Displayed StdDev
 *
 * Strict Provenance Isolation Rule:
 * Statistical parameters (mean, standard deviation, Z-score) are strictly calibrated
 * using observations sharing the same provenance segment as the target point.
 * Prototype observations NEVER serve as the statistical baseline for user-imported observations.
 */
export function calculateZScore(
  spreadPoints: RelativeValueSpreadPoint[],
  rollingWindow = 20
): ZScoreAnalysis {
  if (!spreadPoints || spreadPoints.length === 0) {
    return {
      currentZScore: 0,
      mean: 0,
      standardDeviation: 0,
      minSpread: 0,
      maxSpread: 0,
      series: [],
      isCalculable: false,
      incalculableReason: 'Spread series is empty',
      statisticalStatus: 'DATA_UNAVAILABLE',
      rollingWindowDays: rollingWindow
    };
  }

  const lastPoint = spreadPoints[spreadPoints.length - 1];
  const targetProv = lastPoint.provenanceA || 'PROTOTYPE SIMULATION';

  // Strict provenance isolation: only calibrate from observations sharing target provenance
  const eligiblePoints = spreadPoints.filter(
    p => (p.provenanceA || 'PROTOTYPE SIMULATION') === targetProv
  );
  const eligibleSpreads = eligiblePoints
    .map(p => p.spread)
    .filter(val => isFinite(val));

  // Determine calculability based on isolated single-provenance history
  let isCalculable = true;
  let incalculableReason: string | undefined = undefined;
  let statisticalStatus: StatisticalStatus = 'CALCULABLE';

  if (eligibleSpreads.length < 5) {
    isCalculable = false;
    statisticalStatus = 'INSUFFICIENT_HISTORY';
    incalculableReason = targetProv === 'PROTOTYPE SIMULATION'
      ? 'Insufficient history (< 5 sessions for calibrated rolling statistics)'
      : `Insufficient single-provenance history (${eligibleSpreads.length} session${eligibleSpreads.length === 1 ? '' : 's'} available, minimum 5 required for calibrated rolling statistics). Statistical calibration cannot cross provenance boundary into prototype simulation.`;
  }

  // Calculate isolated baseline statistics
  const sum = eligibleSpreads.reduce((acc, v) => acc + v, 0);
  const mean = eligibleSpreads.length > 0 ? sum / eligibleSpreads.length : 0;

  let variance = 0;
  if (eligibleSpreads.length >= 2) {
    variance = eligibleSpreads.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / eligibleSpreads.length;
  }
  const standardDeviation = Math.sqrt(variance);

  if (isCalculable && standardDeviation <= 0.0001) {
    isCalculable = false;
    statisticalStatus = 'ZERO_VARIANCE';
    incalculableReason = 'Zero spread dispersion (σ = 0)';
  }

  const minSpread = eligibleSpreads.length > 0 ? Math.min(...eligibleSpreads) : 0;
  const maxSpread = eligibleSpreads.length > 0 ? Math.max(...eligibleSpreads) : 0;

  // Calculate rolling statistics for each point in series, segmented by provenance
  const enrichedSeries: RelativeValueSpreadPoint[] = spreadPoints.map((point, index) => {
    const ptProv = point.provenanceA || 'PROTOTYPE SIMULATION';
    // Isolate rolling slice strictly to prior observations of the same provenance
    const singleProvHistory = spreadPoints
      .slice(0, index + 1)
      .filter(p => (p.provenanceA || 'PROTOTYPE SIMULATION') === ptProv);

    const windowSlice = singleProvHistory.slice(-rollingWindow).map(p => p.spread);

    if (windowSlice.length < 5) {
      return {
        ...point,
        zScore: undefined,
        meanSpread: undefined,
        stdDevSpread: undefined
      };
    }

    const wSum = windowSlice.reduce((acc, v) => acc + v, 0);
    const wMean = wSum / windowSlice.length;

    let wVariance = 0;
    for (const val of windowSlice) {
      wVariance += Math.pow(val - wMean, 2);
    }
    const wStdDev = Math.sqrt(wVariance / windowSlice.length);

    let zScore: number | undefined = undefined;
    if (wStdDev > 0.0001) {
      zScore = Number(((point.spread - wMean) / wStdDev).toFixed(2));
    }

    return {
      ...point,
      zScore,
      meanSpread: Number(wMean.toFixed(2)),
      stdDevSpread: Number(wStdDev.toFixed(2))
    };
  });

  const lastSpread = lastPoint.spread;

  // Institutional Z-Score formula: Z = (Spread - Mean) / StdDev
  const currentZScore = isCalculable && standardDeviation > 0.0001
    ? Number(((lastSpread - mean) / standardDeviation).toFixed(2))
    : 0;

  return {
    currentZScore: isFinite(currentZScore) ? currentZScore : 0,
    mean: Number(mean.toFixed(2)),
    standardDeviation: Number(standardDeviation.toFixed(2)),
    minSpread: Number(minSpread.toFixed(2)),
    maxSpread: Number(maxSpread.toFixed(2)),
    series: enrichedSeries,
    isCalculable,
    incalculableReason,
    statisticalStatus,
    rollingWindowDays: rollingWindow,
    calibrationObservationCount: eligibleSpreads.length,
    calibrationProvenance: targetProv
  };
}
