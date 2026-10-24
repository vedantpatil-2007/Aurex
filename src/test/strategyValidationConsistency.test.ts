import { describe, it, expect, beforeEach } from 'vitest';
import { generateWalkForwardWindows } from '../engines/validationEngine';
import { runWalkForwardBacktest } from '../engines/backtestEngine';
import { marketDataService } from '../services/marketDataService';
import { buildPairSpreadSeries } from '../engines/relativeValueEngine';
import { FrictionAssumptions, NormalizedObservation, RelativeValueSpreadPoint } from '../types/market';

describe('AUREX Strategy Validation & Backtesting Consistency', () => {
  const defaultFriction: FrictionAssumptions = {
    slippagePer10g: 20,
    brokerageTaxesPer10g: 30,
    liquidityHaircutPer10g: 15,
    costBufferPer10g: 15,
    liquidityThresholdScore: 50
  };

  beforeEach(() => {
    marketDataService.resetToSimulation();
  });

  describe('1. 15-Session Dataset Reconciliation (Zero OOS Sessions & Zero Trades)', () => {
    it('returns empty out-of-sample windows on 15 sessions because all 15 are consumed by in-sample calibration', () => {
      // 15 contemporaneous trading dates (e.g. Oct 5 to Oct 23, 2026)
      const series15: RelativeValueSpreadPoint[] = Array.from({ length: 15 }, (_, i) => ({
        date: `2026-10-${(i + 5).toString().padStart(2, '0')}`,
        symbolA: 'GOLDM',
        symbolB: 'GOLDTEN',
        priceA: 78000 + i * 20,
        priceB: 77800 + i * 15,
        spread: 200 + i * 5,
        spreadPercentage: 0.25,
        provenanceA: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
        provenanceB: 'USER-IMPORTED DATA — SOURCE UNVERIFIED'
      }));

      const windows = generateWalkForwardWindows(series15, defaultFriction);
      // Must NOT fabricate "Window 3" or "Window 4" on 2-day slices!
      expect(windows).toHaveLength(0);
    });

    it('reconciles backtest session counts and out-of-sample trades on 15 sessions', () => {
      // Create 15-session normalized observations for pair GOLDM / GOLDTEN
      const obs15: NormalizedObservation[] = [];
      for (let i = 0; i < 15; i++) {
        const date = `2026-10-${(i + 5).toString().padStart(2, '0')}`;
        obs15.push({
          symbol: 'GOLDM',
          date,
          expiryDate: '2026-11-28',
          open: 78000 + i * 20,
          high: 78200 + i * 20,
          low: 77900 + i * 20,
          close: 78100 + i * 20,
          volume: 5000,
          openInterest: 12000,
          normalizedPrice: 78100 + i * 20,
          unitAdjustment: 1,
          purityAdjustment: 1,
          daysToExpiry: 45 - i,
          lifecycleStage: 'NORMAL',
          provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED'
        });
        obs15.push({
          symbol: 'GOLDTEN',
          date,
          expiryDate: '2026-11-28',
          open: 77900 + i * 15,
          high: 78050 + i * 15,
          low: 77800 + i * 15,
          close: 77950 + i * 15,
          volume: 8000,
          openInterest: 15000,
          normalizedPrice: 77950 + i * 15,
          unitAdjustment: 1,
          purityAdjustment: 1,
          daysToExpiry: 45 - i,
          lifecycleStage: 'NORMAL',
          provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED'
        });
      }

      const backtest = runWalkForwardBacktest(obs15, {
        pair: ['GOLDM', 'GOLDTEN'],
        zScoreEntryThreshold: 1.2,
        zScoreExitThreshold: 0.0,
        zScoreStopLoss: 2.5,
        maxHoldingDays: 12,
        warmUpDays: 15,
        friction: defaultFriction,
        capitalAllocationINR: 1000000
      });

      expect(backtest.evaluatedDates).toBe(15);
      expect(backtest.warmUpDates).toBe(15);
      expect(backtest.totalCandidateSignals).toBe(0);
      expect(backtest.completedTrades).toBe(0);
      expect(backtest.netPnL).toBe(0);
      expect(backtest.dataSufficiencyWarning).toContain('All 15 sessions were utilized for in-sample warm-up calibration');
      expect(backtest.dataSufficiencyWarning).toContain('0 out-of-sample evaluation sessions available');
    });
  });

  describe('2. Gate 0 & Out-of-Sample Window Eligibility Thresholds', () => {
    it('requires at least 20 sessions (15 in-sample calibration + 5 out-of-sample test) to produce a window', () => {
      // 19 sessions: 1 session short of the 20-session minimum
      const series19: RelativeValueSpreadPoint[] = Array.from({ length: 19 }, (_, i) => ({
        date: `2026-10-${(i + 1).toString().padStart(2, '0')}`,
        symbolA: 'GOLDM',
        symbolB: 'GOLDTEN',
        priceA: 78000,
        priceB: 77800,
        spread: 200,
        spreadPercentage: 0.25
      }));

      expect(generateWalkForwardWindows(series19, defaultFriction)).toHaveLength(0);

      // 20 sessions: exactly 15 in-sample + 5 out-of-sample
      const series20: RelativeValueSpreadPoint[] = Array.from({ length: 20 }, (_, i) => ({
        date: `2026-10-${(i + 1).toString().padStart(2, '0')}`,
        symbolA: 'GOLDM',
        symbolB: 'GOLDTEN',
        priceA: 78000,
        priceB: 77800,
        spread: 200,
        spreadPercentage: 0.25
      }));

      const windows20 = generateWalkForwardWindows(series20, defaultFriction);
      expect(windows20).toHaveLength(1);
      expect(windows20[0].windowId).toBe(1);
      expect(windows20[0].windowLabel).toBe('Window 1');
      expect(windows20[0].trainObservationsCount).toBe(15);
      expect(windows20[0].testObservationsCount).toBe(5);
      expect(windows20[0].trainEndDate < windows20[0].testStartDate).toBe(true);
    });

    it('enforces Gate 0 preliminary sample restriction: decisions cannot be ACTIONABLE when sample size < 30', () => {
      // 25 sessions: >= 20 but < 30 (Preliminary sample under Gate 0)
      const series25: RelativeValueSpreadPoint[] = Array.from({ length: 25 }, (_, i) => ({
        date: `2026-10-${(i + 1).toString().padStart(2, '0')}`,
        symbolA: 'GOLDM',
        symbolB: 'GOLDTEN',
        priceA: 78000,
        priceB: 77400, // Massive spread dislocation: spread = 600
        spread: 600,
        spreadPercentage: 0.77
      }));

      const windows25 = generateWalkForwardWindows(series25, defaultFriction);
      expect(windows25.length).toBeGreaterThan(0);

      for (const w of windows25) {
        // Even with huge netEdge (600 - 80 = 520 > 15), Gate 0 prevents ACTIONABLE label on < 30 sessions!
        expect(w.netEdge).toBeGreaterThan(15);
        expect(w.decisionTaken).toBe('WATCH');
        expect(w.status).toBe('MARGINAL');
      }
    });

    it('permits ACTIONABLE label only when sample size is SUFFICIENT (>= 30 sessions) and netEdge > 15', () => {
      // 60 sessions (Full prototype simulation sample size)
      const series60: RelativeValueSpreadPoint[] = Array.from({ length: 60 }, (_, i) => ({
        date: `2026-${(Math.floor(i / 30) + 8).toString().padStart(2, '0')}-${((i % 30) + 1).toString().padStart(2, '0')}`,
        symbolA: 'GOLDM',
        symbolB: 'GOLDTEN',
        priceA: 78000,
        priceB: 77400,
        spread: 600,
        spreadPercentage: 0.77
      }));

      const windows60 = generateWalkForwardWindows(series60, defaultFriction);
      expect(windows60).toHaveLength(4);

      // Verify sequential labeling Window 1 .. Window 4
      expect(windows60.map(w => w.windowLabel)).toEqual(['Window 1', 'Window 2', 'Window 3', 'Window 4']);

      for (const w of windows60) {
        expect(w.trainObservationsCount).toBeGreaterThanOrEqual(15);
        expect(w.testObservationsCount).toBeGreaterThanOrEqual(5);
        expect(w.trainEndDate < w.testStartDate).toBe(true);
        expect(w.decisionTaken).toBe('ACTIONABLE');
        expect(w.status).toBe('STABLE');
      }
    });
  });

  describe('3. Provenance Isolation & Reporting Truthfulness', () => {
    it('accurately distinguishes provenance metadata across PROTOTYPE_ONLY and IMPORTED_ONLY modes', () => {
      expect(marketDataService.getProvenance('PROTOTYPE_ONLY')).toBe('PROTOTYPE SIMULATION');
      expect(marketDataService.getMetadata('PROTOTYPE_ONLY').provenance).toBe('PROTOTYPE SIMULATION');

      expect(marketDataService.getProvenance('IMPORTED_ONLY')).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
      expect(marketDataService.getMetadata('IMPORTED_ONLY').provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
    });

    it('never allows walk-forward windows to bridge across the provenance boundary', () => {
      const mixedSeries: RelativeValueSpreadPoint[] = [
        ...Array.from({ length: 15 }, (_, i) => ({
          date: `2026-09-${(i + 1).toString().padStart(2, '0')}`,
          symbolA: 'GOLDM' as const,
          symbolB: 'GOLDTEN' as const,
          priceA: 78000,
          priceB: 77800,
          spread: 200,
          spreadPercentage: 0.25,
          provenanceA: 'PROTOTYPE SIMULATION' as const,
          provenanceB: 'PROTOTYPE SIMULATION' as const
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          date: `2026-10-${(i + 1).toString().padStart(2, '0')}`,
          symbolA: 'GOLDM' as const,
          symbolB: 'GOLDTEN' as const,
          priceA: 78000,
          priceB: 77800,
          spread: 200,
          spreadPercentage: 0.25,
          provenanceA: 'USER-IMPORTED DATA — SOURCE UNVERIFIED' as const,
          provenanceB: 'USER-IMPORTED DATA — SOURCE UNVERIFIED' as const
        }))
      ];

      const windows = generateWalkForwardWindows(mixedSeries, defaultFriction);
      // Windows bridging prototype and imported must be blocked
      for (const w of windows) {
        // Neither train nor test can mix datasets
        expect(w.testStartDate >= '2026-10-01' && w.trainStartDate < '2026-10-01').toBe(false);
      }
    });
  });

  describe('4. Full Prototype Simulation Continuity', () => {
    it('maintains full demo functionality on prototype data with active signal evaluation and windows', () => {
      const protoObs = marketDataService.getNormalizedHistoricalData({ dataMode: 'PROTOTYPE_ONLY' });
      const seriesA = protoObs.filter(o => o.symbol === 'GOLDM');
      const seriesB = protoObs.filter(o => o.symbol === 'GOLDTEN');
      const spreadSeries = buildPairSpreadSeries(seriesA, seriesB, 'GOLDM', 'GOLDTEN');

      const windows = generateWalkForwardWindows(spreadSeries, defaultFriction);
      expect(windows.length).toBe(4);

      // Default friction backtest (models capital preservation when hurdle > edge)
      const backtest = runWalkForwardBacktest(protoObs, {
        pair: ['GOLDM', 'GOLDTEN'],
        zScoreEntryThreshold: 1.2,
        zScoreExitThreshold: 0.0,
        zScoreStopLoss: 2.5,
        maxHoldingDays: 12,
        warmUpDays: 15,
        friction: defaultFriction,
        capitalAllocationINR: 1000000
      });

      expect(backtest.evaluatedDates!).toBeGreaterThan(50);
      expect(backtest.evaluatedDates! - backtest.warmUpDates!).toBeGreaterThan(30);
      expect(backtest.totalCandidateSignals).toBeGreaterThan(0);
      expect(backtest.dailyEquityCurve.length).toBe(backtest.evaluatedDates);

      // When friction hurdle allows execution, trades are simulated and accounted with full attribution
      const responsiveFriction: FrictionAssumptions = {
        slippagePer10g: 5,
        brokerageTaxesPer10g: 5,
        liquidityHaircutPer10g: 5,
        costBufferPer10g: 5,
        liquidityThresholdScore: 50
      };

      const tradeBacktest = runWalkForwardBacktest(protoObs, {
        pair: ['GOLDM', 'GOLDTEN'],
        zScoreEntryThreshold: 1.0,
        zScoreExitThreshold: 0.0,
        zScoreStopLoss: 2.5,
        maxHoldingDays: 12,
        warmUpDays: 15,
        friction: responsiveFriction,
        capitalAllocationINR: 1000000
      });

      expect(tradeBacktest.completedTrades).toBeGreaterThan(0);
      expect(tradeBacktest.winRatePct).toBeGreaterThan(0);
    });
  });
});
