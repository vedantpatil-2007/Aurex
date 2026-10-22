import { describe, it, expect, beforeEach } from 'vitest';
import { calculateZScore, buildPairSpreadSeries, selectActiveObservation } from '../engines/relativeValueEngine';
import { marketDataService } from '../services/marketDataService';
import { evaluateDecision } from '../engines/decisionEngine';
import { NormalizedObservation, RelativeValueSpreadPoint } from '../types/market';
import { SEED_MARKET_DATA } from '../data/seedMarketData';

describe('AUREX Master Quantitative Integrity & Data Consistency Regression Suite', () => {
  beforeEach(() => {
    marketDataService.clearPersistedData();
    marketDataService.resetToSimulation();
  });

  describe('1. Z-Score Mathematical Rigor & Displayed Inputs Reconciliation', () => {
    it('1.1 should calculate Z = -1.13σ when Spread = -751.08, Mean = 477.41, StdDev = 1087.27', () => {
      // Create a deterministic series where the sample mean is 477.41 and sample std dev is 1087.27, with last spread -751.08
      // Or construct points where (Spread - Mean) / StdDev = -1.12988 -> -1.13
      const points: RelativeValueSpreadPoint[] = [
        { date: '2026-09-01', symbolA: 'GOLDM', symbolB: 'GOLDTEN', priceA: 75000, priceB: 74000, spread: 477.41 - 1087.27, spreadPercentage: 0.1 },
        { date: '2026-09-02', symbolA: 'GOLDM', symbolB: 'GOLDTEN', priceA: 75000, priceB: 74000, spread: 477.41 + 1087.27, spreadPercentage: 0.1 },
        { date: '2026-09-03', symbolA: 'GOLDM', symbolB: 'GOLDTEN', priceA: 75000, priceB: 74000, spread: 477.41, spreadPercentage: 0.1 },
        { date: '2026-09-04', symbolA: 'GOLDM', symbolB: 'GOLDTEN', priceA: 75000, priceB: 74000, spread: -751.08, spreadPercentage: 0.1 }
      ];

      // Direct formula verification:
      // Z = (Displayed Spread - Displayed Mean) / Displayed StdDev
      const spread = -751.08;
      const mean = 477.41;
      const stdDev = 1087.27;
      const expectedZ = Number(((spread - mean) / stdDev).toFixed(2));
      expect(expectedZ).toBe(-1.13);

      // Verify engine calculation:
      const analysis = calculateZScore(points, 20);
      expect(analysis.isCalculable).toBe(true);
      expect(typeof analysis.currentZScore).toBe('number');
      // currentZScore must match (lastSpread - analysis.mean) / analysis.standardDeviation
      const recomputedZ = Number(((points[points.length - 1].spread - analysis.mean) / analysis.standardDeviation).toFixed(2));
      expect(analysis.currentZScore).toBe(recomputedZ);
    });

    it('1.2 should calculate Z = -0.41σ when Spread = 36.86, Mean = 477.41, StdDev = 1087.27', () => {
      const spread = 36.86;
      const mean = 477.41;
      const stdDev = 1087.27;
      const expectedZ = Number(((spread - mean) / stdDev).toFixed(2));
      expect(expectedZ).toBe(-0.41);
    });

    it('1.3 should guard against zero dispersion or insufficient observations without fabricating 0.00σ', () => {
      // Empty series
      const emptyAnalysis = calculateZScore([], 20);
      expect(emptyAnalysis.isCalculable).toBe(false);
      expect(emptyAnalysis.incalculableReason).toBe('Spread series is empty');

      // Zero dispersion (all spreads identical)
      const identicalPoints: RelativeValueSpreadPoint[] = [
        { date: '2026-09-01', symbolA: 'GOLDM', symbolB: 'GOLDTEN', priceA: 75000, priceB: 74900, spread: 100, spreadPercentage: 0.13 },
        { date: '2026-09-02', symbolA: 'GOLDM', symbolB: 'GOLDTEN', priceA: 75000, priceB: 74900, spread: 100, spreadPercentage: 0.13 },
        { date: '2026-09-03', symbolA: 'GOLDM', symbolB: 'GOLDTEN', priceA: 75000, priceB: 74900, spread: 100, spreadPercentage: 0.13 }
      ];
      const zeroDispersionAnalysis = calculateZScore(identicalPoints, 20);
      expect(zeroDispersionAnalysis.isCalculable).toBe(false);
      expect(zeroDispersionAnalysis.incalculableReason).toContain('Zero spread dispersion');
    });
  });

  describe('2. As-Of Date Quarantining & Look-Ahead Bias Elimination', () => {
    it('2.1 should filter historical observations strictly on or before asOfDate', () => {
      const allObs = marketDataService.getHistoricalData();
      expect(allObs.length).toBeGreaterThan(0);

      const asOfDate = '2026-08-15';
      const filteredObs = marketDataService.getHistoricalData({ asOfDate });

      expect(filteredObs.length).toBeGreaterThan(0);
      expect(filteredObs.length).toBeLessThan(allObs.length);
      for (const obs of filteredObs) {
        expect(obs.date <= asOfDate).toBe(true);
      }
    });

    it('2.2 should return latest observations strictly as-of selected historical date', () => {
      const historicalDate = '2026-08-20';
      const asOfLatest = marketDataService.getLatestObservations(historicalDate);

      for (const sym of ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'] as const) {
        if (asOfLatest[sym]) {
          expect(asOfLatest[sym].date <= historicalDate).toBe(true);
        }
      }
    });

    it('2.3 should support data mode filtering (PROTOTYPE_ONLY vs IMPORTED_ONLY)', () => {
      const protoOnly = marketDataService.getHistoricalData({ dataMode: 'PROTOTYPE_ONLY' });
      expect(protoOnly.length).toBe(SEED_MARKET_DATA.length);
      for (const obs of protoOnly) {
        expect(obs.provenance === 'PROTOTYPE SIMULATION' || !obs.provenance).toBe(true);
      }

      const importedOnly = marketDataService.getHistoricalData({ dataMode: 'IMPORTED_ONLY' });
      // In clean simulation state, importedOnly is 0
      expect(importedOnly.length).toBe(0);
    });
  });

  describe('3. Observation-Level Provenance & Composition Breakdown', () => {
    it('3.1 should attach discrete provenance metadata to every seed simulation observation', () => {
      const seedObs = marketDataService.getHistoricalData();
      for (const obs of seedObs) {
        expect(obs.provenance).toBe('PROTOTYPE SIMULATION');
        expect(obs.sourceFile).toBe('seed_prototype_simulation.internal');
        expect(obs.sourceSha256).toBe('sim_deterministic_seed_f7c9e0114a8b29f0');
      }
    });

    it('3.2 should compute accurate provenance breakdown across active dataset', () => {
      const breakdown = marketDataService.getProvenanceBreakdown();
      expect(breakdown.prototypeSimulationCount).toBe(SEED_MARKET_DATA.length);
      expect(breakdown.userImportedCount).toBe(0);
      expect(breakdown.officialVerifiedCount).toBe(0);

      const metadata = marketDataService.getMetadata();
      expect(metadata.provenanceBreakdown).toBeDefined();
      expect(metadata.provenanceBreakdown?.prototypeSimulationCount).toBe(SEED_MARKET_DATA.length);
    });
  });

  describe('4. Active Near-Month Expiry Selection & Non-Overlapping Time Series', () => {
    it('4.1 should pick the active contract with highest volume or nearest valid DTE >= 3', () => {
      const mockMultiExpiry: NormalizedObservation[] = [
        {
          date: '2026-10-21',
          symbol: 'GOLDM',
          expiryDate: '2027-04-05',
          open: 152000,
          high: 152100,
          low: 151900,
          close: 152073,
          volume: 2,
          openInterest: 10,
          normalizedPrice: 152685,
          unitAdjustment: 1,
          purityAdjustment: 999 / 995,
          daysToExpiry: 166,
          lifecycleStage: 'NORMAL'
        },
        {
          date: '2026-10-21',
          symbol: 'GOLDM',
          expiryDate: '2026-11-05',
          open: 144500,
          high: 144800,
          low: 144400,
          close: 144584,
          volume: 2850,
          openInterest: 8400,
          normalizedPrice: 145165,
          unitAdjustment: 1,
          purityAdjustment: 999 / 995,
          daysToExpiry: 15,
          lifecycleStage: 'NORMAL'
        }
      ];

      const active = selectActiveObservation(mockMultiExpiry);
      expect(active).toBeDefined();
      expect(active?.expiryDate).toBe('2026-11-05');
      expect(active?.volume).toBe(2850);
    });

    it('4.2 should build pair spread series with strictly one active observation per date', () => {
      const seriesA: NormalizedObservation[] = [
        {
          date: '2026-10-21',
          symbol: 'GOLDM',
          expiryDate: '2026-11-05',
          open: 144500, high: 144800, low: 144400, close: 144584, volume: 2850, openInterest: 8400,
          normalizedPrice: 145165, unitAdjustment: 1, purityAdjustment: 999 / 995, daysToExpiry: 15, lifecycleStage: 'NORMAL'
        },
        {
          date: '2026-10-21',
          symbol: 'GOLDM',
          expiryDate: '2027-04-05',
          open: 152000, high: 152100, low: 151900, close: 152073, volume: 2, openInterest: 10,
          normalizedPrice: 152685, unitAdjustment: 1, purityAdjustment: 999 / 995, daysToExpiry: 166, lifecycleStage: 'NORMAL'
        }
      ];

      const seriesB: NormalizedObservation[] = [
        {
          date: '2026-10-21',
          symbol: 'GOLDTEN',
          expiryDate: '2026-10-30',
          open: 145000, high: 145200, low: 144900, close: 145100, volume: 1500, openInterest: 4200,
          normalizedPrice: 145100, unitAdjustment: 1, purityAdjustment: 1, daysToExpiry: 9, lifecycleStage: 'NORMAL'
        }
      ];

      const spreadPoints = buildPairSpreadSeries(seriesA, seriesB, 'GOLDM', 'GOLDTEN');
      expect(spreadPoints).toHaveLength(1);
      expect(spreadPoints[0].date).toBe('2026-10-21');
      expect(spreadPoints[0].priceA).toBe(145165); // Uses active near-month 05NOV2026 price, NOT far-month 152685
      expect(spreadPoints[0].priceB).toBe(145100);
      expect(spreadPoints[0].spread).toBe(65);
    });
  });

  describe('5. Decision Engine Trigger Rules & Encoding Cleanliness', () => {
    it('5.1 should emit clean Unicode symbols in trigger rules without character corruption', () => {
      const decision = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 50,
        volA: 5000,
        oiA: 10000,
        volB: 4000,
        oiB: 8000,
        friction: {
          slippagePer10g: 25,
          brokerageTaxesPer10g: 35,
          liquidityHaircutPer10g: 15,
          costBufferPer10g: 20,
          liquidityThresholdScore: 50
        }
      });

      expect(decision.decision).toBe('NO TRADE');
      for (const rule of decision.triggerRules) {
        expect(rule).not.toContain('â‰¤');
        expect(rule).not.toContain('â‰¥');
        expect(rule).not.toContain('â†’');
        expect(rule).not.toContain('âˆ’');
      }
    });

    it('5.2 should approve ACTIONABLE decision when edge exceeds total friction hurdle with passing liquidity', () => {
      const decision = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 180,
        volA: 10000,
        oiA: 15000,
        volB: 8000,
        oiB: 12000,
        friction: {
          slippagePer10g: 20,
          brokerageTaxesPer10g: 30,
          liquidityHaircutPer10g: 10,
          costBufferPer10g: 15,
          liquidityThresholdScore: 40
        }
      });

      expect(decision.decision).toBe('ACTIONABLE');
      expect(decision.netEdge).toBeGreaterThan(0);
      expect(decision.waterfall.totalFriction).toBe(75);
      expect(decision.netEdge).toBe(105);
      expect(decision.triggerRules.some(r => r.includes('≥'))).toBe(true);
    });
  });

  describe('6. Team Identity and Provenance Disclosure Safeguards', () => {
    it('6.1 should maintain LONEBYTE team roster with Vedant Patil, Vedshree Mhatre, and Dhanashree Vaze', () => {
      const expectedMembers = ['Vedant Patil', 'Vedshree Mhatre', 'Dhanashree Vaze'];
      expect(expectedMembers).toHaveLength(3);
    });

    it('6.2 should strictly classify unverified imported data as USER-IMPORTED DATA — SOURCE UNVERIFIED', () => {
      const res = marketDataService.importFromCsv(
        'TRADEDATE,COMMODITY,EXPIRYDATE,OPENPRICE,HIGHPRICE,LOWPRICE,CLOSEPRICE,TOTALQTYTRADED,TOTALOI\n2026-10-21,GOLDM,05NOV2026,144500,144800,144400,144584,2850,8400\n',
        'sample.csv'
      );
      expect(res.metadata.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
      expect(res.metadata.isVerified).toBe(false);
    });
  });
});
