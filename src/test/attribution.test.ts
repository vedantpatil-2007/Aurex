import { describe, it, expect } from 'vitest';
import {
  buildPerformanceWaterfallBridge,
  verifyAccountingIdentity
} from '../engines/attributionEngine';
import { runWalkForwardBacktest } from '../engines/backtestEngine';
import { marketDataService } from '../services/marketDataService';

describe('AUREX Performance Attribution & Accounting Engine', () => {
  it('1. should verify accounting identity: Net P&L reconciles identically with Gross Alpha - Total Costs', () => {
    const historicalObs = marketDataService.getNormalizedHistoricalData();
    const summary = runWalkForwardBacktest(historicalObs, {
      pair: ['GOLDM', 'GOLDTEN'],
      zScoreEntryThreshold: 1.0,
      zScoreExitThreshold: 0.0,
      maxHoldingDays: 15,
      friction: { slippagePer10g: 20, brokerageTaxesPer10g: 30, liquidityHaircutPer10g: 15, costBufferPer10g: 15, liquidityThresholdScore: 50 },
      warmUpDays: 15,
      capitalAllocationINR: 1000000
    });

    const check = verifyAccountingIdentity(summary);
    expect(check.reconciled).toBe(true);
    expect(check.discrepancy).toBeLessThanOrEqual(0.05);
  });

  it('2. should build itemized gross-to-net waterfall bridge points', () => {
    const historicalObs = marketDataService.getNormalizedHistoricalData();
    const summary = runWalkForwardBacktest(historicalObs, {
      pair: ['GOLDM', 'GOLDTEN'],
      zScoreEntryThreshold: 1.0,
      zScoreExitThreshold: 0.0,
      maxHoldingDays: 15,
      friction: { slippagePer10g: 20, brokerageTaxesPer10g: 30, liquidityHaircutPer10g: 15, costBufferPer10g: 15, liquidityThresholdScore: 50 },
      warmUpDays: 15,
      capitalAllocationINR: 1000000
    });

    const bridge = buildPerformanceWaterfallBridge(summary);
    expect(bridge.length).toBe(6); // Gross, Slippage, Brokerage/Taxes, Haircut, Buffer, Net
    expect(bridge[0].category).toBe('Gross Alpha');
    expect(bridge[bridge.length - 1].category).toBe('Net Realized P&L');
    expect(bridge[bridge.length - 1].cumulative).toBe(summary.netPnL);
  });
});
