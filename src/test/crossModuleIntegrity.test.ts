import { describe, it, expect, beforeEach } from 'vitest';
import { marketDataService } from '../services/marketDataService';
import {
  buildPairSpreadSeries,
  calculateZScore,
  getActiveObservation,
  selectActiveObservation
} from '../engines/relativeValueEngine';
import { evaluateDecision } from '../engines/decisionEngine';
import { buildEdgeSurvivalLedger } from '../engines/ledgerEngine';
import { runWalkForwardBacktest } from '../engines/backtestEngine';
import { generateWalkForwardWindows } from '../engines/validationEngine';
import { assessDataSufficiency } from '../engines/dataSufficiencyEngine';
import { normalizeObservation } from '../engines/normalizationEngine';
import { FrictionAssumptions, NormalizedObservation } from '../types/market';
import { LONEBYTE_TEAM } from '../data/team';

describe('Cross-Module Data-Mode, Statistical, Contract-Identity & Decision-Gate Integrity', () => {
  const defaultFriction: FrictionAssumptions = {
    slippagePer10g: 25,
    brokerageTaxesPer10g: 35,
    liquidityHaircutPer10g: 15,
    costBufferPer10g: 20,
    liquidityThresholdScore: 50
  };

  const sample24RowBhavcopyCsv = [
    "Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close,Volume(Lots),Volume(In 000's),Value(Lacs),Open Interest(Lots)",
    // GOLDM 6 expiries (Near-month is 05NOV2026, far-month is 05APR2027)
    '"21 Oct 2026","FUTCOM","GOLDM","05NOV2026","-","0","144000.00","145000.00","143800.00","144584.00","144100.00","26000","260.000 GRMS ","38000.00","50700"',
    '"21 Oct 2026","FUTCOM","GOLDM","04DEC2026","-","0","144500.00","145500.00","144000.00","145084.00","144600.00","8000","80.000 GRMS ","12000.00","18000"',
    '"21 Oct 2026","FUTCOM","GOLDM","05JAN2027","-","0","145000.00","146000.00","144500.00","145584.00","145100.00","3000","30.000 GRMS ","4500.00","9000"',
    '"21 Oct 2026","FUTCOM","GOLDM","05FEB2027","-","0","145500.00","146500.00","145000.00","146084.00","145600.00","1500","15.000 GRMS ","2200.00","4000"',
    '"21 Oct 2026","FUTCOM","GOLDM","05MAR2027","-","0","146000.00","147000.00","145500.00","146584.00","146100.00","500","5.000 GRMS ","750.00","1200"',
    '"21 Oct 2026","FUTCOM","GOLDM","05APR2027","-","0","146500.00","147500.00","146000.00","147084.00","146600.00","100","1.000 GRMS ","150.00","300"',
    // GOLDTEN 6 expiries (Near-month is 30OCT2026, far-month is 31MAR2027)
    '"21 Oct 2026","FUTCOM","GOLDTEN","30OCT2026","-","0","145000.00","145500.00","144800.00","145015.00","144600.00","11500","115.000 GRMS ","16000.00","27900"',
    '"21 Oct 2026","FUTCOM","GOLDTEN","27NOV2026","-","0","145500.00","146000.00","145000.00","145415.00","145000.00","4200","42.000 GRMS ","6000.00","11000"',
    '"21 Oct 2026","FUTCOM","GOLDTEN","31DEC2026","-","0","146000.00","146500.00","145500.00","145815.00","145500.00","1800","18.000 GRMS ","2600.00","5200"',
    '"21 Oct 2026","FUTCOM","GOLDTEN","29JAN2027","-","0","146500.00","147000.00","146000.00","146215.00","146000.00","900","9.000 GRMS ","1300.00","2800"',
    '"21 Oct 2026","FUTCOM","GOLDTEN","26FEB2027","-","0","147000.00","147500.00","146500.00","146615.00","146500.00","400","4.000 GRMS ","580.00","1400"',
    '"21 Oct 2026","FUTCOM","GOLDTEN","31MAR2027","-","0","147500.00","148000.00","147000.00","147015.00","147000.00","150","1.500 GRMS ","220.00","500"',
    // GOLDGUINEA 6 expiries
    '"21 Oct 2026","FUTCOM","GOLDGUINEA","30OCT2026","-","0","58000.00","58600.00","57900.00","58420.00","58100.00","3200","25.600 GRMS ","1900.00","6800"',
    '"21 Oct 2026","FUTCOM","GOLDGUINEA","27NOV2026","-","0","58400.00","59000.00","58300.00","58720.00","58500.00","1100","8.800 GRMS ","650.00","2900"',
    '"21 Oct 2026","FUTCOM","GOLDGUINEA","31DEC2026","-","0","58800.00","59400.00","58700.00","59020.00","58900.00","500","4.000 GRMS ","300.00","1400"',
    '"21 Oct 2026","FUTCOM","GOLDGUINEA","29JAN2027","-","0","59200.00","59800.00","59100.00","59320.00","59300.00","200","1.600 GRMS ","120.00","700"',
    '"21 Oct 2026","FUTCOM","GOLDGUINEA","26FEB2027","-","0","59600.00","60200.00","59500.00","59620.00","59700.00","100","0.800 GRMS ","60.00","350"',
    '"21 Oct 2026","FUTCOM","GOLDGUINEA","31MAR2027","-","0","60000.00","60600.00","59900.00","59920.00","60100.00","50","0.400 GRMS ","30.00","180"',
    // GOLDPETAL 6 expiries
    '"21 Oct 2026","FUTCOM","GOLDPETAL","30OCT2026","-","0","7300.00","7380.00","7280.00","7355.00","7310.00","15400","15.400 GRMS ","1130.00","34000"',
    '"21 Oct 2026","FUTCOM","GOLDPETAL","27NOV2026","-","0","7350.00","7420.00","7330.00","7395.00","7360.00","5100","5.100 GRMS ","380.00","12000"',
    '"21 Oct 2026","FUTCOM","GOLDPETAL","31DEC2026","-","0","7400.00","7460.00","7380.00","7435.00","7410.00","2100","2.100 GRMS ","160.00","5800"',
    '"21 Oct 2026","FUTCOM","GOLDPETAL","29JAN2027","-","0","7450.00","7500.00","7430.00","7475.00","7460.00","900","0.900 GRMS ","70.00","2600"',
    '"21 Oct 2026","FUTCOM","GOLDPETAL","26FEB2027","-","0","7500.00","7540.00","7480.00","7515.00","7510.00","400","0.400 GRMS ","30.00","1300"',
    '"21 Oct 2026","FUTCOM","GOLDPETAL","31MAR2027","-","0","7550.00","7580.00","7530.00","7555.00","7560.00","150","0.150 GRMS ","11.00","600"'
  ].join('\n');

  beforeEach(() => {
    marketDataService.resetToSimulation();
    marketDataService.setActiveDataMode('ALL');
  });

  describe('A. Single-Session Statistical Fallback & Display Semantics', () => {
    it('provides directly measurable current normalized spread while marking mean, volatility and Z-score as incalculable on 1 session', () => {
      // Ingest the single imported date
      marketDataService.importFromCsv(sample24RowBhavcopyCsv, 'BhavCopyDateWise_22102026.csv');
      marketDataService.setActiveDataMode('IMPORTED_ONLY');

      const importedObs = marketDataService.getNormalizedHistoricalData({ dataMode: 'IMPORTED_ONLY' });
      expect(importedObs).toHaveLength(24);

      const seriesA = importedObs.filter(o => o.symbol === 'GOLDM');
      const seriesB = importedObs.filter(o => o.symbol === 'GOLDTEN');
      const spreadSeries = buildPairSpreadSeries(seriesA, seriesB, 'GOLDM', 'GOLDTEN');

      expect(spreadSeries).toHaveLength(1);
      const pt = spreadSeries[0];

      // Measured settlement normalized prices on 21 Oct 2026
      // GOLDM close = 144584, quoteUnit = 10g, purity = 995 -> 144584 * (10/10) * (999/995) = 145165.24
      // GOLDTEN close = 145015, quoteUnit = 10g, purity = 999 -> 145015 * (10/10) * (999/999) = 145015.00
      expect(pt.priceA).toBeCloseTo(145165.24, 2);
      expect(pt.priceB).toBeCloseTo(145015.00, 2);
      expect(pt.spread).toBeCloseTo(150.24, 2);

      const analysis = calculateZScore(spreadSeries, 20);
      expect(analysis.isCalculable).toBe(false);
      expect(analysis.statisticalStatus).toBe('INSUFFICIENT_HISTORY');
      expect(analysis.incalculableReason).toContain('Insufficient single-provenance history (1 session available)');

      // Point zScore and rolling mean in series must be undefined, NOT 0 or artificial point fallback
      expect(analysis.series[0].zScore).toBeUndefined();
      expect(analysis.series[0].meanSpread).toBeUndefined();
      expect(analysis.series[0].stdDevSpread).toBeUndefined();
    });

    it('returns zero variance status when all spread observations are identical', () => {
      const mockPoints = [
        { date: '2026-10-20', symbolA: 'GOLDM', symbolB: 'GOLDTEN', priceA: 145000, priceB: 144900, spread: 100, spreadPercentage: 0.069, provenanceA: 'PROTOTYPE SIMULATION', provenanceB: 'PROTOTYPE SIMULATION' },
        { date: '2026-10-21', symbolA: 'GOLDM', symbolB: 'GOLDTEN', priceA: 145000, priceB: 144900, spread: 100, spreadPercentage: 0.069, provenanceA: 'PROTOTYPE SIMULATION', provenanceB: 'PROTOTYPE SIMULATION' }
      ] as any;

      const analysis = calculateZScore(mockPoints, 20);
      expect(analysis.isCalculable).toBe(false);
      expect(analysis.statisticalStatus).toBe('ZERO_VARIANCE');
      expect(analysis.incalculableReason).toBe('Zero spread dispersion (σ = 0)');
    });
  });

  describe('B. Contract Expiry, Liquidity Identity & Near-Month Selection', () => {
    it('authoritatively selects near-month active contracts and never falls back to CSV far-month rows', () => {
      marketDataService.importFromCsv(sample24RowBhavcopyCsv, 'BhavCopyDateWise_22102026.csv');
      const importedObs = marketDataService.getNormalizedHistoricalData({ dataMode: 'IMPORTED_ONLY' });

      // Deterministic active observation lookup
      const activeGoldM = getActiveObservation(importedObs, 'GOLDM', '2026-10-21');
      const activeGoldTen = getActiveObservation(importedObs, 'GOLDTEN', '2026-10-21');

      expect(activeGoldM).toBeDefined();
      expect(activeGoldTen).toBeDefined();

      // Near-month contracts must be selected
      expect(activeGoldM?.expiryDate).toBe('2026-11-05');
      expect(activeGoldM?.volume).toBe(26000);
      expect(activeGoldM?.openInterest).toBe(50700);

      expect(activeGoldTen?.expiryDate).toBe('2026-10-30');
      expect(activeGoldTen?.volume).toBe(11500);
      expect(activeGoldTen?.openInterest).toBe(27900);

      // Must NOT be the far-month rows (2027-04-05 or 2027-03-31)
      expect(activeGoldM?.expiryDate).not.toBe('2027-04-05');
      expect(activeGoldTen?.expiryDate).not.toBe('2027-03-31');
    });

    it('marketDataService.getLatestObservations returns active near-month contracts with matching volume and OI', () => {
      marketDataService.importFromCsv(sample24RowBhavcopyCsv, 'BhavCopyDateWise_22102026.csv');
      const latest = marketDataService.getLatestObservations('2026-10-21', 'IMPORTED_ONLY');

      expect(latest.GOLDM.expiryDate).toBe('2026-11-05');
      expect(latest.GOLDM.volume).toBe(26000);
      expect(latest.GOLDTEN.expiryDate).toBe('2026-10-30');
      expect(latest.GOLDTEN.volume).toBe(11500);
      expect(latest.GOLDGUINEA.expiryDate).toBe('2026-10-30');
      expect(latest.GOLDPETAL.expiryDate).toBe('2026-10-30');
    });

    it('reconciles Ledger audit stage source evidence with exact near-month contracts', () => {
      marketDataService.importFromCsv(sample24RowBhavcopyCsv, 'BhavCopyDateWise_22102026.csv');
      const importedObs = marketDataService.getNormalizedHistoricalData({ dataMode: 'IMPORTED_ONLY' });
      const obsA = getActiveObservation(importedObs, 'GOLDM', '2026-10-21');
      const obsB = getActiveObservation(importedObs, 'GOLDTEN', '2026-10-21');

      const ledger = buildEdgeSurvivalLedger({
        pair: ['GOLDM', 'GOLDTEN'],
        obsA,
        obsB,
        provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
        friction: defaultFriction,
        isCalculable: false,
        incalculableReason: 'Insufficient single-provenance history (1 session available).'
      });

      const stage1 = ledger.stages[0];
      expect(stage1.stageName).toBe('SOURCE EVIDENCE');
      const metricA = stage1.metrics.find(m => m.label.includes('GOLDM'));
      const metricB = stage1.metrics.find(m => m.label.includes('GOLDTEN'));

      expect(metricA?.note).toBe('Expiry: 2026-11-05');
      expect(metricB?.note).toBe('Expiry: 2026-10-30');
      expect(stage1.auditTrail[0]).toContain('Expiry: 2026-11-05');
      expect(stage1.auditTrail[1]).toContain('Expiry: 2026-10-30');
    });
  });

  describe('C. Data Lab Canonical Counts, Reconciliation & Mode Filtering', () => {
    it('correctly reports 458 total records in ALL mode with 434 simulation and 24 imported', () => {
      marketDataService.importFromCsv(sample24RowBhavcopyCsv, 'BhavCopyDateWise_22102026.csv');

      const metaAll = marketDataService.getMetadata('ALL');
      expect(metaAll.totalRows).toBe(458);
      expect(metaAll.validRows).toBe(458);
      expect(metaAll.provenanceBreakdown?.prototypeSimulationCount).toBe(434);
      expect(metaAll.provenanceBreakdown?.userImportedCount).toBe(24);
      expect(metaAll.dateRange.start).toBe('2026-07-15');
      expect(metaAll.dateRange.end).toBe('2026-10-21');
    });

    it('IMPORTED_ONLY mode metadata isolates strictly to 24 valid records, 1 distinct date, and 2026-10-21 range', () => {
      marketDataService.importFromCsv(sample24RowBhavcopyCsv, 'BhavCopyDateWise_22102026.csv');

      const metaImported = marketDataService.getMetadata('IMPORTED_ONLY');
      expect(metaImported.totalRows).toBe(458); // Total physical stored
      expect(metaImported.validRows).toBe(24);  // Mode-active records
      expect(metaImported.dateRange.start).toBe('2026-10-21');
      expect(metaImported.dateRange.end).toBe('2026-10-21');

      // Contract coverage matrix sums strictly to 24 in IMPORTED_ONLY
      const cov = metaImported.contractCoverage;
      expect(cov.GOLDM.count).toBe(6);
      expect(cov.GOLDTEN.count).toBe(6);
      expect(cov.GOLDGUINEA.count).toBe(6);
      expect(cov.GOLDPETAL.count).toBe(6);
      expect(cov.GOLDM.count + cov.GOLDTEN.count + cov.GOLDGUINEA.count + cov.GOLDPETAL.count).toBe(24);
      expect(cov.GOLDM.earliestDate).toBe('2026-10-21');
      expect(cov.GOLDM.latestDate).toBe('2026-10-21');

      const dates = marketDataService.getAvailableDates('IMPORTED_ONLY');
      expect(dates).toEqual(['2026-10-21']);
    });

    it('PROTOTYPE_ONLY mode metadata isolates strictly to 434 simulation records and July-October 2026 dates', () => {
      marketDataService.importFromCsv(sample24RowBhavcopyCsv, 'BhavCopyDateWise_22102026.csv');

      const metaProto = marketDataService.getMetadata('PROTOTYPE_ONLY');
      expect(metaProto.totalRows).toBe(458);
      expect(metaProto.validRows).toBe(434);
      expect(metaProto.dateRange.start).toBe('2026-07-15');
      expect(metaProto.dateRange.end).toBe('2026-10-08');

      const dates = marketDataService.getAvailableDates('PROTOTYPE_ONLY');
      expect(dates).toHaveLength(62);
      expect(dates[0]).toBe('2026-07-15');
      expect(dates[dates.length - 1]).toBe('2026-10-08');
    });
  });

  describe('D. Decision Engine Gate 0 Enforcement & Scenario Reset', () => {
    it('Gate 0 strictly blocks an uncalibrated single-day opportunity even if gross spread > friction', () => {
      // Gross spread = 150.24, friction = 95.00 -> Net edge = +55.24
      // In a naive engine without Gate 0, this would improperly show ACTIONABLE.
      // Under Gate 0, lack of statistical baseline forces NO TRADE with explicit capital preservation rationale.
      const decision = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 150.24,
        volA: 26000,
        oiA: 50700,
        volB: 11500,
        oiB: 27900,
        friction: defaultFriction,
        isCalculable: false,
        incalculableReason: 'Insufficient single-provenance history (1 session available).'
      });

      expect(decision.decision).toBe('NO TRADE');
      expect(decision.isDefensible).toBe(false);
      expect(decision.rationale).toContain('Theoretical opportunity cannot be validated');
      expect(decision.triggerRules[0]).toContain('Data Sufficiency Gate Triggered');
    });

    it('permits manual what-if sandbox override for demonstration while keeping live market gated', () => {
      // Live market is uncalibrated
      const liveDecision = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 150.24,
        volA: 26000,
        oiA: 50700,
        volB: 11500,
        oiB: 27900,
        friction: defaultFriction,
        isCalculable: false
      });
      expect(liveDecision.decision).toBe('NO TRADE');

      // What-if sandbox manual override (Preset 1: Actionable)
      const sandboxDecision = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 150.24,
        manualExpectedEdge: 175,
        volA: 26000,
        oiA: 50700,
        volB: 11500,
        oiB: 27900,
        friction: defaultFriction,
        isCalculable: false
      });
      expect(sandboxDecision.decision).toBe('ACTIONABLE');

      // Resetting manual expected edge back to undefined restores Gate 0 live decision
      const resetDecision = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 150.24,
        manualExpectedEdge: undefined,
        volA: 26000,
        oiA: 50700,
        volB: 11500,
        oiB: 27900,
        friction: defaultFriction,
        isCalculable: false
      });
      expect(resetDecision.decision).toBe('NO TRADE');
    });
  });

  describe('E. Validation & Backtesting Insufficient History Guarantees', () => {
    it('produces 0 walk-forward windows and explicit sample size warning for single imported session', () => {
      marketDataService.importFromCsv(sample24RowBhavcopyCsv, 'BhavCopyDateWise_22102026.csv');
      const importedObs = marketDataService.getNormalizedHistoricalData({ dataMode: 'IMPORTED_ONLY' });

      const seriesA = importedObs.filter(o => o.symbol === 'GOLDM');
      const seriesB = importedObs.filter(o => o.symbol === 'GOLDTEN');
      const spreadSeries = buildPairSpreadSeries(seriesA, seriesB, 'GOLDM', 'GOLDTEN');

      const windows = generateWalkForwardWindows(spreadSeries, defaultFriction);
      expect(windows).toHaveLength(0);

      const backtest = runWalkForwardBacktest(importedObs, {
        pair: ['GOLDM', 'GOLDTEN'],
        zScoreEntryThreshold: 1.2,
        zScoreExitThreshold: 0.0,
        maxHoldingDays: 12,
        friction: defaultFriction,
        warmUpDays: 15,
        capitalAllocationINR: 1000000
      });

      expect(backtest.totalAvailableDates).toBe(1);
      expect(backtest.dataSufficiencyWarning).toContain('INSUFFICIENT HISTORICAL DATA (Sample size limitation)');
      expect(backtest.trades).toHaveLength(0);
      expect(backtest.acceptedTrades).toBe(0);
    });

    it('never permits walk-forward backtest windows to cross the provenance boundary in ALL mode', () => {
      marketDataService.importFromCsv(sample24RowBhavcopyCsv, 'BhavCopyDateWise_22102026.csv');
      const allObs = marketDataService.getNormalizedHistoricalData({ dataMode: 'ALL' });

      const seriesA = allObs.filter(o => o.symbol === 'GOLDM');
      const seriesB = allObs.filter(o => o.symbol === 'GOLDTEN');
      const spreadSeries = buildPairSpreadSeries(seriesA, seriesB, 'GOLDM', 'GOLDTEN');

      const windows = generateWalkForwardWindows(spreadSeries, defaultFriction);

      // Verify no window has train in simulation and test in imported data
      for (const w of windows) {
        expect(w.testStartDate).not.toBe('2026-10-21');
      }
    });
  });

  describe('F. Persistence & Idempotency Integrity', () => {
    it('importing the exact same CSV twice is idempotent and does not duplicate observations', () => {
      marketDataService.importFromCsv(sample24RowBhavcopyCsv, 'BhavCopyDateWise_22102026.csv');
      expect(marketDataService.getObservations()).toHaveLength(458);

      const secondImport = marketDataService.importFromCsv(sample24RowBhavcopyCsv, 'BhavCopyDateWise_22102026.csv');
      expect(secondImport.mergeAnalysis?.unchangedDuplicatesCount).toBe(24);
      expect(secondImport.mergeAnalysis?.newlyInsertedCount).toBe(0);
      expect(marketDataService.getObservations()).toHaveLength(458);
    });

    it('switching data modes does not destroy saved observations', () => {
      marketDataService.importFromCsv(sample24RowBhavcopyCsv, 'BhavCopyDateWise_22102026.csv');

      marketDataService.setActiveDataMode('IMPORTED_ONLY');
      expect(marketDataService.getHistoricalData()).toHaveLength(24);

      marketDataService.setActiveDataMode('PROTOTYPE_ONLY');
      expect(marketDataService.getHistoricalData()).toHaveLength(434);

      marketDataService.setActiveDataMode('ALL');
      expect(marketDataService.getHistoricalData()).toHaveLength(458);
    });
  });

  describe('G. Team Identity & Core Institutional Governance', () => {
    it('strictly preserves the LONEBYTE team roster', () => {
      expect(LONEBYTE_TEAM).toHaveLength(3);
      expect(LONEBYTE_TEAM[0].name).toBe('Vedant Patil');
      expect(LONEBYTE_TEAM[0].role).toContain('Quant Systems');
      expect(LONEBYTE_TEAM[1].name).toBe('Vedshree Mhatre');
      expect(LONEBYTE_TEAM[2].name).toBe('Dhanashree Vaze');
    });
  });
});
