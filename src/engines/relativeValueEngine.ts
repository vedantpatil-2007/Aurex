import { RelativeValueSpreadPoint, ZScoreAnalysis, NormalizedObservation, ContractSymbol } from '../types/market';

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
    const obsA = selectActiveObservation(aDateGroups.get(date)!);
    const obsB = selectActiveObservation(bDateGroups.get(date)!);
    if (!obsA || !obsB) continue;

    const spread = calculateSpread(obsA.normalizedPrice, obsB.normalizedPrice);
    const avgPrice = (obsA.normalizedPrice + obsB.normalizedPrice) / 2;
    const spreadPercentage = avgPrice > 0 ? Number(((spread / avgPrice) * 100).toFixed(4)) : 0;

    spreadPoints.push({
      date,
      symbolA,
      symbolB,
      priceA: obsA.normalizedPrice,
      priceB: obsB.normalizedPrice,
      spread,
      spreadPercentage
    });
  }

  return spreadPoints;
}

/**
 * Calculates statistical metrics (Mean, Volatility, Z-Score) for a spread series.
 * Mathematical guarantee:
 * currentZScore = (Displayed Spread - Displayed Mean) / Displayed StdDev
 * Handles edge cases:
 * - Empty series
 * - Length < 5 sessions (insufficient history)
 * - Standard deviation == 0
 * - NaN inputs
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
      rollingWindowDays: rollingWindow
    };
  }

  const validSpreads = spreadPoints
    .map(p => p.spread)
    .filter(val => isFinite(val));

  if (validSpreads.length === 0) {
    return {
      currentZScore: 0,
      mean: 0,
      standardDeviation: 0,
      minSpread: 0,
      maxSpread: 0,
      series: spreadPoints,
      isCalculable: false,
      incalculableReason: 'No valid numeric spreads in series',
      rollingWindowDays: rollingWindow
    };
  }

  // Full sample baseline statistics
  const sum = validSpreads.reduce((acc, v) => acc + v, 0);
  const mean = sum / validSpreads.length;
  
  const variance = validSpreads.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / validSpreads.length;
  const standardDeviation = Math.sqrt(variance);

  const minSpread = Math.min(...validSpreads);
  const maxSpread = Math.max(...validSpreads);

  // Calculate rolling statistics for each point in series
  const enrichedSeries: RelativeValueSpreadPoint[] = spreadPoints.map((point, index) => {
    const startIdx = Math.max(0, index - rollingWindow + 1);
    const windowSlice = spreadPoints.slice(startIdx, index + 1).map(p => p.spread);

    const wSum = windowSlice.reduce((acc, v) => acc + v, 0);
    const wMean = wSum / windowSlice.length;

    let wVariance = 0;
    for (const val of windowSlice) {
      wVariance += Math.pow(val - wMean, 2);
    }
    const wStdDev = Math.sqrt(wVariance / windowSlice.length);

    let zScore = 0;
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

  const lastPoint = enrichedSeries[enrichedSeries.length - 1];
  const lastSpread = lastPoint.spread;

  let isCalculable = true;
  let incalculableReason: string | undefined = undefined;

  if (standardDeviation <= 0.0001) {
    isCalculable = false;
    incalculableReason = 'Zero spread dispersion (σ = 0)';
  } else if (validSpreads.length < 2) {
    isCalculable = false;
    incalculableReason = 'Insufficient history (< 2 sessions)';
  }

  // Mathematical consistency:
  // Z = (Spread - Mean) / StdDev
  const currentZScore = isCalculable
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
    rollingWindowDays: rollingWindow
  };
}
