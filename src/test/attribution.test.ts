import { describe, it, expect } from 'vitest';
import {
  buildPerformanceWaterfallBridge,
  verifyAccountingIdentity,
  decomposeTradeAttribution
} from '../engines/attributionEngine';
import { runWalkForwardBacktest } from '../engines/backtestEngine';
import { marketDataService } from '../services/marketDataService';

describe('AUREX Performance Attribution & Accounting Engine', () => {
  it('1. should verify backtest accounting identity: Net P&L reconciles identically with Gross P&L − Total Frictions', () => {
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

    // Verify all executed trades have exact leg-level derivation
    for (const trade of summary.trades) {
      if (trade.status === 'CLOSED' && trade.legAPnL !== undefined && trade.legBPnL !== undefined) {
        const derivedGross = Number((trade.legAPnL + trade.legBPnL).toFixed(2));
        expect(Math.abs(trade.grossPnL - derivedGross)).toBeLessThanOrEqual(0.01);
        const derivedNet = Number((trade.grossPnL - trade.totalFriction).toFixed(2));
        expect(Math.abs(trade.netPnL - derivedNet)).toBeLessThanOrEqual(0.01);
      }
    }
  });

  it('2. should build itemized gross-to-net waterfall bridge points with non-misleading labels', () => {
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
    expect(bridge.length).toBe(6); // Gross Realized Spread P&L, Slippage, Brokerage/Taxes, Haircut, Buffer, Net
    expect(bridge[0].category).toBe('Gross Realized Spread P&L');
    expect(bridge[bridge.length - 1].category).toBe('Net Realized P&L');
    expect(bridge[bridge.length - 1].cumulative).toBe(summary.netPnL);
  });

  it('3. should decouple market beta from alpha when gold price rises but spread moves adversely against trade', () => {
    // Scenario: Gold benchmark moves UP by ₹950/10g, but Leg A gains less than Leg B.
    // Long Spread: Long Leg A, Short Leg B
    // Leg A: enters at 74000, exits at 74800 (+800 gain)
    // Leg B: enters at 74050, exits at 75150 (+1100 gain)
    // Units: 10 units of 10g (100g physical exposure on each leg)
    // Total Friction: ₹500
    const attr = decomposeTradeAttribution(
      'LONG_SPREAD',
      10, // units A
      10, // units B
      74000, // entry A
      74800, // exit A
      74050, // entry B
      75150, // exit B
      500    // total friction
    );

    // Leg A Gross P&L: +10 * (74800 - 74000) = +₹8,000
    expect(attr.legAPnL).toBe(8000);
    // Leg B Gross P&L: -10 * (75150 - 74050) = -₹11,000
    expect(attr.legBPnL).toBe(-11000);

    // Gross P&L: 8000 + (-11000) = -₹3,000
    expect(attr.grossPnL).toBe(-3000);
    // Net P&L: -3000 - 500 = -₹3,500
    expect(attr.netPnL).toBe(-3500);

    // Directional Market Beta is ZERO because exposures are perfectly matched (10 long vs 10 short)
    expect(attr.goldMarketBetaPnL).toBe(0);
    // Relative-Value Alpha captures the spread loss of -₹3,000
    expect(attr.relativeValueAlphaPnL).toBe(-3000);
    expect(attr.residualPnL).toBe(0);
    expect(attr.reconciled).toBe(true);
  });

  it('4. should decouple market beta from alpha when gold price crashes but relative spread converges profitably', () => {
    // Scenario: Gold market drops by ~₹1400/10g, but spread converges profitably.
    // Long Spread: Long Leg A, Short Leg B
    // Leg A: enters at 75000, exits at 73800 (-1200 drop)
    // Leg B: enters at 75100, exits at 73500 (-1600 drop)
    // Units: 10 units of 10g (100g exposure)
    // Total Friction: ₹400
    const attr = decomposeTradeAttribution(
      'LONG_SPREAD',
      10,
      10,
      75000,
      73800,
      75100,
      73500,
      400
    );

    // Leg A Gross P&L: +10 * (73800 - 75000) = -₹12,000
    expect(attr.legAPnL).toBe(-12000);
    // Leg B Gross P&L: -10 * (73500 - 75100) = +₹16,000
    expect(attr.legBPnL).toBe(16000);

    // Gross P&L: -12000 + 16000 = +₹4,000 (profitable spread convergence!)
    expect(attr.grossPnL).toBe(4000);
    // Net P&L: 4000 - 400 = +₹3,600
    expect(attr.netPnL).toBe(3600);

    // Beta is zero (matched hedge)
    expect(attr.goldMarketBetaPnL).toBe(0);
    // Pure relative-value alpha is +₹4,000
    expect(attr.relativeValueAlphaPnL).toBe(4000);
    expect(attr.reconciled).toBe(true);
  });

  it('5. should isolate non-zero market beta when leg quantities are asymmetric', () => {
    // Scenario: Imperfect hedge / mismatched lot sizes
    // Long 12 units Leg A, Short 10 units Leg B (net +2 units long exposure)
    // Both contracts rise uniformly by ₹1,000/10g (no spread change: P_A +1000, P_B +1000)
    // Total Friction: ₹300
    const attr = decomposeTradeAttribution(
      'LONG_SPREAD',
      12, // Long 12 units
      10, // Short 10 units
      74000,
      75000, // +1000
      74000,
      75000, // +1000
      300
    );

    // Leg A P&L: +12 * 1000 = +₹12,000
    expect(attr.legAPnL).toBe(12000);
    // Leg B P&L: -10 * 1000 = -₹10,000
    expect(attr.legBPnL).toBe(-10000);

    // Gross P&L: 12000 - 10000 = +₹2,000
    expect(attr.grossPnL).toBe(2000);

    // Net directional exposure is +2 units.
    // Gold market shift is +1000.
    // Therefore, Market Beta P&L = +2 * 1000 = +₹2,000!
    expect(attr.goldMarketBetaPnL).toBe(2000);
    // Pure Spread Alpha is ZERO (spread did not change: 75000 - 75000 === 74000 - 74000)
    expect(attr.relativeValueAlphaPnL).toBe(0);

    // Net P&L: 2000 - 300 = +₹1,700
    expect(attr.netPnL).toBe(1700);
    expect(attr.residualPnL).toBe(0);
    expect(attr.reconciled).toBe(true);
  });

  it('6. should ensure transaction friction costs are counted once and only once across entry and exit', () => {
    // Standard 100g physical gold exposure (10 units of 10g)
    const frictionPer10g = 45; // slippage + brokerage per 10g leg
    const unitsOf10g = 10;

    const entryFriction = Number((frictionPer10g * unitsOf10g).toFixed(2)); // ₹450
    const exitFriction = Number((frictionPer10g * unitsOf10g).toFixed(2));  // ₹450
    const totalFriction = Number((entryFriction + exitFriction).toFixed(2)); // ₹900

    expect(entryFriction).toBe(450);
    expect(exitFriction).toBe(450);
    expect(totalFriction).toBe(900);

    // Verify reconciliation in trade attribution
    const attr = decomposeTradeAttribution(
      'LONG_SPREAD',
      10,
      10,
      74000,
      74200, // +200 on A
      74000,
      74100, // +100 on B
      totalFriction
    );

    // Gross: (200 - 100) * 10 = +₹1,000
    expect(attr.grossPnL).toBe(1000);
    // Net: 1000 - 900 = +₹100
    expect(attr.netPnL).toBe(100);
    expect(attr.reconciled).toBe(true);
  });
});
