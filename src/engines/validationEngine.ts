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
  // Gate 0 requirement: at least 15 sessions dedicated to in-sample calibration
  const minTrainSize = 15;
  // Calibrated rolling statistics requirement: at least 5 sessions for an out-of-sample test window
  const minTestSize = 5;
  const minTotalPoints = minTrainSize + minTestSize; // Minimum 20 sessions required for valid out-of-sample evaluation

  if (!spreadSeries || spreadSeries.length < minTotalPoints) {
    return [];
  }

  const totalPoints = spreadSeries.length;
  const availableOOS = totalPoints - minTrainSize;
  const windowCount = Math.min(4, Math.floor(availableOOS / minTestSize));

  if (windowCount <= 0) {
    return [];
  }

  const testWindowSize = Math.floor(availableOOS / windowCount);
  const totalFriction = calculateTotalFriction(friction);
  const results: ValidationWindowResult[] = [];

  for (let i = 0; i < windowCount; i++) {
    const testStartIdx = minTrainSize + i * testWindowSize;
    const testEndIdx = (i === windowCount - 1) ? totalPoints - 1 : testStartIdx + testWindowSize - 1;
    const trainStartIdx = 0;
    const trainEndIdx = testStartIdx - 1;

    if (trainEndIdx < minTrainSize - 1 || testEndIdx < testStartIdx) {
      continue;
    }

    const trainSlice = spreadSeries.slice(trainStartIdx, trainEndIdx + 1);
    const testSlice = spreadSeries.slice(testStartIdx, testEndIdx + 1);

    if (testSlice.length < minTestSize || trainSlice.length < minTrainSize) {
      continue;
    }

    // Prevent cross-provenance contamination in walk-forward windows
    const provsInWindow = new Set([...trainSlice, ...testSlice].map(p => p.provenanceA || 'PROTOTYPE SIMULATION'));
    if (provsInWindow.size > 1) {
      continue; // Never allow a walk-forward window to bridge prototype and imported datasets
    }

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

    // Gate 0 Compliance: Only assign ACTIONABLE if dataset has SUFFICIENT statistical sample size (>= 30 sessions)
    if (netEdge > 15 && totalPoints >= 30) {
      decisionTaken = 'ACTIONABLE';
      status = 'STABLE';
    } else if (netEdge > 0) {
      decisionTaken = 'WATCH';
      status = 'MARGINAL';
    } else {
      decisionTaken = 'NO TRADE';
      status = 'REJECTED';
    }

    const windowIndex = results.length + 1;
    results.push({
      windowId: windowIndex,
      windowLabel: `Window ${windowIndex}`,
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
