import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MarketDataService } from '../services/marketDataService';
import { SEED_MARKET_DATA } from '../data/seedMarketData';
import { HISTORICAL_BHAVCOPY_BACKUP } from '../data/historicalBhavcopyData';
import { evaluateDecision } from '../engines/decisionEngine';
import { buildPairSpreadSeries, calculateZScore } from '../engines/relativeValueEngine';
import { MarketObservation, FrictionAssumptions } from '../types/market';

describe('Data Lab Import, Persistence & Analytics Recovery', () => {
  let service: MarketDataService;
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    // Setup clean mock localStorage
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }

    if (typeof globalThis !== 'undefined') {
      const storageMock = {
        getItem: (key: string) => mockStorage[key] || null,
        setItem: (key: string, val: string) => { mockStorage[key] = val; },
        removeItem: (key: string) => { delete mockStorage[key]; },
        clear: () => {
          for (const key of Object.keys(mockStorage)) {
            delete mockStorage[key];
          }
        }
      };
      (globalThis as any).window = {
        localStorage: storageMock
      };
      (globalThis as any).localStorage = storageMock;
    }

    service = new MarketDataService();
    service.resetToSimulation();
  });

  afterEach(() => {
    if (typeof globalThis !== 'undefined') {
      delete (globalThis as any).window;
      delete (globalThis as any).localStorage;
    }
  });

  it('1. reproduces and diagnoses the empty IMPORTED dataset without hardcoded fallbacks or misleading filenames', () => {
    // Switch to IMPORTED_ONLY mode when no imported records exist
    service.setActiveDataMode('IMPORTED_ONLY');
    const importedObs = service.getHistoricalData({ dataMode: 'IMPORTED_ONLY' });
    const meta = service.getMetadata('IMPORTED_ONLY');
    const dates = service.getAvailableDates('IMPORTED_ONLY');

    // 1. Observation count must be 0
    expect(importedObs.length).toBe(0);
    expect(meta.validRows).toBe(0);

    // 2. Truthful filename: NEVER show 'imported_historical_market_data.bhavcopy'
    expect(meta.filename).toBe('No Imported Dataset');
    expect(meta.filename).not.toBe('imported_historical_market_data.bhavcopy');
    expect(meta.filename).not.toBe('seed_prototype_simulation.internal');

    // 3. Available dates must be empty (NOT falling back to prototype date '2026-10-08')
    expect(dates).toEqual([]);
    expect(meta.dateRange).toEqual({ start: 'N/A', end: 'N/A' });

    // 4. Decision Engine on empty dataset must report incalculable with explicit empty reason
    const decision = evaluateDecision({
      pair: ['GOLDM', 'GOLDTEN'],
      observedSpread: 0,
      volA: 0,
      oiA: 0,
      volB: 0,
      oiB: 0,
      friction: {
        slippagePer10g: 25,
        brokerageTaxesPer10g: 35,
        liquidityHaircutPer10g: 15,
        costBufferPer10g: 20,
        liquidityThresholdScore: 50
      },
      dataSufficiency: service.getDataSufficiency({ pair: ['GOLDM', 'GOLDTEN'], dataMode: 'IMPORTED_ONLY' }),
      isCalculable: false,
      incalculableReason: 'No market observations are loaded in IMPORTED_ONLY mode. Please ingest Bhavcopy CSV files in Data Lab.',
      hasSpreadData: false
    });

    expect(decision.decision).toBe('NO TRADE');
    expect(decision.isDefensible).toBe(false);
    expect(decision.rationale).toContain('unavailable');
  });

  it('2. migrates legacy browser storage keys into v2 storage keys automatically', () => {
    // Populate legacy storage key 'aurex_imported_dataset' (pre-v2)
    const legacyObs: MarketObservation[] = [
      {
        date: '2026-10-21',
        symbol: 'GOLDM',
        expiryDate: '2026-11-05',
        open: 144000,
        high: 145000,
        low: 143800,
        close: 144584,
        volume: 26000,
        openInterest: 50700,
        provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
        sourceFile: 'BhavCopyDateWise_21102026.csv',
        sourceSha256: 'hash_legacy_test'
      },
      {
        date: '2026-10-21',
        symbol: 'GOLDTEN',
        expiryDate: '2026-11-05',
        open: 144500,
        high: 145200,
        low: 144000,
        close: 145015,
        volume: 11500,
        openInterest: 27900,
        provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
        sourceFile: 'BhavCopyDateWise_21102026.csv',
        sourceSha256: 'hash_legacy_test'
      }
    ];

    mockStorage['aurex_imported_dataset'] = JSON.stringify(legacyObs);
    // Ensure primary v2 key is absent
    delete mockStorage['aurex_imported_dataset_v2'];

    // Instantiate a new service to trigger tryRestoreFromLocalStorage()
    const migratedService = new MarketDataService();

    // Verify observations were recovered
    const importedObs = migratedService.getHistoricalData({ dataMode: 'IMPORTED_ONLY' });
    expect(importedObs.length).toBe(2);
    expect(importedObs[0].symbol).toBe('GOLDM');
    expect(importedObs[0].close).toBe(144584);

    // Verify data was migrated into the current v2 key
    expect(mockStorage['aurex_imported_dataset_v2']).toBeDefined();
    const storedV2 = JSON.parse(mockStorage['aurex_imported_dataset_v2']);
    expect(storedV2.some((o: MarketObservation) => o.symbol === 'GOLDM' && o.close === 144584)).toBe(true);
  });

  it('3. imports multiple Bhavcopy CSV files in a single batch, quarantines non-futures, and deduplicates', async () => {
    const csvFile1 = `"Trade Date","Instrument","Symbol","Expiry Date","Open","High","Low","Close","Volume","Open Interest"
"21 Oct 2026","FUTCOM","GOLDM","05NOV2026","144000.00","145000.00","143800.00","144584.00","26000","50700"
"21 Oct 2026","FUTCOM","GOLDTEN","05NOV2026","144500.00","145200.00","144000.00","145015.00","11500","27900"
"21 Oct 2026","OPTFUT","GOLDM","05NOV2026","100.00","150.00","80.00","120.00","500","1200"
"21 Oct 2026","FUTCOM","CRUDEOIL","19NOV2026","6200.00","6300.00","6150.00","6250.00","8000","15000"`;

    const csvFile2 = `"Trade Date","Instrument","Symbol","Expiry Date","Open","High","Low","Close","Volume","Open Interest"
"22 Oct 2026","FUTCOM","GOLDM","05NOV2026","144600.00","145500.00","144200.00","145100.00","24000","49000"
"22 Oct 2026","FUTCOM","GOLDTEN","05NOV2026","145000.00","145800.00","144600.00","145450.00","10500","26800"`;

    const batch = [
      { name: 'BhavCopyDateWise_21102026.csv', content: csvFile1 },
      { name: 'BhavCopyDateWise_22102026.csv', content: csvFile2 },
      // Duplicate of file 1 to test deduplication in batch
      { name: 'BhavCopyDateWise_21102026 (1).csv', content: csvFile1 }
    ];

    const result = await service.importBatchFromCsv(batch, { forceReplace: true });

    expect(result.success).toBe(true);
    expect(result.totalFilesProcessed).toBe(3);
    // 2 valid gold futures from file 1 + 2 from file 2 = 4 unique records
    expect(result.newlyInsertedCount).toBe(4);
    // Duplicate file 1 records skipped
    expect(result.unchangedDuplicatesCount).toBe(2);
    // 2 non-gold/option records quarantined per file 1 (2 files with file 1 content = 4 quarantined)
    expect(result.quarantinedRowsCount).toBe(4);
    expect(result.finalDistinctDatesCount).toBe(2);
    expect(result.finalDateRange).toEqual({ start: '2026-10-21', end: '2026-10-22' });
  });

  it('4. auto-detects JSON backup payload vs CSV in single file import without column-mapping failure', () => {
    // 1. JSON Backup payload
    const backupPayload = JSON.stringify({
      version: '1.0',
      app: 'AUREX',
      exportedAt: '2026-10-25T12:00:00.000Z',
      sourceMode: 'IMPORTED_ONLY',
      provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
      metadata: {
        filename: 'backup.json',
        fileHashSha256: 'hash_test',
        sourceFiles: [{ filename: 'backup.json', fileHashSha256: 'hash_test' }]
      },
      observationsCount: 2,
      distinctDatesCount: 1,
      dateRange: { start: '2026-10-21', end: '2026-10-21' },
      observations: [
        {
          date: '2026-10-21',
          symbol: 'GOLDM',
          expiryDate: '2026-11-05',
          open: 144000,
          high: 145000,
          low: 143800,
          close: 144584,
          volume: 26000,
          openInterest: 50700,
          provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
          sourceFile: 'backup.json'
        },
        {
          date: '2026-10-21',
          symbol: 'GOLDTEN',
          expiryDate: '2026-11-05',
          open: 144500,
          high: 145200,
          low: 144000,
          close: 145015,
          volume: 11500,
          openInterest: 27900,
          provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
          sourceFile: 'backup.json'
        }
      ]
    });

    const resBackup = service.importPayload(backupPayload, 'imported_historical_market_data.bhavcopy', true);
    expect(resBackup.type).toBe('BACKUP');
    expect((resBackup.result as any).success).toBe(true);

    const imported = service.getHistoricalData({ dataMode: 'IMPORTED_ONLY' });
    expect(imported.length).toBe(2);

    // 2. CSV Payload
    const csvContent = `"Trade Date","Instrument","Symbol","Expiry Date","Open","High","Low","Close","Volume","Open Interest"
"23 Oct 2026","FUTCOM","GOLDM","05NOV2026","145000.00","146000.00","144800.00","145500.00","22000","48000"`;

    const resCsv = service.importPayload(csvContent, 'BhavCopyDateWise_23102026.csv', false);
    expect(resCsv.type).toBe('CSV');
    expect((resCsv.result as any).validRecords.length).toBe(1);

    const importedAfterCsv = service.getHistoricalData({ dataMode: 'IMPORTED_ONLY' });
    expect(importedAfterCsv.length).toBe(3);
  });

  it('5. loads the bundled 60-session historical Bhavcopy dataset with 1,440 observations and unverified provenance', () => {
    const res = service.loadBundledHistoricalDataset();

    expect(res.success).toBe(true);
    expect(res.finalTotalStoredCount).toBe(1440);
    expect(res.finalDistinctDatesCount).toBe(60);
    expect(res.finalDateRange).toEqual({ start: '2026-07-31', end: '2026-10-23' });

    // Inspect metadata under IMPORTED_ONLY mode
    const meta = service.getMetadata('IMPORTED_ONLY');
    expect(meta.validRows).toBe(1440);
    expect(meta.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
    expect(meta.filename).toContain('Bhavcopy CSVs');
    expect(meta.sourceFiles?.length).toBe(60);

    // Verify all 4 monitored contracts have coverage
    expect(meta.contractCoverage.GOLDM.count).toBeGreaterThanOrEqual(300);
    expect(meta.contractCoverage.GOLDTEN.count).toBeGreaterThanOrEqual(300);
    expect(meta.contractCoverage.GOLDGUINEA.count).toBeGreaterThanOrEqual(300);
    expect(meta.contractCoverage.GOLDPETAL.count).toBeGreaterThanOrEqual(300);
  });

  it('6. reconciles ALL, PROTOTYPE, and IMPORTED modes independently with strict isolation', () => {
    // 1. Load 1,440 historical observations
    service.loadBundledHistoricalDataset();

    // 2. IMPORTED_ONLY mode
    const importedObs = service.getHistoricalData({ dataMode: 'IMPORTED_ONLY' });
    const importedMeta = service.getMetadata('IMPORTED_ONLY');
    expect(importedObs.length).toBe(1440);
    expect(importedMeta.validRows).toBe(1440);
    expect(importedMeta.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
    expect(importedObs.every(o => o.provenance === 'USER-IMPORTED DATA — SOURCE UNVERIFIED')).toBe(true);

    // 3. PROTOTYPE_ONLY mode
    const protoObs = service.getHistoricalData({ dataMode: 'PROTOTYPE_ONLY' });
    const protoMeta = service.getMetadata('PROTOTYPE_ONLY');
    expect(protoObs.length).toBe(SEED_MARKET_DATA.length); // 434
    expect(protoMeta.validRows).toBe(SEED_MARKET_DATA.length);
    expect(protoMeta.provenance).toBe('PROTOTYPE SIMULATION');
    expect(protoMeta.filename).toBe('seed_prototype_simulation.internal');
    expect(protoObs.every(o => o.provenance === 'PROTOTYPE SIMULATION')).toBe(true);

    // 4. ALL mode
    const allObs = service.getHistoricalData({ dataMode: 'ALL' });
    const allMeta = service.getMetadata('ALL');
    expect(allObs.length).toBe(1440 + SEED_MARKET_DATA.length); // 1,874
    expect(allMeta.provenanceBreakdown?.prototypeSimulationCount).toBe(434);
    expect(allMeta.provenanceBreakdown?.userImportedCount).toBe(1440);
  });

  it('7. verifies downstream analytics: 10D, 20D, and 30D rolling windows update statistics without changing underlying price series', () => {
    service.loadBundledHistoricalDataset();

    const normObs = service.getNormalizedHistoricalData({ dataMode: 'IMPORTED_ONLY' });
    const seriesA = normObs.filter(o => o.symbol === 'GOLDM');
    const seriesB = normObs.filter(o => o.symbol === 'GOLDTEN');

    const spreadSeries = buildPairSpreadSeries(seriesA, seriesB, 'GOLDM', 'GOLDTEN');
    expect(spreadSeries.length).toBe(60);

    // Calculate rolling statistics for 10D, 20D, 30D
    const z10 = calculateZScore(spreadSeries, 10);
    const z20 = calculateZScore(spreadSeries, 20);
    const z30 = calculateZScore(spreadSeries, 30);

    // All windows must be calculable
    expect(z10.isCalculable).toBe(true);
    expect(z20.isCalculable).toBe(true);
    expect(z30.isCalculable).toBe(true);

    // Mean, SD, and Z-score must be distinctly evaluated per window
    expect(z10.mean).not.toBe(z20.mean);
    expect(z20.mean).not.toBe(z30.mean);
    expect(z10.standardDeviation).not.toBe(z20.standardDeviation);
    expect(z10.currentZScore).not.toBe(z20.currentZScore);

    // Underlying spread series points must be identical across all window evaluations
    expect(z10.series.length).toBe(60);
    expect(z20.series.length).toBe(60);
    expect(z30.series.length).toBe(60);
    for (let i = 0; i < 60; i++) {
      expect(z10.series[i].spread).toBe(spreadSeries[i].spread);
      expect(z20.series[i].spread).toBe(spreadSeries[i].spread);
      expect(z30.series[i].spread).toBe(spreadSeries[i].spread);
    }
  });

  it('8. enforces that insufficient history (< 5 sessions) remains INSUFFICIENT_HISTORY and prevents artificial signals', () => {
    // Generate slice with only 3 sessions
    const sparseObs: MarketObservation[] = [
      { date: '2026-10-21', symbol: 'GOLDM', expiryDate: '2026-11-05', open: 144000, high: 145000, low: 143800, close: 144584, volume: 20000, openInterest: 40000, provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED' },
      { date: '2026-10-21', symbol: 'GOLDTEN', expiryDate: '2026-11-05', open: 144500, high: 145200, low: 144000, close: 145015, volume: 10000, openInterest: 20000, provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED' },
      { date: '2026-10-22', symbol: 'GOLDM', expiryDate: '2026-11-05', open: 144600, high: 145500, low: 144200, close: 145100, volume: 22000, openInterest: 42000, provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED' },
      { date: '2026-10-22', symbol: 'GOLDTEN', expiryDate: '2026-11-05', open: 145000, high: 145800, low: 144600, close: 145450, volume: 11000, openInterest: 21000, provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED' },
      { date: '2026-10-23', symbol: 'GOLDM', expiryDate: '2026-11-05', open: 145000, high: 146000, low: 144800, close: 145500, volume: 21000, openInterest: 41000, provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED' },
      { date: '2026-10-23', symbol: 'GOLDTEN', expiryDate: '2026-11-05', open: 145300, high: 146100, low: 145000, close: 145800, volume: 10500, openInterest: 20500, provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED' }
    ];

    const backupPayload = JSON.stringify({
      version: '1.0',
      app: 'AUREX',
      exportedAt: '2026-10-25T12:00:00.000Z',
      sourceMode: 'IMPORTED_ONLY',
      provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
      metadata: { filename: 'sparse.json', fileHashSha256: 'sparse_hash' },
      observationsCount: sparseObs.length,
      distinctDatesCount: 3,
      dateRange: { start: '2026-10-21', end: '2026-10-23' },
      observations: sparseObs
    });

    service.restoreDatasetBackup(backupPayload, { forceReplace: true });

    const normObs = service.getNormalizedHistoricalData({ dataMode: 'IMPORTED_ONLY' });
    const seriesA = normObs.filter(o => o.symbol === 'GOLDM');
    const seriesB = normObs.filter(o => o.symbol === 'GOLDTEN');
    const spreadSeries = buildPairSpreadSeries(seriesA, seriesB, 'GOLDM', 'GOLDTEN');

    expect(spreadSeries.length).toBe(3);

    const zAnalysis = calculateZScore(spreadSeries, 20);
    expect(zAnalysis.isCalculable).toBe(false);
    expect(zAnalysis.incalculableReason).toContain('minimum 5 required');
  });
});
