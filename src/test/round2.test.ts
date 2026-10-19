import { describe, it, expect } from 'vitest';
import { normalizePrice, getNormalizationBreakdown, calculateDaysToExpiry } from '../engines/normalizationEngine';
import { calculateSpread, calculateZScore, buildPairSpreadSeries } from '../engines/relativeValueEngine';
import { calculateTotalFriction, calculateLiquidityScore, evaluateLiquidityGrade } from '../engines/liquidityCostEngine';
import { evaluateDecision } from '../engines/decisionEngine';
import { evaluateContractComparability } from '../engines/comparabilityEngine';
import { buildEdgeSurvivalLedger } from '../engines/ledgerEngine';
import { generateWalkForwardWindows } from '../engines/validationEngine';
import { parseBhavcopyCsv, detectColumnMapping, normalizeDate, tokenizeCsvLine } from '../services/csvParserService';
import { marketDataService } from '../services/marketDataService';
import { CONTRACT_SPECIFICATIONS } from '../data/contracts';
import { SAMPLE_MCX_BHAVCOPY_CSV } from '../data/sampleOfficialBhavcopy';
import { NormalizedObservation } from '../types/market';

describe('AUREX Round 2 Comprehensive Evidence Verification Suite', () => {
  // Area 1: Separate handling of contract size and quote unit
  it('1. should strictly differentiate contract size (lot) from quote unit in grams', () => {
    // GOLDM: Contract Size = 100g, Quote Unit = 10g (they differ)
    const goldm = CONTRACT_SPECIFICATIONS.GOLDM;
    expect(goldm.contractSizeGrams).toBe(100);
    expect(goldm.quoteUnitGrams).toBe(10);
    expect(goldm.purityPermille).toBe(995);
    expect(goldm.contractSizeGrams).not.toBe(goldm.quoteUnitGrams);

    // GOLDTEN: Contract Size = 10g, Quote Unit = 10g, Purity = 999 (verified MCX spec)
    const goldten = CONTRACT_SPECIFICATIONS.GOLDTEN;
    expect(goldten.contractSizeGrams).toBe(10);
    expect(goldten.quoteUnitGrams).toBe(10);
    expect(goldten.purityPermille).toBe(999);
    expect(goldten.tickSize).toBe(1.0);

    // Normalization must use quoteUnitGrams, NOT contractSizeGrams
    const normBreakdown = getNormalizationBreakdown(74500, goldm);
    expect(normBreakdown.quoteUnit).toBe(10);
    expect(normBreakdown.unitMultiplier).toBe(1.0); // 10 / 10
  });

  // Area 2: Purity adjustments
  it('2. should apply exact purity adjustment: 999 / 995 for standard gold vs 1.0 for fine gold', () => {
    const adj995 = 999 / 995; // ~1.0040201
    const res995 = normalizePrice(10000, 10, 995);
    expect(res995.purityAdjustment).toBeCloseTo(adj995, 4);

    const res999 = normalizePrice(10000, 10, 999);
    expect(res999.purityAdjustment).toBe(1.0);
  });

  // Area 3: Missing and invalid prices
  it('3. should safely handle zero, negative, and infinite prices without NaN', () => {
    expect(normalizePrice(0, 10, 995).normalizedPrice).toBe(0);
    expect(normalizePrice(-500, 10, 995).normalizedPrice).toBe(0);
    expect(normalizePrice(NaN, 10, 995).normalizedPrice).toBe(0);
    expect(normalizePrice(Infinity, 10, 995).normalizedPrice).toBe(0);

    expect(() => normalizePrice(75000, 0, 995)).toThrow();
    expect(() => normalizePrice(75000, 10, 0)).toThrow();
  });

  // Area 4: CSV Tokenization and auto column mapping
  it('4. should correctly tokenize CSV lines with commas inside quotes and map columns', () => {
    const headerLine = 'Trade Date, Instrument, Symbol, "Expiry Date", Open, High, Low, Close, "Total Volume (Lots)", OI';
    const tokens = tokenizeCsvLine(headerLine);
    expect(tokens.length).toBe(10);
    expect(tokens[3]).toBe('Expiry Date');
    expect(tokens[8]).toBe('Total Volume (Lots)');

    const mapping = detectColumnMapping(tokens);
    expect(mapping.dateCol).toBe('Trade Date');
    expect(mapping.symbolCol).toBe('Symbol');
    expect(mapping.expiryCol).toBe('Expiry Date');
    expect(mapping.closeCol).toBe('Close');
    expect(mapping.volumeCol).toBe('Total Volume (Lots)');
    expect(mapping.oiCol).toBe('OI');
  });

  // Area 5: Date normalization
  it('5. should normalize diverse Indian and ISO date formats to YYYY-MM-DD', () => {
    expect(normalizeDate('2026-10-08')).toBe('2026-10-08');
    expect(normalizeDate('05-Nov-2026')).toBe('2026-11-05');
    expect(normalizeDate('27-NOV-26')).toBe('2026-11-27');
    expect(normalizeDate('08/10/2026')).toBe('2026-10-08');
    expect(normalizeDate('invalid')).toBeNull();
    expect(normalizeDate('')).toBeNull();
  });

  // Area 6: CSV Ingestion, Duplicate Detection, and Rejection Tracking
  it('6. should ingest CSV, detect duplicate keys, and record rejections accurately', () => {
    const testCsv = `Trade Date,Symbol,Expiry Date,Open,High,Low,Close,Volume,Open Interest
01-Sep-2026,GOLDM,05-Nov-2026,74000,74500,73900,74200,10000,15000
01-Sep-2026,GOLDM,05-Nov-2026,74000,74500,73900,74200,10000,15000
01-Sep-2026,SILVERM,30-Nov-2026,89000,89500,88900,89200,5000,8000
01-Sep-2026,GOLDTEN,27-Nov-2026,74000,74500,73900,74200,5000,7000
02-Sep-2026,GOLDM,invalid-date,74100,74600,74000,74300,9000,14000`;

    const result = parseBhavcopyCsv(testCsv, 'test.csv', 'USER-IMPORTED DATA — SOURCE UNVERIFIED');
    expect(result.validRecords.length).toBe(2); // GOLDM on Sep 1, GOLDTEN on Sep 1
    expect(result.rejectedRows.length).toBe(3); // 1 duplicate, 1 SILVERM, 1 invalid-date

    const reasons = result.rejectedRows.map(r => r.reason);
    expect(reasons.some(r => r.includes('Duplicate'))).toBe(true);
    expect(reasons.some(r => r.includes('Unsupported or non-PS03'))).toBe(true);
    expect(reasons.some(r => r.includes('Invalid or unparseable'))).toBe(true);
  });

  // Area 7: Bundled MCX Bhavcopy Sample Parsing
  it('7. should parse bundled illustrative MCX Bhavcopy sample without errors', () => {
    const result = parseBhavcopyCsv(
      SAMPLE_MCX_BHAVCOPY_CSV,
      'bundled_prototype_sample.csv',
      'PROTOTYPE SAMPLE — UNVERIFIED SOURCING'
    );
    expect(result.validRecords.length).toBeGreaterThan(50);
    expect(result.metadata.contractCoverage.GOLDM.count).toBeGreaterThan(10);
    expect(result.metadata.contractCoverage.GOLDTEN.count).toBeGreaterThan(10);
    expect(result.metadata.contractCoverage.GOLDGUINEA.count).toBeGreaterThan(10);
    expect(result.metadata.contractCoverage.GOLDPETAL.count).toBeGreaterThan(10);
    expect(result.metadata.provenance).toBe('PROTOTYPE SAMPLE — UNVERIFIED SOURCING');
  });

  // Area 8: Contract Comparability Engine
  it('8. should classify maturity comparability and generate term structure warnings', () => {
    const obsA: NormalizedObservation = {
      date: '2026-10-01',
      symbol: 'GOLDM',
      expiryDate: '2026-11-05', // 35 days left
      daysToExpiry: 35,
      open: 74000, high: 74500, low: 73900, close: 74200, volume: 15000, openInterest: 20000,
      normalizedPrice: 74500,
      unitAdjustment: 1,
      purityAdjustment: 1.00402,
      lifecycleStage: 'NORMAL'
    };

    const obsB: NormalizedObservation = {
      date: '2026-10-01',
      symbol: 'GOLDTEN',
      expiryDate: '2026-11-27', // 57 days left (22 days difference)
      daysToExpiry: 57,
      open: 74200, high: 74700, low: 74000, close: 74400, volume: 8000, openInterest: 12000,
      normalizedPrice: 74400,
      unitAdjustment: 1,
      purityAdjustment: 1,
      lifecycleStage: 'NORMAL'
    };

    const report = evaluateContractComparability(obsA, obsB, ['GOLDM', 'GOLDTEN']);
    expect(report.classification).toBe('COMPARABLE WITH MATURITY DIFFERENCE');
    expect(report.expiryDifferenceDays).toBe(22);
    expect(report.dataDateAlignment).toBe(true);
    expect(report.warnings.some(w => w.includes('Maturity Mismatch'))).toBe(true);
    expect(report.termStructureNote).toContain('financing');
  });

  // Area 9: Edge Survival Ledger 8-Stage Decomposition
  it('9. should build complete 8-stage Edge Survival Ledger with auditable trail', () => {
    const obsA: NormalizedObservation = {
      date: '2026-10-08',
      symbol: 'GOLDM',
      expiryDate: '2026-11-05',
      daysToExpiry: 28,
      open: 75000, high: 75500, low: 74900, close: 75200, volume: 14000, openInterest: 22000,
      normalizedPrice: 75503,
      unitAdjustment: 1,
      purityAdjustment: 1.00402,
      lifecycleStage: 'NORMAL'
    };

    const obsB: NormalizedObservation = {
      date: '2026-10-08',
      symbol: 'GOLDTEN',
      expiryDate: '2026-11-27',
      daysToExpiry: 50,
      open: 75100, high: 75400, low: 74900, close: 75200, volume: 9000, openInterest: 14000,
      normalizedPrice: 75200,
      unitAdjustment: 1,
      purityAdjustment: 1,
      lifecycleStage: 'NORMAL'
    };

    const ledger = buildEdgeSurvivalLedger({
      pair: ['GOLDM', 'GOLDTEN'],
      obsA,
      obsB,
      provenance: 'OFFICIAL MCX DATA — SOURCE VERIFIED',
      friction: {
        slippagePer10g: 20,
        brokerageTaxesPer10g: 30,
        liquidityHaircutPer10g: 10,
        costBufferPer10g: 15,
        liquidityThresholdScore: 45
      },
      historicalMean: 45,
      historicalStdDev: 25,
      zScore: 1.8
    });

    expect(ledger.stages.length).toBe(8);
    expect(ledger.stages[0].stageName).toBe('SOURCE EVIDENCE');
    expect(ledger.stages[1].stageName).toBe('ECONOMIC NORMALIZATION');
    expect(ledger.stages[2].stageName).toBe('RELATIVE-VALUE MEASUREMENT');
    expect(ledger.stages[3].stageName).toBe('EXPIRY AND DATA CHECK');
    expect(ledger.stages[4].stageName).toBe('LIQUIDITY CHECK');
    expect(ledger.stages[5].stageName).toBe('EXECUTION FRICTION');
    expect(ledger.stages[6].stageName).toBe('NET EDGE');
    expect(ledger.stages[7].stageName).toBe('FINAL DECISION');

    // Verify audit trail is non-empty for all stages
    for (const stage of ledger.stages) {
      expect(stage.auditTrail.length).toBeGreaterThan(0);
      expect(stage.metrics.length).toBeGreaterThan(0);
    }
  });

  // Area 10: Strict Walk-Forward Look-Ahead Prevention
  it('10. should strictly isolate training slice from out-of-sample test window', () => {
    // Generate synthetic series with clear jump at index 25
    const series = Array.from({ length: 40 }, (_, i) => ({
      date: `2026-08-${String(i + 1).padStart(2, '0')}`,
      symbolA: 'GOLDM' as const,
      symbolB: 'GOLDTEN' as const,
      priceA: 75000 + i * 10,
      priceB: 74900 + (i < 25 ? 0 : 500), // Jump after index 25
      spread: i < 25 ? 100 : 600,
      spreadPercentage: 0.2
    }));

    const windows = generateWalkForwardWindows(series, {
      slippagePer10g: 20,
      brokerageTaxesPer10g: 30,
      liquidityHaircutPer10g: 10,
      costBufferPer10g: 15,
      liquidityThresholdScore: 50
    });

    expect(windows.length).toBeGreaterThan(0);

    for (const w of windows) {
      // In-sample training dates must strictly precede out-of-sample test dates
      expect(w.trainEndDate < w.testStartDate).toBe(true);
      expect(w.trainObservationsCount).toBeGreaterThanOrEqual(10);
      expect(w.testObservationsCount).toBeGreaterThan(0);
    }
  });

  // Area 11: Insufficient data handling in walk-forward
  it('11. should return empty windows when observations are fewer than 15 (inconclusive)', () => {
    const shortSeries = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-08-${i + 1}`,
      symbolA: 'GOLDM' as const,
      symbolB: 'GOLDTEN' as const,
      priceA: 75000,
      priceB: 74900,
      spread: 100,
      spreadPercentage: 0.1
    }));

    const windows = generateWalkForwardWindows(shortSeries, {
      slippagePer10g: 20,
      brokerageTaxesPer10g: 30,
      liquidityHaircutPer10g: 10,
      costBufferPer10g: 15,
      liquidityThresholdScore: 50
    });

    expect(windows).toEqual([]);
  });

  // Area 12: Provenance transitions, user attestation semantics, and verification protections
  it('12. should enforce truthful user-attestation semantics and protect official verified status', () => {
    // 1. Initial state is Prototype Simulation
    marketDataService.resetToSimulation();
    expect(marketDataService.getProvenance()).toBe('PROTOTYPE SIMULATION');
    expect(marketDataService.getDataHealthSummary().provenance).toBe('PROTOTYPE SIMULATION');

    // Bundled simulation cannot accept user source attestation
    expect(() => marketDataService.recordSourceAttestation('Test note')).toThrow(
      'Synthetic simulation or bundled prototype samples cannot accept user source attestation.'
    );

    // 2. Bundled sample loads as PROTOTYPE SAMPLE — UNVERIFIED SOURCING
    marketDataService.loadBundledSample();
    expect(marketDataService.getProvenance()).toBe('PROTOTYPE SAMPLE — UNVERIFIED SOURCING');
    expect(marketDataService.getDataHealthSummary().provenance).toBe('PROTOTYPE SAMPLE — UNVERIFIED SOURCING');
    expect(marketDataService.getDataHealthSummary().isVerified).toBe(false);
    expect(marketDataService.getDataHealthSummary().isUserAttested).toBe(false);

    // Bundled sample cannot accept user source attestation
    expect(() => marketDataService.recordSourceAttestation('Test note')).toThrow(
      'Synthetic simulation or bundled prototype samples cannot accept user source attestation.'
    );

    // 3. User CSV uploads start strictly as USER-IMPORTED DATA — SOURCE UNVERIFIED
    marketDataService.importFromCsv(SAMPLE_MCX_BHAVCOPY_CSV, 'user_bhavcopy_sep2026.csv');
    expect(marketDataService.getProvenance()).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
    expect(marketDataService.getDataHealthSummary().provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
    expect(marketDataService.getDataHealthSummary().isVerified).toBe(false);
    expect(marketDataService.getDataHealthSummary().isUserAttested).toBe(false);

    // 4. Recording an attestation promotes ONLY to USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED
    marketDataService.recordSourceAttestation('Downloaded directly from MCX daily bhavcopy archive');
    expect(marketDataService.getProvenance()).toBe('USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED');
    const healthAfterAttestation = marketDataService.getDataHealthSummary();
    expect(healthAfterAttestation.provenance).toBe('USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED');
    expect(healthAfterAttestation.isUserAttested).toBe(true);
    expect(healthAfterAttestation.isVerified).toBe(false); // MUST NOT be marked verified
    expect(healthAfterAttestation.attestationNotes).toBe('Downloaded directly from MCX daily bhavcopy archive');
    expect(healthAfterAttestation.attestationTimestamp).toBeDefined();

    // 5. Arbitrary notes/self-certification CANNOT promote to official verified status
    expect(() => marketDataService.verifyActiveDataset('Arbitrary self-certification notes')).toThrow(
      'Independent official-source verification is unavailable'
    );
    // Provenance remains safely at USER-ATTESTED
    expect(marketDataService.getProvenance()).toBe('USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED');

    // 6. Revoking attestation restores USER-IMPORTED DATA — SOURCE UNVERIFIED
    marketDataService.revokeSourceAttestation();
    expect(marketDataService.getProvenance()).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
    const healthAfterRevocation = marketDataService.getDataHealthSummary();
    expect(healthAfterRevocation.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
    expect(healthAfterRevocation.isUserAttested).toBe(false);
    expect(healthAfterRevocation.attestationNotes).toBeUndefined();

    // 7. Reset back to prototype simulation
    marketDataService.resetToSimulation();
    expect(marketDataService.getProvenance()).toBe('PROTOTYPE SIMULATION');
    expect(marketDataService.getDataHealthSummary().provenance).toBe('PROTOTYPE SIMULATION');
  });

  // Area 13: Zero-variance spread edge cases
  it('13. should handle zero-variance spreads gracefully without division by zero', () => {
    const flatPoints = Array.from({ length: 20 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      symbolA: 'GOLDM' as const,
      symbolB: 'GOLDTEN' as const,
      priceA: 75000,
      priceB: 75000,
      spread: 0,
      spreadPercentage: 0
    }));

    const analysis = calculateZScore(flatPoints, 10);
    expect(analysis.standardDeviation).toBe(0);
    expect(analysis.currentZScore).toBe(0); // Safely returns 0, no NaN
    expect(analysis.mean).toBe(0);
  });
});
