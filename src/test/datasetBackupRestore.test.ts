import { describe, it, expect, beforeEach } from 'vitest';
import { MarketDataService } from '../services/marketDataService';
import { DatasetBackupV1, MarketObservation } from '../types/market';

describe('AUREX Safe Dataset Backup & Restoration Engine', () => {
  let service: MarketDataService;

  const createSampleObs = (date: string, sym: 'GOLDM' | 'GOLDTEN' | 'GOLDGUINEA' | 'GOLDPETAL', price: number): MarketObservation => ({
    date,
    symbol: sym,
    expiryDate: '2026-11-05',
    open: price,
    high: price + 20,
    low: price - 20,
    close: price,
    volume: 10000,
    openInterest: 5000,
    provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
    sourceFile: 'daily_bhavcopy.csv',
    sourceSha256: 'sha256_mock_hash'
  });

  beforeEach(() => {
    service = new MarketDataService();
    service.resetToSimulation();
  });

  describe('1. Export Integrity', () => {
    it('exports complete versioned backup with all observation fields and metadata', () => {
      // Ingest via CSV to populate imported dataset
      const csv = [
        'INSTRUMENT,SYMBOL,EXPIRY_DT,STRIKE_PR,OPTION_TYP,OPEN,HIGH,LOW,CLOSE,SETTLE_PR,VOLUME,VAL_INLAKH,OPEN_INT,CHG_IN_OI,TIMESTAMP',
        `FUTCOM,GOLDM,05-NOV-2026,,,75000,75020,74980,75000,75000,100,50.0,500,10,05-OCT-2026`,
        `FUTCOM,GOLDTEN,05-NOV-2026,,,74980,75000,74960,74980,74980,80,40.0,400,5,05-OCT-2026`,
        `FUTCOM,GOLDM,05-NOV-2026,,,75100,75120,75080,75100,75100,110,55.0,520,20,06-OCT-2026`,
        `FUTCOM,GOLDTEN,05-NOV-2026,,,75080,75100,75060,75080,75080,90,45.0,410,10,06-OCT-2026`
      ].join('\n');

      service.importFromCsv(csv, 'test_bhavcopy.csv');

      const backup = service.exportDatasetBackup('IMPORTED_ONLY');

      expect(backup.version).toBe('1.0');
      expect(backup.app).toBe('AUREX');
      expect(backup.observationsCount).toBe(4);
      expect(backup.distinctDatesCount).toBe(2);
      expect(backup.dateRange).toEqual({ start: '2026-10-05', end: '2026-10-06' });
      expect(backup.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
      expect(backup.observations).toHaveLength(4);

      // Verify each observation preserves all critical fields
      for (const o of backup.observations) {
        expect(['GOLDM', 'GOLDTEN']).toContain(o.symbol);
        expect(['2026-10-05', '2026-10-06']).toContain(o.date);
        expect(o.expiryDate).toBe('2026-11-05');
        expect(o.close).toBeGreaterThan(0);
        expect(o.volume).toBeGreaterThan(0);
        expect(o.openInterest).toBeGreaterThan(0);
        expect(o.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
      }
    });
  });

  describe('2. Validation & Invalid Files Protection', () => {
    it('rejects corrupted JSON syntax', () => {
      const validation = service.validateBackup('{ invalid_json: ');
      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('Invalid JSON syntax');
    });

    it('rejects backup with wrong application signature or missing version', () => {
      const wrongApp = JSON.stringify({ app: 'OTHER_APP', version: '1.0', observations: [] });
      const valWrongApp = service.validateBackup(wrongApp);
      expect(valWrongApp.isValid).toBe(false);
      expect(valWrongApp.errors.some(e => e.includes("expected 'AUREX'"))).toBe(true);

      const wrongVersion = JSON.stringify({ app: 'AUREX', version: '2.5', observations: [] });
      const valWrongVer = service.validateBackup(wrongVersion);
      expect(valWrongVer.isValid).toBe(false);
      expect(valWrongVer.errors.some(e => e.includes("Unsupported backup schema version"))).toBe(true);
    });

    it('rejects empty or missing observations array', () => {
      const missingObs = JSON.stringify({ app: 'AUREX', version: '1.0' });
      const valMissing = service.validateBackup(missingObs);
      expect(valMissing.isValid).toBe(false);
      expect(valMissing.errors[0]).toContain('missing valid "observations" array');

      const emptyObs = JSON.stringify({ app: 'AUREX', version: '1.0', observations: [] });
      const valEmpty = service.validateBackup(emptyObs);
      expect(valEmpty.isValid).toBe(false);
      expect(valEmpty.errors.some(e => e.includes('0 observations'))).toBe(true);
    });

    it('rejects observations with unsupported commodity symbols or invalid prices', () => {
      const invalidRows = JSON.stringify({
        app: 'AUREX',
        version: '1.0',
        observations: [
          { symbol: 'SILVERM', date: '2026-10-05', expiryDate: '2026-11-05', close: 85000, volume: 10, openInterest: 5 },
          { symbol: 'GOLDM', date: 'invalid-date', expiryDate: '2026-11-05', close: 75000, volume: 10, openInterest: 5 },
          { symbol: 'GOLDTEN', date: '2026-10-05', expiryDate: '2026-11-05', close: -500, volume: 10, openInterest: 5 }
        ]
      });

      const validation = service.validateBackup(invalidRows);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Unsupported contract symbol'))).toBe(true);
      expect(validation.errors.some(e => e.includes('Missing or invalid date'))).toBe(true);
      expect(validation.errors.some(e => e.includes('Invalid close price'))).toBe(true);

      // Calling restore on invalid backup throws
      expect(() => service.restoreDatasetBackup(invalidRows)).toThrow(/Dataset restore rejected/);
    });
  });

  describe('3. Duplicate Skipping & Non-Destructive Merging', () => {
    it('skips identical duplicates without creating duplicate records or altering existing data', () => {
      // 1. Initial import of 2 records
      const initialCsv = [
        'INSTRUMENT,SYMBOL,EXPIRY_DT,STRIKE_PR,OPTION_TYP,OPEN,HIGH,LOW,CLOSE,SETTLE_PR,CONTRACTS,VAL_INLAKH,OPEN_INT,CHG_IN_OI,TIMESTAMP',
        `FUTCOM,GOLDM,05-NOV-2026,,,75000,75020,74980,75000,75000,100,50.0,500,10,05-OCT-2026`,
        `FUTCOM,GOLDTEN,05-NOV-2026,,,74980,75000,74960,74980,74980,80,40.0,400,5,05-OCT-2026`
      ].join('\n');
      service.importFromCsv(initialCsv, 'oct5.csv');
      expect(service.getHistoricalData({ dataMode: 'IMPORTED_ONLY' })).toHaveLength(2);

      // Export backup containing these 2 records
      const backup = service.exportDatasetBackup('IMPORTED_ONLY');

      // 2. Restore identical backup
      const restoreResult = service.restoreDatasetBackup(backup);
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.newlyInsertedCount).toBe(0);
      expect(restoreResult.unchangedDuplicatesCount).toBe(2);
      expect(restoreResult.conflictsCount).toBe(0);

      // Confirm no duplicates were inserted into storage
      const stored = service.getHistoricalData({ dataMode: 'IMPORTED_ONLY' });
      expect(stored).toHaveLength(2);
    });

    it('safely accumulates new dates from backup while preserving existing dates', () => {
      // Existing dataset has Oct 5
      const oct5Csv = [
        'INSTRUMENT,SYMBOL,EXPIRY_DT,STRIKE_PR,OPTION_TYP,OPEN,HIGH,LOW,CLOSE,SETTLE_PR,CONTRACTS,VAL_INLAKH,OPEN_INT,CHG_IN_OI,TIMESTAMP',
        `FUTCOM,GOLDM,05-NOV-2026,,,75000,75020,74980,75000,75000,100,50.0,500,10,05-OCT-2026`,
        `FUTCOM,GOLDTEN,05-NOV-2026,,,74980,75000,74960,74980,74980,80,40.0,400,5,05-OCT-2026`
      ].join('\n');
      service.importFromCsv(oct5Csv, 'oct5.csv');

      // Incoming backup has Oct 5 (duplicate) AND Oct 6 (new) AND Oct 7 (new)
      const multiBackup: DatasetBackupV1 = {
        version: '1.0',
        app: 'AUREX',
        exportedAt: new Date().toISOString(),
        provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
        metadata: service.getMetadata('IMPORTED_ONLY'),
        observationsCount: 6,
        distinctDatesCount: 3,
        dateRange: { start: '2026-10-05', end: '2026-10-07' },
        observations: [
          createSampleObs('2026-10-05', 'GOLDM', 75000),      // duplicate
          createSampleObs('2026-10-05', 'GOLDTEN', 74980),    // duplicate
          createSampleObs('2026-10-06', 'GOLDM', 75120),      // new
          createSampleObs('2026-10-06', 'GOLDTEN', 75100),    // new
          createSampleObs('2026-10-07', 'GOLDM', 75250),      // new
          createSampleObs('2026-10-07', 'GOLDTEN', 75220)     // new
        ]
      };

      const result = service.restoreDatasetBackup(multiBackup);
      expect(result.success).toBe(true);
      expect(result.newlyInsertedCount).toBe(4);
      expect(result.unchangedDuplicatesCount).toBe(2);
      expect(result.finalTotalStoredCount).toBe(6);
      expect(result.finalDistinctDatesCount).toBe(3);
      expect(result.finalDateRange).toEqual({ start: '2026-10-05', end: '2026-10-07' });

      // Check dates in memory
      const dates = service.getAvailableDates('IMPORTED_ONLY');
      expect(dates).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
    });
  });

  describe('4. Conflict Protection', () => {
    it('blocks restoration and prevents silent overwriting when incoming backup has conflicting prices', () => {
      // Existing dataset has GOLDM on Oct 5 at close = 75000
      const oct5Csv = [
        'INSTRUMENT,SYMBOL,EXPIRY_DT,STRIKE_PR,OPTION_TYP,OPEN,HIGH,LOW,CLOSE,SETTLE_PR,CONTRACTS,VAL_INLAKH,OPEN_INT,CHG_IN_OI,TIMESTAMP',
        `FUTCOM,GOLDM,05-NOV-2026,,,75000,75020,74980,75000,75000,100,50.0,500,10,05-OCT-2026`
      ].join('\n');
      service.importFromCsv(oct5Csv, 'oct5.csv');

      // Conflicting backup with close = 76500 (+1500 difference)
      const conflictingBackup: DatasetBackupV1 = {
        version: '1.0',
        app: 'AUREX',
        exportedAt: new Date().toISOString(),
        provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
        metadata: service.getMetadata('IMPORTED_ONLY'),
        observationsCount: 1,
        distinctDatesCount: 1,
        dateRange: { start: '2026-10-05', end: '2026-10-05' },
        observations: [
          createSampleObs('2026-10-05', 'GOLDM', 76500) // Conflicting price!
        ]
      };

      // Restore must throw with conflict detail
      expect(() => service.restoreDatasetBackup(conflictingBackup)).toThrow(
        /Restore conflict: Detected 1 conflicting observation/
      );

      // Verify existing record was NOT overwritten
      const stored = service.getHistoricalData({ dataMode: 'IMPORTED_ONLY' });
      expect(stored[0].close).toBe(75000);
    });

    it('allows explicit replacement when forceReplace option is passed', () => {
      // Existing dataset has GOLDM on Oct 5 at close = 75000
      const oct5Csv = [
        'INSTRUMENT,SYMBOL,EXPIRY_DT,STRIKE_PR,OPTION_TYP,OPEN,HIGH,LOW,CLOSE,SETTLE_PR,CONTRACTS,VAL_INLAKH,OPEN_INT,CHG_IN_OI,TIMESTAMP',
        `FUTCOM,GOLDM,05-NOV-2026,,,75000,75020,74980,75000,75000,100,50.0,500,10,05-OCT-2026`
      ].join('\n');
      service.importFromCsv(oct5Csv, 'oct5.csv');

      const replacementBackup: DatasetBackupV1 = {
        version: '1.0',
        app: 'AUREX',
        exportedAt: new Date().toISOString(),
        provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
        metadata: service.getMetadata('IMPORTED_ONLY'),
        observationsCount: 1,
        distinctDatesCount: 1,
        dateRange: { start: '2026-10-05', end: '2026-10-05' },
        observations: [
          createSampleObs('2026-10-05', 'GOLDM', 76500)
        ]
      };

      const res = service.restoreDatasetBackup(replacementBackup, { forceReplace: true });
      expect(res.success).toBe(true);

      const stored = service.getHistoricalData({ dataMode: 'IMPORTED_ONLY' });
      expect(stored[0].close).toBe(76500);
    });
  });

  describe('5. Provenance Isolation on Restore', () => {
    it('keeps restored imported data strictly isolated from prototype simulation records', () => {
      // Workspace initialized to prototype simulation (60 prototype records)
      const protoCount = service.getHistoricalData({ dataMode: 'PROTOTYPE_ONLY' }).length;
      expect(protoCount).toBeGreaterThan(0);

      // Restore a user-imported backup
      const importedBackup: DatasetBackupV1 = {
        version: '1.0',
        app: 'AUREX',
        exportedAt: new Date().toISOString(),
        provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
        metadata: service.getMetadata('PROTOTYPE_ONLY'),
        observationsCount: 2,
        distinctDatesCount: 1,
        dateRange: { start: '2026-10-05', end: '2026-10-05' },
        observations: [
          createSampleObs('2026-10-05', 'GOLDM', 75000),
          createSampleObs('2026-10-05', 'GOLDTEN', 74980)
        ]
      };

      const result = service.restoreDatasetBackup(importedBackup);
      expect(result.success).toBe(true);

      // Verify IMPORTED_ONLY contains only the 2 imported records
      const importedObs = service.getHistoricalData({ dataMode: 'IMPORTED_ONLY' });
      expect(importedObs).toHaveLength(2);
      expect(importedObs.every(o => o.provenance === 'USER-IMPORTED DATA — SOURCE UNVERIFIED')).toBe(true);

      // Verify PROTOTYPE_ONLY remains completely intact
      const protoObs = service.getHistoricalData({ dataMode: 'PROTOTYPE_ONLY' });
      expect(protoObs).toHaveLength(protoCount);
      expect(protoObs.every(o => o.provenance === 'PROTOTYPE SIMULATION')).toBe(true);
    });
  });
});
