import { RelativeValueSpreadPoint, ZScoreAnalysis, NormalizedObservation, ContractSymbol } from '../types/market';

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

  // Create date lookup for Series B
  const bMap = new Map<string, NormalizedObservation>();
  for (const obs of seriesB) {
    if (obs && obs.date && isFinite(obs.normalizedPrice)) {
      bMap.set(obs.date, obs);
    }
  }

  const spreadPoints: RelativeValueSpreadPoint[] = [];

  for (const obsA of seriesA) {
    if (!obsA || !obsA.date || !isFinite(obsA.normalizedPrice)) continue;

    const obsB = bMap.get(obsA.date);
    if (!obsB) continue; // Skip dates missing from one leg

    const spread = calculateSpread(obsA.normalizedPrice, obsB.normalizedPrice);
    const avgPrice = (obsA.normalizedPrice + obsB.normalizedPrice) / 2;
    const spreadPercentage = avgPrice > 0 ? Number(((spread / avgPrice) * 100).toFixed(4)) : 0;

    spreadPoints.push({
      date: obsA.date,
      symbolA,
      symbolB,
      priceA: obsA.normalizedPrice,
      priceB: obsB.normalizedPrice,
      spread,
      spreadPercentage
    });
  }

  // Sort ascending by date
  spreadPoints.sort((a, b) => a.date.localeCompare(b.date));

  return spreadPoints;
}

/**
 * Calculates statistical metrics (Mean, Volatility, Z-Score) for a spread series.
 * Handles edge cases:
 * - Empty series
 * - Length < 2
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
      series: []
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
      series: spreadPoints
    };
  }

  // Overall statistics
  const sum = validSpreads.reduce((acc, v) => acc + v, 0);
  const mean = sum / validSpreads.length;
  
  const variance = validSpreads.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / validSpreads.length;
  const standardDeviation = Math.sqrt(variance);

  const minSpread = Math.min(...validSpreads);
  const maxSpread = Math.max(...validSpreads);

  // Calculate rolling statistics for each point in series
  const enrichedSeries: RelativeValueSpreadPoint[] = spreadPoints.map((point, index) => {
    // Use up to rollingWindow previous points
    const startIdx = Math.max(0, index - rollingWindow + 1);
    const windowSlice = spreadPoints.slice(startIdx, index + 1).map(p => p.spread);

    const wSum = windowSlice.reduce((acc, v) => acc + v, 0);
    const wMean = wSum / windowSlice.length;

    let wVariance = 0;
    for (const val of windowSlice) {
      wVariance += Math.pow(val - wMean, 2);
    }
    const wStdDev = Math.sqrt(wVariance / windowSlice.length);

    // Guard against zero division
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
  const currentZScore = lastPoint && lastPoint.zScore !== undefined ? lastPoint.zScore : 0;

  return {
    currentZScore: isFinite(currentZScore) ? currentZScore : 0,
    mean: Number(mean.toFixed(2)),
    standardDeviation: Number(standardDeviation.toFixed(2)),
    minSpread: Number(minSpread.toFixed(2)),
    maxSpread: Number(maxSpread.toFixed(2)),
    series: enrichedSeries
  };
}
