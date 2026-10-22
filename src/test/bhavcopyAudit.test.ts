import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import { parseBhavcopyCsv, detectColumnMapping } from '../services/csvParserService';
import { marketDataService, MarketDataService } from '../services/marketDataService';
import { normalizePrice, getNormalizationBreakdown } from '../engines/normalizationEngine';
import { CONTRACT_SPECIFICATIONS } from '../data/contracts';

describe('MCX Bhavcopy Import Integrity & Multi-Date Accumulation Audit', () => {
  beforeEach(() => {
    marketDataService.resetToSimulation();
  });

  it('1. quarantines OPTFUT option contracts and admits genuine FUTCOM futures', () => {
    const sampleCsv = [
      'Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close,Volume(Lots),Volume(In 000\'s),Value(Lacs),Open Interest(Lots)',
      '"21 Oct 2026","FUTCOM","GOLDM","05NOV2026","-","0","144000.00","145000.00","143800.00","144584.00","144100.00","26349","263.490 GRMS ","38000.00","50749"',
      '"21 Oct 2026","OPTFUT","GOLDM","29OCT2026","CE","135500","","","","9503.50","9503.50","0","0.000 GRMS ","0.00","0"',
      '"21 Oct 2026","OPTFUT","GOLDM","27NOV2026","CE","152500","","","","957.00","957.00","0","0.000 GRMS ","0.00","1"',
      '"21 Oct 2026","OPTFUT","GOLDM","29DEC2026","PE","174000","","","","25812.50","25812.50","0","0.000 GRMS ","0.00","0"',
      '"21 Oct 2026","FUTCOM","SILVER","05DEC2026","-","0","90000.00","91000.00","89500.00","90500.00","90000.00","5000","150.000 KGS ","4500.00","8000"'
    ].join('\n');

    const result = parseBhavcopyCsv(sampleCsv, 'sample_audit.csv');

    // Only 1 genuine PS03 futures record (GOLDM 05NOV2026) must be accepted
    expect(result.validRecords).toHaveLength(1);
    expect(result.validRecords[0].symbol).toBe('GOLDM');
    expect(result.validRecords[0].expiryDate).toBe('2026-11-05');
    expect(result.validRecords[0].close).toBe(144584);

    // 4 records must be rejected with explicit reasons
    expect(result.rejectedRows).toHaveLength(4);

    // Verify option records quarantined with explicit non-futures reason
    const optionRejections = result.rejectedRows.filter(r => r.reason.includes('Non-futures instrument') || r.reason.includes('Option contract'));
    expect(optionRejections).toHaveLength(3);
    expect(optionRejections[0].reason).toContain("Instrument Name is 'OPTFUT'");

    // Verify non-PS03 commodity quarantined
    const silverRejection = result.rejectedRows.find(r => r.reason.includes('SILVER'));
    expect(silverRejection).toBeDefined();
    expect(silverRejection?.reason).toContain('Unsupported or non-PS03 commodity symbol');
  });

  it('2. detects columns correctly without confusing Instrument Name and Symbol', () => {
    const headers = [
      'Date', 'Instrument Name', 'Symbol', 'Expiry Date', 'Option Type',
      'Strike Price', 'Open', 'High', 'Low', 'Close', 'Previous Close',
      'Volume(Lots)', "Volume(In 000's)", 'Value(Lacs)', 'Open Interest(Lots)'
    ];

    const mapping = detectColumnMapping(headers);
    expect(mapping.symbolCol).toBe('Symbol');
    expect(mapping.instrumentCol).toBe('Instrument Name');
    expect(mapping.optionTypeCol).toBe('Option Type');
    expect(mapping.strikePriceCol).toBe('Strike Price');
    expect(mapping.volumeCol).toBe('Volume(Lots)');
    expect(mapping.oiCol).toBe('Open Interest(Lots)');
  });

  it('3. distinct trading dates accumulate deterministically in MarketDataService', () => {
    marketDataService.clearDataset();

    const day1Csv = [
      'Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close,Volume(Lots),Volume(In 000\'s),Value(Lacs),Open Interest(Lots)',
      '"20 Oct 2026","FUTCOM","GOLDM","05NOV2026","-","0","145000.00","145800.00","144500.00","145015.00","144500.00","21000","210.000 GRMS ","30000.00","50000"',
      '"20 Oct 2026","FUTCOM","GOLDTEN","30OCT2026","-","0","145500.00","146200.00","145000.00","145473.00","145000.00","7800","78.000 GRMS ","11000.00","29000"'
    ].join('\n');

    const day2Csv = [
      'Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close,Volume(Lots),Volume(In 000\'s),Value(Lacs),Open Interest(Lots)',
      '"21 Oct 2026","FUTCOM","GOLDM","05NOV2026","-","0","144000.00","145000.00","143800.00","144584.00","144100.00","26000","260.000 GRMS ","38000.00","50700"',
      '"21 Oct 2026","FUTCOM","GOLDTEN","30OCT2026","-","0","145000.00","145500.00","144800.00","145015.00","144600.00","11500","115.000 GRMS ","16000.00","27900"'
    ].join('\n');

    // Ingest Day 1
    const res1 = marketDataService.importFromCsv(day1Csv, 'day1.csv');
    expect(res1.validRecords).toHaveLength(2);
    expect(marketDataService.getObservations()).toHaveLength(2);
    expect(marketDataService.getAvailableDates()).toEqual(['2026-10-20']);

    // Ingest Day 2 (should accumulate seamlessly)
    const res2 = marketDataService.importFromCsv(day2Csv, 'day2.csv');
    expect(res2.mergeAnalysis?.isAccumulating).toBe(true);
    expect(res2.mergeAnalysis?.newlyInsertedCount).toBe(2);
    expect(res2.mergeAnalysis?.unchangedDuplicatesCount).toBe(0);
    expect(marketDataService.getObservations()).toHaveLength(4);
    expect(marketDataService.getAvailableDates()).toEqual(['2026-10-20', '2026-10-21']);
  });

  it('4. duplicate file imports remain idempotent', () => {
    marketDataService.clearDataset();

    const day1Csv = [
      'Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close,Volume(Lots),Volume(In 000\'s),Value(Lacs),Open Interest(Lots)',
      '"20 Oct 2026","FUTCOM","GOLDM","05NOV2026","-","0","145000.00","145800.00","144500.00","145015.00","144500.00","21000","210.000 GRMS ","30000.00","50000"'
    ].join('\n');

    marketDataService.importFromCsv(day1Csv, 'day1.csv');
    expect(marketDataService.getObservations()).toHaveLength(1);

    // Reimport identical file
    const resDup = marketDataService.importFromCsv(day1Csv, 'day1.csv');
    expect(resDup.mergeAnalysis?.newlyInsertedCount).toBe(0);
    expect(resDup.mergeAnalysis?.unchangedDuplicatesCount).toBe(1);
    expect(marketDataService.getObservations()).toHaveLength(1); // count not doubled
  });

  it('5. conflicting observations are reported and block silent overwriting', () => {
    marketDataService.clearDataset();

    const day1Csv = [
      'Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close,Volume(Lots),Volume(In 000\'s),Value(Lacs),Open Interest(Lots)',
      '"20 Oct 2026","FUTCOM","GOLDM","05NOV2026","-","0","145000.00","145800.00","144500.00","145015.00","144500.00","21000","210.000 GRMS ","30000.00","50000"'
    ].join('\n');

    const conflictCsv = [
      'Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close,Volume(Lots),Volume(In 000\'s),Value(Lacs),Open Interest(Lots)',
      '"20 Oct 2026","FUTCOM","GOLDM","05NOV2026","-","0","145000.00","151000.00","144500.00","150000.00","144500.00","21000","210.000 GRMS ","30000.00","50000"'
    ].join('\n');

    marketDataService.importFromCsv(day1Csv, 'day1.csv');

    // Attempting import with conflicting close price (₹150000 vs ₹145015) must throw
    expect(() => {
      marketDataService.importFromCsv(conflictCsv, 'conflict.csv', undefined, false);
    }).toThrow(/conflict/i);

    // Verify existing dataset is preserved intact
    expect(marketDataService.getObservations()).toHaveLength(1);
    expect(marketDataService.getObservations()[0].close).toBe(145015);
  });

  it('6. malformed OHLC values and negative prices are quarantined', () => {
    const malformedCsv = [
      'Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close,Volume(Lots),Volume(In 000\'s),Value(Lacs),Open Interest(Lots)',
      '"20 Oct 2026","FUTCOM","GOLDM","05NOV2026","-","0","145000.00","140000.00","146000.00","145015.00","144500.00","21000","210.000 GRMS ","30000.00","50000"', // Low > High
      '"20 Oct 2026","FUTCOM","GOLDTEN","30OCT2026","-","0","-100.00","-100.00","-100.00","-100.00","0.00","0","0.000 GRMS ","0.00","0"' // Negative price
    ].join('\n');

    const res = parseBhavcopyCsv(malformedCsv, 'malformed.csv');
    expect(res.validRecords).toHaveLength(0);
    expect(res.rejectedRows).toHaveLength(2);
    expect(res.rejectedRows[0].reason).toContain('Incoherent OHLC values');
    expect(res.rejectedRows[1].reason).toContain('Invalid settlement/close price');
  });

  it('7. valid zero-volume records are admitted if contract specification is valid', () => {
    const zeroVolCsv = [
      'Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close,Volume(Lots),Volume(In 000\'s),Value(Lacs),Open Interest(Lots)',
      '"20 Oct 2026","FUTCOM","GOLDM","05APR2027","-","0","","","","152073.00","152920.00","0","0.000 GRMS ","0.00","40"'
    ].join('\n');

    const res = parseBhavcopyCsv(zeroVolCsv, 'zero_vol.csv');
    expect(res.validRecords).toHaveLength(1);
    expect(res.validRecords[0].volume).toBe(0);
    expect(res.validRecords[0].openInterest).toBe(40);
    expect(res.validRecords[0].close).toBe(152073);
  });

  it('8. active simulation records are preserved and merged when importing new history', () => {
    expect(marketDataService.getProvenance()).toBe('PROTOTYPE SIMULATION');
    const simObsCount = marketDataService.getObservations().length;
    expect(simObsCount).toBe(434);

    const importedCsv = [
      'Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close,Volume(Lots),Volume(In 000\'s),Value(Lacs),Open Interest(Lots)',
      '"21 Oct 2026","FUTCOM","GOLDM","05NOV2026","-","0","145000.00","145800.00","144500.00","145015.00","144500.00","21000","210.000 GRMS ","30000.00","50000"'
    ].join('\n');

    // Ingest imported file
    const res = marketDataService.importFromCsv(importedCsv, 'imported.csv');
    expect(res.mergeAnalysis?.isAccumulating).toBe(true);
    expect(res.mergeAnalysis?.newlyInsertedCount).toBe(1);
    expect(res.mergeAnalysis?.projectedTotalRecords).toBe(435);
    expect(marketDataService.getProvenance()).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
    // Active dataset contains 434 prior simulation records + 1 newly imported record = 435
    expect(marketDataService.getObservations()).toHaveLength(435);

    // Reverting to simulation restores the calibrated simulation records
    marketDataService.resetToSimulation();
    expect(marketDataService.getProvenance()).toBe('PROTOTYPE SIMULATION');
    expect(marketDataService.getObservations()).toHaveLength(simObsCount);
  });

  it('9. verifies GOLDGUINEA 999-purity specification and canonical normalization', () => {
    const spec = CONTRACT_SPECIFICATIONS['GOLDGUINEA'];
    expect(spec.quoteUnitGrams).toBe(8);
    expect(spec.contractSizeGrams).toBe(8);
    expect(spec.purityPermille).toBe(999);

    // Benchmark equality test:
    // Raw Price: ₹59,600 per 8g @ 999 purity -> Normalized to ₹/10g @ 999 = 59600 * (10/8) * (999/999) = ₹74,500.00
    const norm = normalizePrice(59600, 8, 999);
    expect(norm.normalizedPrice).toBe(74500.00);
    expect(norm.unitAdjustment).toBe(1.25);
    expect(norm.purityAdjustment).toBe(1.0);

    const breakdown = getNormalizationBreakdown(59600, spec);
    expect(breakdown.normalizedPrice).toBe(74500.00);
    expect(breakdown.scalingFactor).toBe(1.25);
  });

  it('10. verifies benchmark calculations across all 4 supported gold contracts', () => {
    // 1. GOLDTEN: 10g quote, 999 purity
    // normalizePrice(74500, 10, 999) = 74500.00
    expect(normalizePrice(74500, 10, 999).normalizedPrice).toBe(74500.00);

    // 2. GOLDM: 10g quote, 995 purity
    // normalizePrice(74500, 10, 995) = 74500 * (10/10) * (999/995) ≈ 74799.50
    expect(normalizePrice(74500, 10, 995).normalizedPrice).toBe(74799.50);

    // 3. GOLDGUINEA: 8g quote, 999 purity
    // normalizePrice(59600, 8, 999) = 59600 * (10/8) * (999/999) = 74500.00
    expect(normalizePrice(59600, 8, 999).normalizedPrice).toBe(74500.00);

    // 4. GOLDPETAL: 1g quote, 999 purity
    // normalizePrice(7450, 1, 999) = 7450 * (10/1) * (999/999) = 74500.00
    expect(normalizePrice(7450, 1, 999).normalizedPrice).toBe(74500.00);
  });

  it('11. end-to-end integration test with real MCX Bhavcopy files (20-Oct & 21-Oct)', () => {
    const file20Path = 'C:/Users/HP/Downloads/BhavCopyDateWise_20102026.csv';
    const file22Path = 'C:/Users/HP/Downloads/BhavCopyDateWise_22102026.csv';

    if (!fs.existsSync(file20Path) || !fs.existsSync(file22Path)) {
      return; // Skip if files not present on machine
    }

    const content20 = fs.readFileSync(file20Path, 'utf8');
    const content22 = fs.readFileSync(file22Path, 'utf8');

    marketDataService.clearDataset();

    // Step 1: Ingest 20-Oct-2026 file (24 valid futures rows)
    const res20 = marketDataService.importFromCsv(content20, 'BhavCopyDateWise_20102026.csv');
    expect(res20.validRecords).toHaveLength(24);
    expect(marketDataService.getObservations()).toHaveLength(24);
    expect(marketDataService.getAvailableDates()).toEqual(['2026-10-20']);

    // Step 2: Ingest 21-Oct-2026 file (24 valid futures rows, 748 option rows, 15464 non-PS03 rows)
    const res22 = marketDataService.importFromCsv(content22, 'BhavCopyDateWise_22102026.csv');
    expect(res22.mergeAnalysis?.newlyInsertedCount).toBe(24);
    expect(res22.mergeAnalysis?.unchangedDuplicatesCount).toBe(0);
    expect(res22.mergeAnalysis?.conflictingCount).toBe(0);
    expect(res22.mergeAnalysis?.unsupportedInstrumentCount).toBe(748);

    // Accumulated dataset must now contain exactly 48 valid observations across the two dates
    expect(marketDataService.getObservations()).toHaveLength(48);
    expect(marketDataService.getAvailableDates()).toEqual(['2026-10-20', '2026-10-21']);

    // Step 3: Re-import 20-Oct-2026 file (idempotency check)
    const resRe20 = marketDataService.importFromCsv(content20, 'BhavCopyDateWise_20102026.csv');
    expect(resRe20.mergeAnalysis?.newlyInsertedCount).toBe(0);
    expect(resRe20.mergeAnalysis?.unchangedDuplicatesCount).toBe(24);
    expect(marketDataService.getObservations()).toHaveLength(48); // Remains exactly 48

    // Verify tracked source files
    const metadata = marketDataService.getDatasetMetadata();
    expect(metadata.sourceFiles?.length).toBe(2);

    // Verify option prices never leaked into the 48 futures records
    const obs = marketDataService.getObservations();
    const leakedOptions = obs.filter(o => o.close === 9503.5 || o.close === 957 || o.close === 25812.5);
    expect(leakedOptions).toHaveLength(0);
  });
});

/**
 * Regression Suite: AUREX Historical-Data Ingestion and Merge Workflow
 * Covers the 5 specific verification scenarios:
 * 1. 434 existing records + 24 unique records = 458 records with ACCUMULATING status.
 * 2. Re-importing the 24 records produces 458 records with 0 newly inserted and 24 unchanged duplicates.
 * 3. Conflicting records on existing composite keys throw without overwriting.
 * 4. Persistence across page refreshes (simulated page reload).
 * 5. Ingestion when no dataset exists initializes a 24-record dataset.
 * 6. Non-gold commodity and option quarantine remains strictly intact.
 */
describe('AUREX Historical Ingestion & Merge Workflow Regression Suite', () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); }
  };

  function generate24GoldFuturesCsv(dateStr = '21 Oct 2026'): string {
    const header = "Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close,Volume(Lots),Volume(In 000's),Value(Lacs),Open Interest(Lots)";
    const rows: string[] = [];

    const goldmExpiries = ['05NOV2026', '04DEC2026', '05JAN2027', '05FEB2027', '05MAR2027', '05APR2027'];
    const goldtenExpiries = ['30OCT2026', '27NOV2026', '31DEC2026', '29JAN2027', '26FEB2027', '26MAR2027'];
    const guineaExpiries = ['30OCT2026', '27NOV2026', '31DEC2026', '29JAN2027', '26FEB2027', '26MAR2027'];
    const petalExpiries = ['30OCT2026', '27NOV2026', '31DEC2026', '29JAN2027', '26FEB2027', '26MAR2027'];

    goldmExpiries.forEach((exp, i) => {
      const base = 144000 + i * 500;
      rows.push(`"${dateStr}","FUTCOM","GOLDM","${exp}","-","0","${base}.00","${base + 1000}.00","${base - 200}.00","${base + 584}.00","${base + 100}.00","1000","10.000 GRMS ","1500.00","2000"`);
    });

    goldtenExpiries.forEach((exp, i) => {
      const base = 145000 + i * 500;
      rows.push(`"${dateStr}","FUTCOM","GOLDTEN","${exp}","-","0","${base}.00","${base + 800}.00","${base - 100}.00","${base + 400}.00","${base}.00","500","5.000 GRMS ","700.00","1500"`);
    });

    guineaExpiries.forEach((exp, i) => {
      const base = 59000 + i * 300;
      rows.push(`"${dateStr}","FUTCOM","GOLDGUINEA","${exp}","-","0","${base}.00","${base + 400}.00","${base - 100}.00","${base + 200}.00","${base}.00","200","1.600 GRMS ","120.00","600"`);
    });

    petalExpiries.forEach((exp, i) => {
      const base = 7400 + i * 50;
      rows.push(`"${dateStr}","FUTCOM","GOLDPETAL","${exp}","-","0","${base}.00","${base + 60}.00","${base - 20}.00","${base + 30}.00","${base}.00","100","0.100 GRMS ","7.50","400"`);
    });

    return [header, ...rows].join('\n');
  }

  beforeEach(() => {
    store.clear();
    (globalThis as any).window = { localStorage: mockLocalStorage };
    (globalThis as any).localStorage = mockLocalStorage;
    marketDataService.resetToSimulation();
  });

  it('Scenario 1: 434 existing records + 24 unique records = 458 records with ACCUMULATING status', () => {
    // 1. Initial active dataset contains 434 simulation records
    expect(marketDataService.getObservations()).toHaveLength(434);
    expect(marketDataService.getProvenance()).toBe('PROTOTYPE SIMULATION');

    // 2. Pre-import preview analysis
    const csv24 = generate24GoldFuturesCsv('21 Oct 2026');
    const { parseResult, mergeAnalysis } = marketDataService.analyzeImportMerge(csv24, 'BhavCopyDateWise_21102026.csv');

    // Valid futures rows parsed
    expect(parseResult.validRecords).toHaveLength(24);
    expect(parseResult.rejectedRows).toHaveLength(0);

    // Merge analysis reflects accumulation into active dataset
    expect(mergeAnalysis.isAccumulating).toBe(true);
    expect(mergeAnalysis.validFuturesInSource).toBe(24);
    expect(mergeAnalysis.newlyInsertedCount).toBe(24);
    expect(mergeAnalysis.unchangedDuplicatesCount).toBe(0);
    expect(mergeAnalysis.conflictingCount).toBe(0);
    // Expected projected size is 434 + 24 = 458
    expect(mergeAnalysis.projectedTotalRecords).toBe(458);

    // 3. Apply merge
    marketDataService.importFromCsv(csv24, 'BhavCopyDateWise_21102026.csv');

    // 4. Verify resulting dataset
    expect(marketDataService.getObservations()).toHaveLength(458);
    expect(marketDataService.getProvenance()).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
    expect(marketDataService.getDatasetMetadata().validRows).toBe(458);
    expect(marketDataService.getDatasetMetadata().storagePersistence).toBe('LOCAL_STORAGE');
  });

  it('Scenario 2: re-importing the 24 records produces 458 records with 0 newly inserted and 24 unchanged duplicates', () => {
    const csv24 = generate24GoldFuturesCsv('21 Oct 2026');

    // Ingest first time -> 458
    marketDataService.importFromCsv(csv24, 'BhavCopyDateWise_21102026.csv');
    expect(marketDataService.getObservations()).toHaveLength(458);

    // Analyze re-import
    const reAnalysis = marketDataService.analyzeImportMerge(csv24, 'BhavCopyDateWise_21102026.csv');
    expect(reAnalysis.mergeAnalysis.isAccumulating).toBe(true);
    expect(reAnalysis.mergeAnalysis.newlyInsertedCount).toBe(0);
    expect(reAnalysis.mergeAnalysis.unchangedDuplicatesCount).toBe(24);
    expect(reAnalysis.mergeAnalysis.conflictingCount).toBe(0);
    expect(reAnalysis.mergeAnalysis.projectedTotalRecords).toBe(458);

    // Ingest second time -> still 458
    marketDataService.importFromCsv(csv24, 'BhavCopyDateWise_21102026.csv');
    expect(marketDataService.getObservations()).toHaveLength(458);
  });

  it('Scenario 3: conflicting records on existing composite keys throw without overwriting', () => {
    const csv24 = generate24GoldFuturesCsv('21 Oct 2026');
    marketDataService.importFromCsv(csv24, 'BhavCopyDateWise_21102026.csv');
    expect(marketDataService.getObservations()).toHaveLength(458);

    // Create conflicting CSV matching existing composite key GOLDM_2026-10-21_2026-11-05 with different close price
    const conflictCsv = [
      "Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close,Volume(Lots),Volume(In 000's),Value(Lacs),Open Interest(Lots)",
      '"21 Oct 2026","FUTCOM","GOLDM","05NOV2026","-","0","144000.00","165000.00","143800.00","160000.00","144100.00","26000","260.000 GRMS ","38000.00","50700"'
    ].join('\n');

    const analysis = marketDataService.analyzeImportMerge(conflictCsv, 'conflict.csv');
    expect(analysis.mergeAnalysis.conflictingCount).toBe(1);
    expect(analysis.mergeAnalysis.conflictingObservations[0].symbol).toBe('GOLDM');
    expect(analysis.mergeAnalysis.conflictingObservations[0].difference).toContain('Close');

    // Attempting import without forceReplace must throw
    expect(() => {
      marketDataService.importFromCsv(conflictCsv, 'conflict.csv', undefined, false);
    }).toThrow(/conflict/i);

    // Dataset remains intact at 458 rows with original close preserved
    expect(marketDataService.getObservations()).toHaveLength(458);
    const existingObs = marketDataService.getObservations().find(
      o => o.symbol === 'GOLDM' && o.date === '2026-10-21' && o.expiryDate === '2026-11-05'
    );
    expect(existingObs?.close).toBe(144584);
  });

  it('Scenario 4: persistence across page refreshes (simulated page reload)', () => {
    const csv24 = generate24GoldFuturesCsv('21 Oct 2026');
    marketDataService.importFromCsv(csv24, 'BhavCopyDateWise_21102026.csv');
    expect(marketDataService.getObservations()).toHaveLength(458);

    // Simulate page reload by creating a fresh MarketDataService instance
    const reloadedService = new MarketDataService();
    expect(reloadedService.getObservations()).toHaveLength(458);
    expect(reloadedService.getProvenance()).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
    expect(reloadedService.getDatasetMetadata().storagePersistence).toBe('LOCAL_STORAGE');
    expect(reloadedService.getDatasetMetadata().validRows).toBe(458);
    expect(reloadedService.hasPersistedData()).toBe(true);

    // Clear local storage control restores prototype simulation
    reloadedService.clearPersistedData();
    expect(reloadedService.getObservations()).toHaveLength(434);
    expect(reloadedService.getProvenance()).toBe('PROTOTYPE SIMULATION');
    expect(reloadedService.hasPersistedData()).toBe(false);
  });

  it('Scenario 5: ingestion when no dataset exists initializes a 24-record dataset', () => {
    // Empty state with 0 records
    marketDataService.clearDataset();
    expect(marketDataService.getObservations()).toHaveLength(0);

    const csv24 = generate24GoldFuturesCsv('21 Oct 2026');
    const { mergeAnalysis } = marketDataService.analyzeImportMerge(csv24, 'init_dataset.csv');

    // When no active dataset exists, analysis shows INITIALIZING status
    expect(mergeAnalysis.isAccumulating).toBe(false);
    expect(mergeAnalysis.validFuturesInSource).toBe(24);
    expect(mergeAnalysis.newlyInsertedCount).toBe(24);
    expect(mergeAnalysis.unchangedDuplicatesCount).toBe(0);
    expect(mergeAnalysis.projectedTotalRecords).toBe(24);

    // Ingest into empty state
    marketDataService.importFromCsv(csv24, 'init_dataset.csv');
    expect(marketDataService.getObservations()).toHaveLength(24);
    expect(marketDataService.getProvenance()).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
    expect(marketDataService.getDatasetMetadata().validRows).toBe(24);
  });

  it('Scenario 6: non-gold commodity and option quarantine remains intact', () => {
    const csv24 = generate24GoldFuturesCsv('21 Oct 2026');
    const mixedRows = [
      csv24,
      '"21 Oct 2026","OPTFUT","GOLDM","29OCT2026","CE","135500","","","","9503.50","9503.50","0","0.000 GRMS ","0.00","0"',
      '"21 Oct 2026","OPTFUT","GOLDM","27NOV2026","CE","152500","","","","957.00","957.00","0","0.000 GRMS ","0.00","1"',
      '"21 Oct 2026","FUTCOM","SILVER","05DEC2026","-","0","90000.00","91000.00","89500.00","90500.00","90000.00","5000","150.000 KGS ","4500.00","8000"',
      '"21 Oct 2026","FUTCOM","CRUDEOIL","18NOV2026","-","0","6000.00","6100.00","5950.00","6050.00","6000.00","12000","1200.000 BBL ","7200.00","15000"'
    ].join('\n');

    const { parseResult, mergeAnalysis } = marketDataService.analyzeImportMerge(mixedRows, 'mixed_bhavcopy.csv');
    expect(parseResult.validRecords).toHaveLength(24);
    expect(parseResult.rejectedRows).toHaveLength(4);
    expect(mergeAnalysis.unsupportedInstrumentCount).toBe(2); // 2 OPTFUT
    expect(mergeAnalysis.otherRejectedCount).toBe(2); // SILVER + CRUDEOIL
    expect(mergeAnalysis.newlyInsertedCount).toBe(24);
    expect(mergeAnalysis.projectedTotalRecords).toBe(434 + 24);

    marketDataService.importFromCsv(mixedRows, 'mixed_bhavcopy.csv');
    expect(marketDataService.getObservations()).toHaveLength(458);

    // Verify no quarantined options or non-gold commodities leaked into observations
    const obs = marketDataService.getObservations();
    const leakedNonGold = obs.filter(o => !['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'].includes(o.symbol));
    expect(leakedNonGold).toHaveLength(0);
  });
});
