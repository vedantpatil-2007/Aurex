import { describe, it, expect } from 'vitest';
import { runWalkForwardBacktest } from '../engines/backtestEngine';
import { BacktestParameters, NormalizedObservation } from '../types/market';
import { marketDataService } from '../services/marketDataService';

describe('AUREX Walk-Forward Backtesting Engine', () => {
  const defaultParams: BacktestParameters = {
    pair: ['GOLDM', 'GOLDTEN'],
    zScoreEntryThreshold: 1.2,
    zScoreExitThreshold: 0.0,
    zScoreStopLoss: 2.5,
    maxHoldingDays: 12,
    friction: {
      slippagePer10g: 20,
      brokerageTaxesPer10g: 30,
      liquidityHaircutPer10g: 15,
      costBufferPer10g: 15,
      liquidityThresholdScore: 50
    },
    warmUpDays: 15,
    capitalAllocationINR: 1000000
  };

  it('1. should execute walk-forward backtest and generate complete performance metrics', () => {
    const historicalObs = marketDataService.getNormalizedHistoricalData();
    const result = runWalkForwardBacktest(historicalObs, defaultParams);

    expect(result.dailyEquityCurve.length).toBeGreaterThan(30);
    expect(result.dailyEquityCurve[0].equity).toBe(1000000);
    expect(typeof result.netPnL).toBe('number');
    expect(typeof result.winRatePct).toBe('number');
    expect(typeof result.maxDrawdownINR).toBe('number');
  });

  it('2. should enforce zero look-ahead bias: appending future data does not alter past decisions', () => {
    const allObs = marketDataService.getNormalizedHistoricalData();
    const dates = marketDataService.getAvailableDates();
    const cutoffDate = dates[35]; // ~35 trading days in

    // Dataset A: Observations up to cutoff date
    const obsCutoff = allObs.filter(o => o.date <= cutoffDate);
    const resultA = runWalkForwardBacktest(obsCutoff, defaultParams);

    // Dataset B: Full observations including all future dates beyond cutoff
    const resultB = runWalkForwardBacktest(allObs, defaultParams);

    // Filter trades in resultB that occurred before or on cutoffDate
    const tradesBeforeCutoffInB = resultB.trades.filter(t => t.entryDate <= cutoffDate);

    // The trades opened before or on cutoffDate in resultB MUST match resultA exactly
    // Future data must NOT change the timing, direction, or entry spread of earlier trades!
    expect(tradesBeforeCutoffInB.length).toBe(resultA.trades.length);

    if (resultA.trades.length > 0) {
      expect(tradesBeforeCutoffInB[0].entryDate).toBe(resultA.trades[0].entryDate);
      expect(tradesBeforeCutoffInB[0].direction).toBe(resultA.trades[0].direction);
      expect(tradesBeforeCutoffInB[0].entrySpread).toBe(resultA.trades[0].entrySpread);
    }
  });

  it('3. should deduct transaction friction on both entry and exit legs', () => {
    const historicalObs = marketDataService.getNormalizedHistoricalData();
    const result = runWalkForwardBacktest(historicalObs, defaultParams);

    if (result.completedTrades > 0) {
      const sampleTrade = result.trades.find(t => t.status === 'CLOSED');
      expect(sampleTrade).toBeDefined();
      if (sampleTrade) {
        expect(sampleTrade.entryFriction).toBeGreaterThan(0);
        expect(sampleTrade.exitFriction).toBeGreaterThan(0);
        expect(sampleTrade.totalFriction).toBe(Number((sampleTrade.entryFriction + sampleTrade.exitFriction).toFixed(2)));
        expect(sampleTrade.netPnL).toBe(Number((sampleTrade.grossPnL - sampleTrade.totalFriction).toFixed(2)));
      }
    }
  });

  it('4. should reconcile overall portfolio P&L: Net PnL === Gross PnL - Total Friction', () => {
    const historicalObs = marketDataService.getNormalizedHistoricalData();
    const result = runWalkForwardBacktest(historicalObs, defaultParams);

    const calculatedNet = Number((result.grossPnL - result.totalFrictionCosts).toFixed(2));
    expect(result.netPnL).toBe(calculatedNet);
  });

  it('5. should surface explicit sample size warning and zero trades when dates < warmUpDays', () => {
    // Only 2 distinct trading dates (like current raw imported MCX set)
    const allObs = marketDataService.getNormalizedHistoricalData();
    const dates = marketDataService.getAvailableDates().slice(0, 2);
    const smallObs = allObs.filter(o => dates.includes(o.date));

    const result = runWalkForwardBacktest(smallObs, defaultParams);

    expect(result.totalAvailableDates).toBe(2);
    expect(result.totalCandidateSignals).toBe(0);
    expect(result.acceptedTrades).toBe(0);
    expect(result.completedTrades).toBe(0);
    expect(result.dataSufficiencyWarning).toBeDefined();
    expect(result.dataSufficiencyWarning).toContain('Sample size limitation');
    expect(result.dataSufficiencyWarning).toContain('2 contemporaneous trading session(s)');
    expect(result.executionAssumption).toContain('settlement price fill');
  });

  it('6. should prove zero look-ahead bias: future synthetic price shock does not alter past trades', () => {
    const allObs = marketDataService.getNormalizedHistoricalData();
    const dates = marketDataService.getAvailableDates();
    const cutoffDate = dates[30];

    // Baseline run
    const baselineObs = allObs.filter(o => o.date <= cutoffDate);
    const resultBaseline = runWalkForwardBacktest(baselineObs, defaultParams);

    // Augmented run: append extreme future shock at future dates
    const shockObs: NormalizedObservation[] = [
      ...baselineObs,
      {
        symbol: 'GOLDM',
        date: '2026-12-01',
        expiryDate: '2027-02-05',
        open: 200000,
        high: 250000,
        low: 190000,
        close: 240000,
        volume: 50000,
        openInterest: 100000,
        normalizedPrice: 240963.86,
        unitAdjustment: 1,
        purityAdjustment: 1.004016,
        daysToExpiry: 66,
        lifecycleStage: 'NORMAL'
      },
      {
        symbol: 'GOLDTEN',
        date: '2026-12-01',
        expiryDate: '2027-01-30',
        open: 20000,
        high: 25000,
        low: 15000,
        close: 18000,
        volume: 50000,
        openInterest: 100000,
        normalizedPrice: 18000,
        unitAdjustment: 1,
        purityAdjustment: 1,
        daysToExpiry: 60,
        lifecycleStage: 'NORMAL'
      }
    ];

    const resultShock = runWalkForwardBacktest(shockObs, defaultParams);

    // Compare all trades executed on or before cutoffDate
    const tradesBeforeCutoffInShock = resultShock.trades.filter(t => t.entryDate <= cutoffDate);

    expect(tradesBeforeCutoffInShock.length).toBe(resultBaseline.trades.length);
    if (resultBaseline.trades.length > 0) {
      for (let i = 0; i < resultBaseline.trades.length; i++) {
        expect(tradesBeforeCutoffInShock[i].entryDate).toBe(resultBaseline.trades[i].entryDate);
        expect(tradesBeforeCutoffInShock[i].entrySpread).toBe(resultBaseline.trades[i].entrySpread);
        expect(tradesBeforeCutoffInShock[i].direction).toBe(resultBaseline.trades[i].direction);
      }
    }
  });
});
