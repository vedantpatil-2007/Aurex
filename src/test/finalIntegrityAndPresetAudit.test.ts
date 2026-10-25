import { describe, it, expect } from 'vitest';
import { evaluateDecision } from '../engines/decisionEngine';
import {
  calculateZScore,
  buildPairSpreadSeries,
  selectMatchedPairObservations
} from '../engines/relativeValueEngine';
import { verifyAccountingIdentity, decomposeTradeAttribution } from '../engines/attributionEngine';
import { FrictionAssumptions, NormalizedObservation, RelativeValueSpreadPoint } from '../types/market';

describe('AUREX — Final Cross-Module Bug Repair & Integrity Test Suite', () => {
  const defaultFriction: FrictionAssumptions = {
    slippagePer10g: 25,
    brokerageTaxesPer10g: 35,
    liquidityHaircutPer10g: 15,
    costBufferPer10g: 20,
    liquidityThresholdScore: 50
  };

  // --------------------------------------------------------------------------
  // 1. Scenario Presets & Reset Behavior
  // --------------------------------------------------------------------------
  describe('1. Scenario Presets & Reset Behavior', () => {
    it('evaluates Preset 1 (Actionable) with positive net edge and passing liquidity', () => {
      const p1 = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 175,
        manualExpectedEdge: 175,
        volA: 26000,
        oiA: 50700,
        volB: 11500,
        oiB: 27900,
        friction: {
          slippagePer10g: 20,
          brokerageTaxesPer10g: 30,
          liquidityHaircutPer10g: 10,
          costBufferPer10g: 15,
          liquidityThresholdScore: 45
        }
      });

      expect(p1.decision).toBe('ACTIONABLE');
      expect(p1.netEdge).toBe(100); // 175 - 75
      expect(p1.liquidityGrade).toBe('PASS');
      expect(p1.triggerRules.some(r => r.includes('Rule 4 Triggered'))).toBe(true);
    });

    it('evaluates Preset 2 (Watch - Borderline Liq) honestly to WATCH using simulated borderline score', () => {
      const p2 = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 135,
        manualExpectedEdge: 135,
        simulatedLiquidityScore: 35, // Simulated borderline depth (30 <= 35 < 40)
        volA: 26000,
        oiA: 50700,
        volB: 11500,
        oiB: 27900,
        friction: {
          slippagePer10g: 22,
          brokerageTaxesPer10g: 30,
          liquidityHaircutPer10g: 15,
          costBufferPer10g: 15,
          liquidityThresholdScore: 40
        }
      });

      expect(p2.decision).toBe('WATCH');
      expect(p2.netEdge).toBe(53); // 135 - 82
      expect(p2.liquidityScore).toBe(35);
      expect(p2.liquidityGrade).toBe('BORDERLINE');
      expect(p2.rationale).toContain('liquidity is near the configured threshold');
      expect(p2.triggerRules.some(r => r.includes('Simulation Sandbox'))).toBe(true);
    });

    it('evaluates Preset 3 (No Trade - Hurdle Fails) to NO TRADE due to cost deficit', () => {
      const p3 = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 50,
        manualExpectedEdge: 50,
        volA: 26000,
        oiA: 50700,
        volB: 11500,
        oiB: 27900,
        friction: {
          slippagePer10g: 35,
          brokerageTaxesPer10g: 35,
          liquidityHaircutPer10g: 20,
          costBufferPer10g: 25,
          liquidityThresholdScore: 50
        }
      });

      expect(p3.decision).toBe('NO TRADE');
      expect(p3.netEdge).toBe(-65); // 50 - 115
      expect(p3.rationale).toContain('Theoretical opportunity does not survive estimated execution friction');
      expect(p3.triggerRules.some(r => r.includes('Rule 2 Triggered'))).toBe(true);
    });

    it('clears simulated liquidity override when switching from Preset 2 to Preset 1 or resetting', () => {
      // With simulated liquidity override (Preset 2)
      const p2 = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 135,
        manualExpectedEdge: 135,
        simulatedLiquidityScore: 35,
        volA: 26000, oiA: 50700, volB: 11500, oiB: 27900,
        friction: { slippagePer10g: 22, brokerageTaxesPer10g: 30, liquidityHaircutPer10g: 15, costBufferPer10g: 15, liquidityThresholdScore: 40 }
      });
      expect(p2.liquidityGrade).toBe('BORDERLINE');

      // Switched to Preset 1: simulatedLiquidityScore is undefined -> returns to measured volume
      const p1 = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 175,
        manualExpectedEdge: 175,
        simulatedLiquidityScore: undefined,
        volA: 26000, oiA: 50700, volB: 11500, oiB: 27900,
        friction: { slippagePer10g: 20, brokerageTaxesPer10g: 30, liquidityHaircutPer10g: 10, costBufferPer10g: 15, liquidityThresholdScore: 45 }
      });
      expect(p1.liquidityGrade).toBe('PASS');
      expect(p1.liquidityScore).toBe(100);

      // Reset to dataset spread and default friction
      const resetResult = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 150,
        manualExpectedEdge: undefined,
        simulatedLiquidityScore: undefined,
        volA: 26000, oiA: 50700, volB: 11500, oiB: 27900,
        friction: defaultFriction,
        isCalculable: true
      });
      expect(resetResult.expectedEdge).toBe(150);
      expect(resetResult.totalFriction).toBe(95);
      expect(resetResult.netEdge).toBe(55);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Unverified Imported Data Decision Gate
  // --------------------------------------------------------------------------
  describe('2. Unverified Imported Data Decision Gate', () => {
    it('enforces WATCH caution on unverified imported data when market-derived', () => {
      const decision = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 180,
        volA: 26000, oiA: 50700, volB: 11500, oiB: 27900,
        friction: defaultFriction,
        isCalculable: true,
        isUnverifiedSource: true // User-imported unverified Bhavcopy
      });

      expect(decision.decision).toBe('WATCH');
      expect(decision.rationale).toContain('USER-IMPORTED DATA — SOURCE UNVERIFIED');
      expect(decision.rationale).toContain('Pre-trade caution enforced: live market execution requires authenticated broker order-book depth');
      expect(decision.triggerRules.some(r => r.includes('Source Integrity Gate'))).toBe(true);
    });

    it('allows sandbox demonstration presets to evaluate as ACTIONABLE even on unverified imported dataset', () => {
      const sandboxDecision = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 180,
        manualExpectedEdge: 175, // Sandbox override
        volA: 26000, oiA: 50700, volB: 11500, oiB: 27900,
        friction: { slippagePer10g: 20, brokerageTaxesPer10g: 30, liquidityHaircutPer10g: 10, costBufferPer10g: 15, liquidityThresholdScore: 45 },
        isCalculable: true,
        isUnverifiedSource: true
      });

      expect(sandboxDecision.decision).toBe('ACTIONABLE');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Dynamic Rolling-Window Controls (10D / 20D / 30D)
  // --------------------------------------------------------------------------
  describe('3. Dynamic Rolling-Window Controls (10D / 20D / 30D)', () => {
    // Generate a 40-session spread series with varying spread values
    const points: RelativeValueSpreadPoint[] = Array.from({ length: 40 }, (_, i) => ({
      date: `2026-08-${String(i + 1).padStart(2, '0')}`,
      symbolA: 'GOLDM',
      symbolB: 'GOLDTEN',
      priceA: 78000 + i * 20,
      priceB: 77800 + i * 15,
      spread: 200 + (i % 5) * 40 - i * 2, // Non-constant spread
      spreadPercentage: 0.25,
      provenanceA: 'PROTOTYPE SIMULATION',
      provenanceB: 'PROTOTYPE SIMULATION'
    }));

    it('recalculates mean, volatility, and Z-score when rolling window changes from 10 to 20 to 30', () => {
      const z10 = calculateZScore(points, 10);
      const z20 = calculateZScore(points, 20);
      const z30 = calculateZScore(points, 30);

      expect(z10.isCalculable).toBe(true);
      expect(z20.isCalculable).toBe(true);
      expect(z30.isCalculable).toBe(true);

      expect(z10.rollingWindowDays).toBe(10);
      expect(z20.rollingWindowDays).toBe(20);
      expect(z30.rollingWindowDays).toBe(30);

      // Verify that the statistics differ across different window horizons
      expect(z10.mean).not.toBe(z30.mean);
      expect(z10.standardDeviation).not.toBe(z30.standardDeviation);
      expect(z10.currentZScore).not.toBe(z30.currentZScore);
    });

    it('marks statistics as incalculable when eligible sessions are fewer than 5', () => {
      const fewPoints = points.slice(0, 3);
      const zFew = calculateZScore(fewPoints, 10);

      expect(zFew.isCalculable).toBe(false);
      expect(zFew.statisticalStatus).toBe('INSUFFICIENT_HISTORY');
      expect(zFew.incalculableReason).toContain('Insufficient history (< 5 sessions for calibrated rolling statistics)');
      // Enriched series points must be undefined to avoid presenting uncalibrated rolling numbers
      expect(zFew.series[0].zScore).toBeUndefined();
      expect(zFew.series[0].meanSpread).toBeUndefined();
      expect(zFew.series[0].stdDevSpread).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Contract-Expiry Alignment & Cycle Roll Boundaries
  // --------------------------------------------------------------------------
  describe('4. Contract-Expiry Alignment & Cycle Roll Boundaries', () => {
    it('selects matching maturity cycle contracts and avoids uncoordinated 1-month cross-expiry pairing', () => {
      // Mock trading date observations where multiple expiries exist for both legs
      const obsA: NormalizedObservation[] = [
        {
          date: '2026-10-19', symbol: 'GOLDM', expiryDate: '2026-11-05',
          open: 78000, high: 78000, low: 78000, close: 78000, normalizedPrice: 78313.57,
          unitAdjustment: 1, purityAdjustment: 999 / 995, daysToExpiry: 17, lifecycleStage: 'NORMAL',
          volume: 23051, openInterest: 45000, provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED'
        },
        {
          date: '2026-10-19', symbol: 'GOLDM', expiryDate: '2026-12-04',
          open: 79000, high: 79000, low: 79000, close: 79000, normalizedPrice: 79317.59,
          unitAdjustment: 1, purityAdjustment: 999 / 995, daysToExpiry: 46, lifecycleStage: 'NORMAL',
          volume: 10453, openInterest: 20000, provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED'
        }
      ];

      const obsB: NormalizedObservation[] = [
        {
          date: '2026-10-19', symbol: 'GOLDTEN', expiryDate: '2026-10-30',
          open: 78150, high: 78150, low: 78150, close: 78150, normalizedPrice: 78150,
          unitAdjustment: 1, purityAdjustment: 1, daysToExpiry: 11, lifecycleStage: 'NORMAL',
          volume: 9550, openInterest: 18000, provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED'
        },
        {
          date: '2026-10-19', symbol: 'GOLDTEN', expiryDate: '2026-11-30',
          open: 79200, high: 79200, low: 79200, close: 79200, normalizedPrice: 79200,
          unitAdjustment: 1, purityAdjustment: 1, daysToExpiry: 42, lifecycleStage: 'NORMAL',
          volume: 9796, openInterest: 22000, provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED'
        }
      ];

      // Prior active cycle was (2026-11-05 / 2026-10-30)
      const prevCycle = { expiryA: '2026-11-05', expiryB: '2026-10-30' };
      const matched = selectMatchedPairObservations(obsA, obsB, prevCycle);

      expect(matched).toBeDefined();
      // Should preserve the near-month cycle (11-05 / 10-30) via hysteresis, not jump to far month
      expect(matched?.obsA.expiryDate).toBe('2026-11-05');
      expect(matched?.obsB.expiryDate).toBe('2026-10-30');
    });

    it('buildPairSpreadSeries marks roll boundaries when contract cycle shifts forward', () => {
      const seriesA: NormalizedObservation[] = [
        {
          date: '2026-08-25', symbol: 'GOLDM', expiryDate: '2026-09-04',
          open: 75000, high: 75000, low: 75000, close: 75000, normalizedPrice: 75301.51,
          unitAdjustment: 1, purityAdjustment: 999 / 995, daysToExpiry: 10, lifecycleStage: 'NORMAL',
          volume: 50000, openInterest: 60000, provenance: 'PROTOTYPE SIMULATION'
        },
        {
          date: '2026-08-26', symbol: 'GOLDM', expiryDate: '2026-10-05',
          open: 76000, high: 76000, low: 76000, close: 76000, normalizedPrice: 76305.53,
          unitAdjustment: 1, purityAdjustment: 999 / 995, daysToExpiry: 40, lifecycleStage: 'NORMAL',
          volume: 55000, openInterest: 65000, provenance: 'PROTOTYPE SIMULATION'
        }
      ];

      const seriesB: NormalizedObservation[] = [
        {
          date: '2026-08-25', symbol: 'GOLDTEN', expiryDate: '2026-08-31',
          open: 75100, high: 75100, low: 75100, close: 75100, normalizedPrice: 75100,
          unitAdjustment: 1, purityAdjustment: 1, daysToExpiry: 6, lifecycleStage: 'NORMAL',
          volume: 20000, openInterest: 30000, provenance: 'PROTOTYPE SIMULATION'
        },
        {
          date: '2026-08-26', symbol: 'GOLDTEN', expiryDate: '2026-09-30',
          open: 76120, high: 76120, low: 76120, close: 76120, normalizedPrice: 76120,
          unitAdjustment: 1, purityAdjustment: 1, daysToExpiry: 35, lifecycleStage: 'NORMAL',
          volume: 35000, openInterest: 40000, provenance: 'PROTOTYPE SIMULATION'
        }
      ];

      const spreadPoints = buildPairSpreadSeries(seriesA, seriesB, 'GOLDM', 'GOLDTEN');
      expect(spreadPoints.length).toBe(2);
      expect(spreadPoints[0].isRollBoundary).toBe(false);
      expect(spreadPoints[1].isRollBoundary).toBe(true); // Expiry changed on date 2
    });
  });

  // --------------------------------------------------------------------------
  // 5. Accounting & Attribution Identity Verification
  // --------------------------------------------------------------------------
  describe('5. Accounting & Attribution Identity Verification', () => {
    it('verifies that Gross Realized P&L minus Total Frictions exactly equals Net Realized P&L with 0 discrepancy', () => {
      const summary = {
        totalTrades: 3,
        winningTrades: 2,
        losingTrades: 1,
        winRate: 66.67,
        grossPnL: 4289.70,
        totalFrictionCosts: 9500.00,
        netPnL: -5210.30,
        profitFactor: 0.45,
        sharpeRatio: -0.85,
        maxDrawdown: 5210.30,
        maxDrawdownPct: 5.21
      };

      const result = verifyAccountingIdentity(summary as any);
      expect(result.reconciled).toBe(true);
      expect(result.discrepancy).toBe(0);
      expect(result.details).toContain('Reconciled: Gross Realized P&L (₹4289.7) − Total Frictions (₹9500) === Net Realized P&L (₹-5210.3)');
    });

    it('decomposes individual trade attribution with exact leg sum and residual zero', () => {
      const tradeAttr = decomposeTradeAttribution(
        'LONG_SPREAD', // Buy A, Sell B
        10,            // 10 units of 10g (100g total)
        10,            // 10 units of 10g (100g total)
        78000,         // Entry A
        78300,         // Exit A (+300)
        77800,         // Entry B
        77950,         // Exit B (+150 short = -150)
        500            // Total friction
      );

      expect(tradeAttr.reconciled).toBe(true);
      expect(tradeAttr.legAPnL).toBe(3000);   // +300 * 10
      expect(tradeAttr.legBPnL).toBe(-1500);  // -150 * 10
      expect(tradeAttr.grossPnL).toBe(1500);  // 3000 - 1500
      expect(tradeAttr.netPnL).toBe(1000);    // 1500 - 500
      expect(tradeAttr.residualPnL).toBe(0);
    });
  });
});
