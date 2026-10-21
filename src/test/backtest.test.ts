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
});
