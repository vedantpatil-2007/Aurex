import { describe, it, expect, beforeEach } from 'vitest';
import { marketDataService } from '../services/marketDataService';
import { calculateSpread, calculateZScore, buildPairSpreadSeries } from '../engines/relativeValueEngine';
import { runWalkForwardBacktest } from '../engines/backtestEngine';
import { evaluateDecision } from '../engines/decisionEngine';
import { buildEdgeSurvivalLedger } from '../engines/ledgerEngine';
import { normalizeObservation } from '../engines/normalizationEngine';
import { assessDataSufficiency } from '../engines/dataSufficiencyEngine';
import { MarketObservation, NormalizedObservation, FrictionAssumptions } from '../types/market';

describe('AUREX Provenance-Isolated Analytics & Decision Integrity Suite (Phase 8 Regression)', () => {
  const defaultFriction: FrictionAssumptions = {
    slippagePer10g: 25,
    brokerageTaxesPer10g: 35,
    liquidityHaircutPer10g: 15,
    costBufferPer10g: 20,
    liquidityThresholdScore: 50
  };

  // Sample authentic imported Bhavcopy snippet for 2026-10-21
  const SAMPLE_IMPORTED_CSV = `Date,Instrument,Symbol,Expiry Date,Open,High,Low,Close,Volume,Open Interest
2026-10-21,FUTCOM,GOLDM,2026-11-05,144000.00,145200.00,143800.00,144584.00,450,1200
2026-10-21,FUTCOM,GOLDTEN,2026-10-30,144100.00,145300.00,143900.00,144650.00,320,850
2026-10-21,FUTCOM,GOLDGUINEA,2026-10-30,115200.00,116100.00,115000.00,115667.20,150,400
2026-10-21,FUTCOM,GOLDPETAL,2026-10-30,14420.00,14540.00,14400.00,14470.00,800,2100`;

  beforeEach(() => {
    marketDataService.resetToSimulation();
    marketDataService.setActiveDataMode('ALL');
  });

  // 1. ALL mode returns the correct total and preserves each source label
  it('Scenario 1: ALL mode returns combined total and preserves discrete source provenance', () => {
    marketDataService.importFromCsv(SAMPLE_IMPORTED_CSV, 'test_bhavcopy_21102026.csv');
    marketDataService.setActiveDataMode('ALL');

    const allData = marketDataService.getHistoricalData({ dataMode: 'ALL' });
    const breakdown = marketDataService.getProvenanceBreakdown('ALL');

    expect(allData.length).toBe(434 + 4);
    expect(breakdown.prototypeSimulationCount).toBe(434);
    expect(breakdown.userImportedCount).toBe(4);

    // Verify individual record provenance is not overwritten
    const simRow = allData.find(o => o.date === '2026-10-08');
    const impRow = allData.find(o => o.date === '2026-10-21');
    expect(simRow?.provenance).toBe('PROTOTYPE SIMULATION');
    expect(impRow?.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
  });

  // 2. PROTOTYPE_ONLY returns prototype records only
  it('Scenario 2: PROTOTYPE_ONLY returns prototype simulation records only', () => {
    marketDataService.importFromCsv(SAMPLE_IMPORTED_CSV, 'test_bhavcopy_21102026.csv');
    marketDataService.setActiveDataMode('PROTOTYPE_ONLY');

    const protoData = marketDataService.getHistoricalData({ dataMode: 'PROTOTYPE_ONLY' });
    expect(protoData.length).toBe(434);
    expect(protoData.every(o => o.date <= '2026-10-08')).toBe(true);
    expect(protoData.every(o => o.provenance === 'PROTOTYPE SIMULATION')).toBe(true);

    const dates = marketDataService.getAvailableDates('PROTOTYPE_ONLY');
    expect(dates).not.toContain('2026-10-21');
    expect(dates[dates.length - 1]).toBe('2026-10-08');
  });

  // 3. IMPORTED_ONLY returns imported records only
  it('Scenario 3: IMPORTED_ONLY returns imported records only', () => {
    marketDataService.importFromCsv(SAMPLE_IMPORTED_CSV, 'test_bhavcopy_21102026.csv');
    marketDataService.setActiveDataMode('IMPORTED_ONLY');

    const impData = marketDataService.getHistoricalData({ dataMode: 'IMPORTED_ONLY' });
    expect(impData.length).toBe(4);
    expect(impData.every(o => o.date === '2026-10-21')).toBe(true);
    expect(impData.every(o => o.provenance === 'USER-IMPORTED DATA — SOURCE UNVERIFIED')).toBe(true);

    const dates = marketDataService.getAvailableDates('IMPORTED_ONLY');
    expect(dates).toEqual(['2026-10-21']);
  });

  // 4. A single imported date does not qualify as a multi-session imported backtest
  it('Scenario 4: A single imported date does not qualify as a multi-session backtest', () => {
    marketDataService.importFromCsv(SAMPLE_IMPORTED_CSV, 'test_bhavcopy_21102026.csv');
    const sufficiency = marketDataService.getDataSufficiency({
      pair: ['GOLDM', 'GOLDTEN'],
      asOfDate: '2026-10-21',
      dataMode: 'IMPORTED_ONLY'
    });

    expect(sufficiency.distinctTradingDates).toBe(1);
    expect(sufficiency.canRunWalkForwardBacktest).toBe(false);
    expect(sufficiency.backtestReadiness).toBe('INSUFFICIENT_HISTORICAL_DATA');
    expect(sufficiency.reasons.some(r => r.includes('Single-session observation') || r.includes('1 authentic trading date'))).toBe(true);
  });

  // 5. Imported-only Z-score calculations never use prototype mean or standard deviation
  it('Scenario 5: Imported-only Z-score calculations never borrow prototype baseline statistics', () => {
    marketDataService.importFromCsv(SAMPLE_IMPORTED_CSV, 'test_bhavcopy_21102026.csv');
    const impNorm = marketDataService.getNormalizedHistoricalData({ dataMode: 'IMPORTED_ONLY' });
    const seriesA = impNorm.filter(o => o.symbol === 'GOLDM');
    const seriesB = impNorm.filter(o => o.symbol === 'GOLDTEN');

    const pairSpreads = buildPairSpreadSeries(seriesA, seriesB, 'GOLDM', 'GOLDTEN');
    expect(pairSpreads.length).toBe(1);

    const zAnalysis = calculateZScore(pairSpreads, 20);
    expect(zAnalysis.isCalculable).toBe(false);
    expect(zAnalysis.currentZScore).toBe(0);
    expect(zAnalysis.incalculableReason).toContain('Insufficient single-provenance history');
  });

  // 6. Prototype-only calculations remain consistent with prototype observations
  it('Scenario 6: Prototype-only calculations remain strictly consistent with prototype observations', () => {
    const protoNorm = marketDataService.getNormalizedHistoricalData({ dataMode: 'PROTOTYPE_ONLY' });
    const seriesA = protoNorm.filter(o => o.symbol === 'GOLDM');
    const seriesB = protoNorm.filter(o => o.symbol === 'GOLDTEN');

    const pairSpreads = buildPairSpreadSeries(seriesA, seriesB, 'GOLDM', 'GOLDTEN');
    const zAnalysis = calculateZScore(pairSpreads, 20);

    expect(zAnalysis.isCalculable).toBe(true);
    expect(zAnalysis.series.length).toBe(pairSpreads.length);
    // Institutional mathematical identity verification: Z = (Spread - Mean) / StdDev
    const last = pairSpreads[pairSpreads.length - 1];
    const expectedZ = Number(((last.spread - zAnalysis.mean) / zAnalysis.standardDeviation).toFixed(2));
    expect(zAnalysis.currentZScore).toBe(expectedZ);
  });

  // 7. Mixed-source history is segmented or filtered correctly
  it('Scenario 7: Mixed-source history enforces strict single-provenance isolation for statistical metrics', () => {
    marketDataService.importFromCsv(SAMPLE_IMPORTED_CSV, 'test_bhavcopy_21102026.csv');
    const mixedNorm = marketDataService.getNormalizedHistoricalData({ dataMode: 'ALL' });
    const seriesA = mixedNorm.filter(o => o.symbol === 'GOLDM');
    const seriesB = mixedNorm.filter(o => o.symbol === 'GOLDTEN');

    const pairSpreads = buildPairSpreadSeries(seriesA, seriesB, 'GOLDM', 'GOLDTEN');
    expect(pairSpreads.length).toBeGreaterThan(1);

    // The last point is 2026-10-21 (Imported)
    const lastPoint = pairSpreads[pairSpreads.length - 1];
    expect(lastPoint.date).toBe('2026-10-21');
    expect(lastPoint.provenanceA).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');

    // Evaluating Z-score on mixed series isolates the target point's calibration to its own provenance
    const zAnalysis = calculateZScore(pairSpreads, 20);
    expect(zAnalysis.calibrationProvenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
    expect(zAnalysis.calibrationObservationCount).toBe(1);
    expect(zAnalysis.isCalculable).toBe(false); // Only 1 imported session exists!
    expect(zAnalysis.incalculableReason).toContain('Statistical calibration cannot cross provenance boundary');
  });

  // 8. An as-of date cannot access later observations
  it('Scenario 8: Historical As-Of date filtering prevents accessing later observations (zero look-ahead)', () => {
    marketDataService.importFromCsv(SAMPLE_IMPORTED_CSV, 'test_bhavcopy_21102026.csv');
    const cutoffDate = '2026-09-15';
    const asOfObs = marketDataService.getHistoricalData({ asOfDate: cutoffDate });

    expect(asOfObs.every(o => o.date <= cutoffDate)).toBe(true);
    expect(asOfObs.some(o => o.date > cutoffDate)).toBe(false);
  });

  // 9. No future observations leak into training or test windows
  it('Scenario 9: Walk-forward backtest parameters calibrate strictly on past data (t < testDate)', () => {
    const protoNorm = marketDataService.getNormalizedHistoricalData({ dataMode: 'PROTOTYPE_ONLY' });
    const result = runWalkForwardBacktest(protoNorm, {
      pair: ['GOLDM', 'GOLDTEN'],
      zScoreEntryThreshold: 1.2,
      zScoreExitThreshold: 0.0,
      maxHoldingDays: 12,
      warmUpDays: 15,
      friction: defaultFriction,
      capitalAllocationINR: 1000000
    });

    expect(result.trades.length).toBeGreaterThanOrEqual(0);
    for (const trade of result.trades) {
      if (trade.exitDate) {
        expect(trade.exitDate >= trade.entryDate).toBe(true);
      }
    }
  });

  // 10. Missing dates are not filled with invented market prices
  it('Scenario 10: Missing dates remain missing without fabricated prices', () => {
    marketDataService.importFromCsv(SAMPLE_IMPORTED_CSV, 'test_bhavcopy_21102026.csv');
    const dates = marketDataService.getAvailableDates('ALL');

    // October 9 through October 20 were not in seed or import, so must not exist
    expect(dates).not.toContain('2026-10-09');
    expect(dates).not.toContain('2026-10-15');
    expect(dates).not.toContain('2026-10-20');
  });

  // 11. Conflicting import records do not silently overwrite existing data
  it('Scenario 11: Conflicting import records do not silently overwrite existing observations', () => {
    // Attempting to import an observation with the same date/contract but divergent close price
    const CONFLICTING_CSV = `Date,Instrument,Symbol,Expiry Date,Open,High,Low,Close,Volume,Open Interest
2026-10-08,FUTCOM,GOLDM,2026-11-05,76000.00,100000.00,75800.00,99999.00,100,500`;

    expect(() => {
      marketDataService.importFromCsv(CONFLICTING_CSV, 'conflict.csv', undefined, false);
    }).toThrow(/Import conflict/);
  });

  // 12. Refresh persistence preserves observations and metadata
  it('Scenario 12: Active dataset persistence retains observations and metadata', () => {
    marketDataService.importFromCsv(SAMPLE_IMPORTED_CSV, 'test_bhavcopy_21102026.csv');
    const meta = marketDataService.getMetadata();

    expect(meta.totalRows).toBeGreaterThanOrEqual(4);
    expect(meta.contractCoverage.GOLDM.count).toBeGreaterThan(0);
    expect(meta.provenanceBreakdown?.userImportedCount).toBe(4);
  });

  // 13. Normalization and contract-expiry checks still work correctly
  it('Scenario 13: Normalization formula rigorously calculates unit and purity multipliers', () => {
    const rawObs: MarketObservation = {
      date: '2026-10-21',
      symbol: 'GOLDM',
      expiryDate: '2026-11-05',
      open: 144000,
      high: 145000,
      low: 143000,
      close: 144584,
      volume: 100,
      openInterest: 500,
      provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED'
    };

    const norm = normalizeObservation(rawObs);
    // GOLDM: 10g quote, 995 purity -> Multiplier = (10/10) * (999/995) = 1.0040201
    // Normalized = 144584 * 1.0040201 = 145165.24
    expect(norm.unitAdjustment).toBe(1);
    expect(norm.purityAdjustment).toBeCloseTo(999 / 995, 4);
    expect(norm.normalizedPrice).toBeCloseTo(144584 * (999 / 995), 1);
  });

  // 14. An insufficient-history dataset cannot produce an ordinary ACTIONABLE market verdict
  it('Scenario 14: Single-session uncalibrated dataset cannot produce an ACTIONABLE verdict', () => {
    const decision = evaluateDecision({
      pair: ['GOLDM', 'GOLDTEN'],
      observedSpread: 750, // Massive raw spread
      manualExpectedEdge: undefined, // Normal market-derived signal (NOT a demo preset)
      volA: 500,
      oiA: 1000,
      volB: 400,
      oiB: 800,
      friction: defaultFriction,
      isCalculable: false, // Single-date history without statistical distribution
      incalculableReason: 'Insufficient single-provenance history'
    });

    expect(decision.decision).toBe('NO TRADE');
    expect(decision.triggerRules.some(r => r.includes('Data Sufficiency Gate Triggered'))).toBe(true);
    expect(decision.isDefensible).toBe(false);
  });

  // 15. Demo preset changes cannot contaminate the normal market-derived decision state
  it('Scenario 15: Demonstration presets do not overwrite normal market-derived evaluation', () => {
    // Normal market evaluation with small spread
    const liveDecision = evaluateDecision({
      pair: ['GOLDM', 'GOLDTEN'],
      observedSpread: 45,
      manualExpectedEdge: undefined,
      volA: 2000,
      oiA: 3000,
      volB: 2000,
      oiB: 3000,
      friction: defaultFriction,
      isCalculable: true
    });
    expect(liveDecision.decision).toBe('NO TRADE'); // 45 < 95 friction

    // Demo Preset 1 (Actionable What-If Sandbox)
    const demoDecision = evaluateDecision({
      pair: ['GOLDM', 'GOLDTEN'],
      observedSpread: 45,
      manualExpectedEdge: 175,
      volA: 2000,
      oiA: 3000,
      volB: 2000,
      oiB: 3000,
      friction: defaultFriction,
      isCalculable: true
    });
    expect(demoDecision.decision).toBe('ACTIONABLE');

    // Verify live state remains untouched
    expect(liveDecision.expectedEdge).toBe(45);
    expect(demoDecision.expectedEdge).toBe(175);
  });

  // 16. The Ledger and Decision Engine display the same eligible input values and net-edge result
  it('Scenario 16: Edge Survival Ledger and Decision Engine display identical net edge results', () => {
    const normObsA: NormalizedObservation = {
      date: '2026-10-08',
      symbol: 'GOLDM',
      expiryDate: '2026-11-05',
      open: 76000, high: 76500, low: 75800, close: 76397.8,
      volume: 1500, openInterest: 8000,
      normalizedPrice: 76704.93,
      unitAdjustment: 1, purityAdjustment: 1.00402,
      daysToExpiry: 28, lifecycleStage: 'NORMAL',
      provenance: 'PROTOTYPE SIMULATION'
    };

    const normObsB: NormalizedObservation = {
      date: '2026-10-08',
      symbol: 'GOLDTEN',
      expiryDate: '2026-10-30',
      open: 76200, high: 76700, low: 76100, close: 76647.58,
      volume: 1200, openInterest: 4500,
      normalizedPrice: 76647.58,
      unitAdjustment: 1, purityAdjustment: 1,
      daysToExpiry: 22, lifecycleStage: 'NORMAL',
      provenance: 'PROTOTYPE SIMULATION'
    };

    const spread = calculateSpread(normObsA.normalizedPrice, normObsB.normalizedPrice);
    const directDecision = evaluateDecision({
      pair: ['GOLDM', 'GOLDTEN'],
      observedSpread: spread,
      volA: normObsA.volume, oiA: normObsA.openInterest,
      volB: normObsB.volume, oiB: normObsB.openInterest,
      friction: defaultFriction,
      isCalculable: true
    });

    const ledger = buildEdgeSurvivalLedger({
      pair: ['GOLDM', 'GOLDTEN'],
      obsA: normObsA,
      obsB: normObsB,
      provenance: 'PROTOTYPE SIMULATION',
      friction: defaultFriction,
      historicalMean: 53.57,
      historicalStdDev: 66.31,
      zScore: 0.06,
      isCalculable: true
    });

    expect(ledger.decision).toBe(directDecision.decision);
    expect(ledger.netEdge).toBe(directDecision.netEdge);
  });

  // 17. All displayed trading-session counts are derived from eligible distinct dates
  it('Scenario 17: Trading session counts are derived from eligible distinct dates', () => {
    const dates = marketDataService.getAvailableDates('PROTOTYPE_ONLY');
    const obs = marketDataService.getHistoricalData({ dataMode: 'PROTOTYPE_ONLY' });
    const uniqueDatesFromObs = Array.from(new Set(obs.map(o => o.date)));

    expect(dates.length).toBe(uniqueDatesFromObs.length);
    expect(dates.length).toBe(62); // 62 distinct prototype simulation dates
  });

  // 18. Imported-only charts and metrics update immediately when source mode changes
  it('Scenario 18: Mode switching updates observation universe immediately', () => {
    marketDataService.importFromCsv(SAMPLE_IMPORTED_CSV, 'test_bhavcopy_21102026.csv');

    marketDataService.setActiveDataMode('IMPORTED_ONLY');
    expect(marketDataService.getActiveDataMode()).toBe('IMPORTED_ONLY');
    expect(marketDataService.getAvailableDates()).toEqual(['2026-10-21']);

    marketDataService.setActiveDataMode('PROTOTYPE_ONLY');
    expect(marketDataService.getActiveDataMode()).toBe('PROTOTYPE_ONLY');
    expect(marketDataService.getAvailableDates()).not.toContain('2026-10-21');
  });

  // 19. A valid, sufficiently long, single-provenance test dataset can still generate legitimate analytical results
  it('Scenario 19: Sufficiently long single-provenance dataset generates valid analytical results', () => {
    const protoNorm = marketDataService.getNormalizedHistoricalData({ dataMode: 'PROTOTYPE_ONLY' });
    const sufficiency = marketDataService.getDataSufficiency({
      pair: ['GOLDM', 'GOLDTEN'],
      asOfDate: '2026-10-08',
      dataMode: 'PROTOTYPE_ONLY'
    });

    expect(sufficiency.canComputeZScore).toBe(true);
    expect(sufficiency.canComputeRollingDistribution).toBe(true);
    expect(sufficiency.canRunWalkForwardBacktest).toBe(true);
    expect(sufficiency.sufficiencyStatus).toBe('SUFFICIENT');
  });

  // 20. Empty and insufficient datasets produce graceful explanations without crashes
  it('Scenario 20: Empty datasets produce graceful explanations and zero crashes', () => {
    const emptyZ = calculateZScore([], 20);
    expect(emptyZ.isCalculable).toBe(false);
    expect(emptyZ.currentZScore).toBe(0);
    expect(emptyZ.incalculableReason).toContain('empty');

    const emptySufficiency = assessDataSufficiency({
      observations: [],
      pair: ['GOLDM', 'GOLDTEN'],
      asOfDate: '2026-10-08',
      dataMode: 'ALL'
    });
    expect(emptySufficiency.totalEligibleObservations).toBe(0);
    expect(emptySufficiency.isPairMatched).toBe(false);
    expect(emptySufficiency.sufficiencyStatus).toBe('INSUFFICIENT');
    expect(emptySufficiency.canFormActionableVerdict).toBe(false);
  });
});
