import { RelativeValueSpreadPoint, ValidationWindowResult, FrictionAssumptions } from '../types/market';
import { calculateTotalFriction } from './liquidityCostEngine';

/**
 * Walk-Forward Validation Engine
 * 
 * Demonstrates the disciplined quantitative methodology of rolling
 * In-Sample (training / calibration) vs Out-of-Sample (evaluation) windows.
 * 
 * Guards against the quantitative cardinal sin of look-ahead bias and overfitting.
 */
export function generateWalkForwardWindows(
  spreadSeries: RelativeValueSpreadPoint[],
  friction: FrictionAssumptions
): ValidationWindowResult[] {
  if (!spreadSeries || spreadSeries.length < 15) {
    return [];
  }

  const totalPoints = spreadSeries.length;
  const windowCount = 4;
  const testWindowSize = Math.floor(totalPoints / (windowCount + 2));
  const minTrainSize = 10;
  
  const totalFriction = calculateTotalFriction(friction);
  const results: ValidationWindowResult[] = [];

  for (let i = 0; i < windowCount; i++) {
    const testEndIdx = totalPoints - (windowCount - 1 - i) * testWindowSize - 1;
    const testStartIdx = Math.max(minTrainSize, testEndIdx - testWindowSize + 1);
    const trainStartIdx = Math.max(0, testStartIdx - minTrainSize - i * 3);
    const trainEndIdx = testStartIdx - 1;

    if (trainEndIdx <= trainStartIdx || testEndIdx <= testStartIdx) {
      continue;
    }

    const trainSlice = spreadSeries.slice(trainStartIdx, trainEndIdx + 1);
    const testSlice = spreadSeries.slice(testStartIdx, testEndIdx + 1);

    // In-sample baseline calibration
    const inSampleSum = trainSlice.reduce((acc, p) => acc + Math.abs(p.spread), 0);
    const inSampleMeanSpread = Number((inSampleSum / trainSlice.length).toFixed(2));

    // Out-of-sample evaluation
    const testSpreads = testSlice.map(p => Math.abs(p.spread));
    const outOfSampleObservedEdge = Number(
      (testSpreads.reduce((acc, v) => acc + v, 0) / testSpreads.length).toFixed(2)
    );

    const netEdge = Number((outOfSampleObservedEdge - totalFriction).toFixed(2));

    let decisionTaken: 'ACTIONABLE' | 'WATCH' | 'NO TRADE';
    let status: 'STABLE' | 'MARGINAL' | 'REJECTED';

    if (netEdge > 15) {
      decisionTaken = 'ACTIONABLE';
      status = 'STABLE';
    } else if (netEdge > 0) {
      decisionTaken = 'WATCH';
      status = 'MARGINAL';
    } else {
      decisionTaken = 'NO TRADE';
      status = 'REJECTED';
    }

    results.push({
      windowId: i + 1,
      windowLabel: `Window ${i + 1}`,
      trainStartDate: trainSlice[0]?.date || 'N/A',
      trainEndDate: trainSlice[trainSlice.length - 1]?.date || 'N/A',
      testStartDate: testSlice[0]?.date || 'N/A',
      testEndDate: testSlice[testSlice.length - 1]?.date || 'N/A',
      trainObservationsCount: trainSlice.length,
      testObservationsCount: testSlice.length,
      inSampleMeanSpread,
      outOfSampleObservedEdge,
      estimatedFriction: totalFriction,
      netEdge,
      decisionTaken,
      status
    });
  }

  return results;
}
