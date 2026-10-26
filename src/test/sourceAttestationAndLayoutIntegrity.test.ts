import { describe, it, expect, beforeEach } from 'vitest';
import { marketDataService } from '../services/marketDataService';
import { evaluateDecision } from '../engines/decisionEngine';
import { HISTORICAL_BHAVCOPY_BACKUP } from '../data/historicalBhavcopyData';
import { FrictionAssumptions } from '../types/market';

describe('AUREX — Source Attestation Safety, Decision Gate Integrity & Ingestion Metadata', () => {
  const defaultFriction: FrictionAssumptions = {
    slippagePer10g: 25,
    brokerageTaxesPer10g: 35,
    liquidityHaircutPer10g: 15,
    costBufferPer10g: 20,
    liquidityThresholdScore: 50
  };

  beforeEach(() => {
    marketDataService.resetToSimulation();
  });

  // --------------------------------------------------------------------------
  // 1. Source Attestation Safety & Provenance Integrity
  // --------------------------------------------------------------------------
  describe('1. Source Attestation Safety & Provenance Non-Bypass', () => {
    it('recording source attestation strictly maintains isVerified: false and cannot fabricate exchange authentication', () => {
      // Restore the 60-session historical dataset
      marketDataService.loadBundledHistoricalDataset();
      const metaBefore = marketDataService.getMetadata('IMPORTED_ONLY');
      expect(metaBefore.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
      expect(metaBefore.isVerified).toBe(false);

      // Record a user source attestation note
      marketDataService.recordSourceAttestation('User downloaded CSV directly from MCX daily archive');

      const metaAfter = marketDataService.getMetadata('IMPORTED_ONLY');
      // Provenance acknowledges user note but explicitly affirms NOT INDEPENDENTLY VERIFIED
      expect(metaAfter.isUserAttested).toBe(true);
      expect(metaAfter.isVerified).toBe(false); // MUST NEVER be marked verified
      expect(metaAfter.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
      expect(metaAfter.attestationStatus).toBe('USER ATTESTATION RECORDED — NOT INDEPENDENTLY VERIFIED');
      expect(metaAfter.attestationNotes).toBe('User downloaded CSV directly from MCX daily archive');
      expect(metaAfter.attestationTimestamp).toBeDefined();

      // Official MCX verification can NEVER be fabricated or assigned by user notes
      expect(() => marketDataService.verifyActiveDataset('Arbitrary user self-certification')).toThrow(
        /Independent official-source verification is unavailable/
      );
      expect(metaAfter.isVerified).toBe(false);
    });

    it('recording source attestation CANNOT bypass Decision Engine source-integrity gate or remove WATCH precaution', () => {
      marketDataService.loadBundledHistoricalDataset();
      marketDataService.recordSourceAttestation('Personal archive download');

      const meta = marketDataService.getMetadata('IMPORTED_ONLY');
      const isUnverifiedSource = meta.provenance !== 'OFFICIAL MCX DATA — SOURCE VERIFIED';
      expect(isUnverifiedSource).toBe(true);

      // Evaluate Decision Engine with positive net edge and passing liquidity
      const decisionResult = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 185.64,
        volA: 26000,
        oiA: 50700,
        volB: 11500,
        oiB: 27900,
        friction: defaultFriction,
        isCalculable: true,
        hasSpreadData: true,
        expiryDifferenceDays: 22,
        isUnverifiedSource // User-attested dataset is NOT verified by exchange
      });

      // Mathematical Verification: ₹185.64 gross spread - ₹95.00 total friction = ₹90.64 net defensible edge
      expect(decisionResult.expectedEdge).toBe(185.64);
      expect(decisionResult.totalFriction).toBe(95.00);
      expect(decisionResult.netEdge).toBe(90.64);
      expect(decisionResult.liquidityGrade).toBe('PASS');

      // Crucial Gate: Verdict MUST NOT be promoted to ACTIONABLE. It must remain WATCH!
      expect(decisionResult.decision).toBe('WATCH');
      expect(decisionResult.rationale).toContain('Pre-trade caution enforced');
      expect(decisionResult.rationale).toContain('authenticated broker order-book depth');
      expect(decisionResult.triggerRules.some(r => r.includes('Source Integrity Gate'))).toBe(true);
      expect(decisionResult.triggerRules.some(r => r.includes('Pre-Trade Caution Rule'))).toBe(true);

      // Maturity Difference Warning for GOLDM / GOLDTEN must be preserved
      expect(decisionResult.rationale).toContain('22-day maturity difference');
    });

    it('revoking source attestation cleanly restores unverified status without data loss', () => {
      marketDataService.loadBundledHistoricalDataset();
      marketDataService.recordSourceAttestation('Temporary note');
      expect(marketDataService.getMetadata('IMPORTED_ONLY').isUserAttested).toBe(true);

      marketDataService.revokeSourceAttestation();
      const meta = marketDataService.getMetadata('IMPORTED_ONLY');
      expect(meta.isUserAttested).toBe(false);
      expect(meta.attestationNotes).toBeUndefined();
      expect(meta.attestationTimestamp).toBeUndefined();
      expect(meta.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
      expect(meta.validRows).toBe(1440);
    });

    it('switching between attested and unattested states preserves WATCH and never permits ACTIONABLE on unverified data', () => {
      marketDataService.loadBundledHistoricalDataset();

      // State 1: Unattested user-imported data
      const meta1 = marketDataService.getMetadata('IMPORTED_ONLY');
      expect(meta1.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
      expect(meta1.isUserAttested).toBe(false);
      expect(meta1.attestationStatus).toBeUndefined();

      const health1 = marketDataService.getDataHealthSummary('IMPORTED_ONLY');
      expect(health1.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
      expect(health1.isUserAttested).toBe(false);

      const d1 = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 185.64,
        volA: 26000,
        oiA: 50700,
        volB: 11500,
        oiB: 27900,
        friction: defaultFriction,
        isCalculable: true,
        hasSpreadData: true,
        expiryDifferenceDays: 22,
        isUnverifiedSource: meta1.provenance !== 'OFFICIAL MCX DATA — SOURCE VERIFIED'
      });
      expect(d1.decision).toBe('WATCH');

      // State 2: User-attested data (underlying provenance is strictly preserved)
      marketDataService.recordSourceAttestation('User confirmation note');
      const meta2 = marketDataService.getMetadata('IMPORTED_ONLY');
      expect(meta2.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
      expect(meta2.isUserAttested).toBe(true);
      expect(meta2.attestationStatus).toBe('USER ATTESTATION RECORDED — NOT INDEPENDENTLY VERIFIED');

      const health2 = marketDataService.getDataHealthSummary('IMPORTED_ONLY');
      expect(health2.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
      expect(health2.isUserAttested).toBe(true);
      expect(health2.attestationStatus).toBe('USER ATTESTATION RECORDED — NOT INDEPENDENTLY VERIFIED');

      const d2 = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 185.64,
        volA: 26000,
        oiA: 50700,
        volB: 11500,
        oiB: 27900,
        friction: defaultFriction,
        isCalculable: true,
        hasSpreadData: true,
        expiryDifferenceDays: 22,
        isUnverifiedSource: meta2.provenance !== 'OFFICIAL MCX DATA — SOURCE VERIFIED'
      });
      expect(d2.decision).toBe('WATCH');

      // State 3: Revoked attestation
      marketDataService.revokeSourceAttestation();
      const meta3 = marketDataService.getMetadata('IMPORTED_ONLY');
      expect(meta3.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
      expect(meta3.isUserAttested).toBe(false);
      expect(meta3.attestationStatus).toBeUndefined();
      const d3 = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 185.64,
        volA: 26000,
        oiA: 50700,
        volB: 11500,
        oiB: 27900,
        friction: defaultFriction,
        isCalculable: true,
        hasSpreadData: true,
        expiryDifferenceDays: 22,
        isUnverifiedSource: meta3.provenance !== 'OFFICIAL MCX DATA — SOURCE VERIFIED'
      });
      expect(d3.decision).toBe('WATCH');
    });

    it('enforces NO TRADE when required contemporaneous market observations are missing', () => {
      const decisionMissingSpread = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 0,
        volA: 26000,
        oiA: 50700,
        volB: 11500,
        oiB: 27900,
        friction: defaultFriction,
        isCalculable: false,
        hasSpreadData: false,
        isUnverifiedSource: true
      });

      expect(decisionMissingSpread.decision).toBe('NO TRADE');
      expect(decisionMissingSpread.triggerRules.some(r => r.includes('Data Availability Gate'))).toBe(true);
      expect(decisionMissingSpread.triggerRules.some(r => r.includes('Capital Preservation Rule'))).toBe(true);
      expect(decisionMissingSpread.rationale).toContain('Capital preserved');
    });

    it('global dataMode controls dataset selection across modules without requiring a duplicate Decision selector', () => {
      marketDataService.loadBundledHistoricalDataset();

      marketDataService.setActiveDataMode('IMPORTED_ONLY');
      expect(marketDataService.getActiveDataMode()).toBe('IMPORTED_ONLY');
      expect(marketDataService.getHistoricalData({ dataMode: 'IMPORTED_ONLY' }).length).toBe(1440);
      expect(marketDataService.getAvailableDates('IMPORTED_ONLY').length).toBe(60);

      marketDataService.setActiveDataMode('PROTOTYPE_ONLY');
      expect(marketDataService.getActiveDataMode()).toBe('PROTOTYPE_ONLY');
      expect(marketDataService.getHistoricalData({ dataMode: 'PROTOTYPE_ONLY' }).length).toBeGreaterThan(0);

      marketDataService.setActiveDataMode('ALL');
      expect(marketDataService.getActiveDataMode()).toBe('ALL');
      expect(marketDataService.getHistoricalData({ dataMode: 'ALL' }).length).toBeGreaterThan(1440);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Ingestion Metadata & Data Lab Summary Consistency
  // --------------------------------------------------------------------------
  describe('2. Ingestion Metadata & Metrics Distinction', () => {
    it('authentically reflects 9,597 parsed rows, 1,440 accepted observations, 8,157 quarantined rows, 60 files, and 60 dates', () => {
      marketDataService.loadBundledHistoricalDataset();
      const meta = marketDataService.getMetadata('IMPORTED_ONLY');

      const acceptedObservations = meta.validRows;
      const quarantinedRows = meta.rejectedRows ?? 0;
      const parsedSourceRows = acceptedObservations + quarantinedRows;
      const sourceFilesCount = meta.sourceFiles?.length ?? 0;
      const tradingDates = marketDataService.getAvailableDates('IMPORTED_ONLY');

      expect(acceptedObservations).toBe(1440);
      expect(quarantinedRows).toBe(8157);
      expect(parsedSourceRows).toBe(9597);
      expect(sourceFilesCount).toBe(60);
      expect(tradingDates.length).toBe(60);
      expect(meta.dateRange.start).toBe('2026-07-31');
      expect(meta.dateRange.end).toBe('2026-10-23');
    });

    it('raw historical Bhavcopy backup metadata matches official ingestion figures', () => {
      expect(HISTORICAL_BHAVCOPY_BACKUP.metadata.validRows).toBe(1440);
      expect(HISTORICAL_BHAVCOPY_BACKUP.metadata.rejectedRows).toBe(8157);
      expect(HISTORICAL_BHAVCOPY_BACKUP.metadata.sourceFiles?.length).toBe(60);
      expect(HISTORICAL_BHAVCOPY_BACKUP.metadata.dateRange.start).toBe('2026-07-31');
      expect(HISTORICAL_BHAVCOPY_BACKUP.metadata.dateRange.end).toBe('2026-10-23');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Quantitative Arithmetic Invariance
  // --------------------------------------------------------------------------
  describe('3. Core Quantitative Arithmetic Invariance', () => {
    it('maintains exact arithmetic: ₹185.64 gross spread - ₹95.00 estimated friction = ₹90.64 net edge per 10g', () => {
      const decision = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 185.64,
        volA: 26000,
        oiA: 50700,
        volB: 11500,
        oiB: 27900,
        friction: defaultFriction,
        isCalculable: true,
        hasSpreadData: true,
        isUnverifiedSource: true
      });

      expect(decision.expectedEdge).toBe(185.64);
      expect(decision.totalFriction).toBe(95.00);
      expect(decision.netEdge).toBe(90.64);
      expect(decision.waterfall.slippage).toBe(25);
      expect(decision.waterfall.brokerageTaxes).toBe(35);
      expect(decision.waterfall.liquidityHaircut).toBe(15);
      expect(decision.waterfall.safetyBuffer).toBe(20);
    });
  });
});
