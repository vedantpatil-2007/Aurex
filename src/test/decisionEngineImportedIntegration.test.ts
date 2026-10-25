import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { marketDataService } from '../services/marketDataService';
import { buildPairSpreadSeries, calculateZScore, getContemporaneousPairSpread, isSameProvenanceFamily } from '../engines/relativeValueEngine';
import { evaluateDecision } from '../engines/decisionEngine';
import { normalizeObservation } from '../engines/normalizationEngine';
import { MarketObservation } from '../types/market';

describe('Decision Engine Imported Dataset Integration & Provenance Isolation', () => {
  beforeEach(() => {
    marketDataService.resetToSimulation();
  });

  // Helper to generate a realistic 60-session imported dataset
  function generate60SessionImportedDataset(): MarketObservation[] {
    const observations: MarketObservation[] = [];
    const baseDate = new Date('2026-07-31');
    const tradingDates: string[] = [];

    let cur = new Date(baseDate);
    while (tradingDates.length < 60) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) {
        tradingDates.push(cur.toISOString().split('T')[0]);
      }
      cur.setDate(cur.getDate() + 1);
    }

    const symbols = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'] as const;
    const expiries = ['2026-11-05', '2026-11-30', '2026-12-31'];

    tradingDates.forEach((date, dateIdx) => {
      symbols.forEach((symbol, symIdx) => {
        expiries.forEach((expiry, expIdx) => {
          const baseClose = 145000 + dateIdx * 100 + symIdx * 200 + expIdx * 50;
          observations.push({
            date,
            symbol,
            expiryDate: expiry,
            open: baseClose - 50,
            high: baseClose + 100,
            low: baseClose - 100,
            close: baseClose,
            volume: 5000 + symIdx * 1000 + expIdx * 200,
            openInterest: 10000 + symIdx * 2000,
            provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
            sourceFile: `BhavCopyDateWise_${date.replace(/-/g, '')}.csv`,
            sourceSha256: `hash_${date}`
          });
        });
      });
    });

    return observations;
  }

  it('1. reflects 60-session imported dataset with accurate filename and provenance in IMPORTED_ONLY mode', () => {
    // Try to load real user backup from Downloads if available, else use generated 60-session dataset
    const dlDir = 'C:/Users/HP/Downloads';
    let loadedFromRealBackup = false;

    if (fs.existsSync(dlDir)) {
      const files = fs.readdirSync(dlDir);
      const backupFile = files.find(f => f.includes('1440obs') && f.endsWith('.json'));
      if (backupFile) {
        const rawBackup = fs.readFileSync(path.join(dlDir, backupFile), 'utf8');
        const res = marketDataService.restoreDatasetBackup(rawBackup);
        expect(res.success).toBe(true);
        loadedFromRealBackup = true;
      }
    }

    if (!loadedFromRealBackup) {
      const obs60 = generate60SessionImportedDataset();
      const backupPayload = JSON.stringify({
        version: '1.0',
        app: 'AUREX',
        exportedAt: '2026-10-25T12:00:00.000Z',
        sourceMode: 'IMPORTED_ONLY',
        provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
        metadata: {
          filename: 'BhavCopyDateWise_batch.csv',
          fileHashSha256: 'mock_sha256',
          sourceFiles: [{ filename: 'BhavCopyDateWise_batch.csv', fileHashSha256: 'mock_sha256' }]
        },
        observationsCount: obs60.length,
        observations: obs60
      });
      const res = marketDataService.restoreDatasetBackup(backupPayload);
      expect(res.success).toBe(true);
    }

    // Inspect metadata under IMPORTED_ONLY mode
    const importedMeta = marketDataService.getMetadata('IMPORTED_ONLY');
    expect(importedMeta.provenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
    expect(importedMeta.filename).not.toBe('seed_prototype_simulation.internal');
    expect(importedMeta.filename).toContain('BhavCopyDateWise');
    expect(importedMeta.validRows).toBeGreaterThanOrEqual(720);

    // Inspect available dates under IMPORTED_ONLY mode
    const importedDates = marketDataService.getAvailableDates('IMPORTED_ONLY');
    expect(importedDates.length).toBeGreaterThanOrEqual(60);
    const latestDate = importedDates[importedDates.length - 1];
    expect(latestDate >= '2026-10-23').toBe(true);

    // Inspect metadata under PROTOTYPE_ONLY mode (strict isolation)
    const protoMeta = marketDataService.getMetadata('PROTOTYPE_ONLY');
    expect(protoMeta.provenance).toBe('PROTOTYPE SIMULATION');
    expect(protoMeta.filename).toBe('seed_prototype_simulation.internal');
    const protoDates = marketDataService.getAvailableDates('PROTOTYPE_ONLY');
    expect(protoDates[protoDates.length - 1]).toBe('2026-10-08');
  });

  it('2. aligns pair spread series dynamically across imported trading dates to the latest valuation date', () => {
    // Ingest 60 sessions
    const dlDir = 'C:/Users/HP/Downloads';
    let loadedFromRealBackup = false;

    if (fs.existsSync(dlDir)) {
      const files = fs.readdirSync(dlDir);
      const backupFile = files.find(f => f.includes('1440obs') && f.endsWith('.json'));
      if (backupFile) {
        const rawBackup = fs.readFileSync(path.join(dlDir, backupFile), 'utf8');
        marketDataService.restoreDatasetBackup(rawBackup);
        loadedFromRealBackup = true;
      }
    }

    if (!loadedFromRealBackup) {
      const obs60 = generate60SessionImportedDataset();
      const backupPayload = JSON.stringify({
        version: '1.0',
        app: 'AUREX',
        exportedAt: '2026-10-25T12:00:00.000Z',
        sourceMode: 'IMPORTED_ONLY',
        provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
        metadata: {
          filename: 'BhavCopyDateWise_batch.csv',
          fileHashSha256: 'mock_sha256',
          sourceFiles: [{ filename: 'BhavCopyDateWise_batch.csv', fileHashSha256: 'mock_sha256' }]
        },
        observationsCount: obs60.length,
        observations: obs60
      });
      marketDataService.restoreDatasetBackup(backupPayload);
    }

    const availableDates = marketDataService.getAvailableDates('IMPORTED_ONLY');
    const latestDate = availableDates[availableDates.length - 1];

    const normObs = marketDataService.getNormalizedHistoricalData({ dataMode: 'IMPORTED_ONLY' });
    const asOfNorm = normObs.filter(o => o.date <= latestDate);

    const seriesA = asOfNorm.filter(o => o.symbol === 'GOLDM');
    const seriesB = asOfNorm.filter(o => o.symbol === 'GOLDTEN');

    const spreadSeries = buildPairSpreadSeries(seriesA, seriesB, 'GOLDM', 'GOLDTEN');
    expect(spreadSeries.length).toBeGreaterThanOrEqual(60);

    // Ensure all points in the series share imported provenance
    spreadSeries.forEach(point => {
      expect(point.provenanceA).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
      expect(point.provenanceB).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
    });

    // Statistical dispersion should be calculable with 60 sessions
    const zAnalysis = calculateZScore(spreadSeries, 20);
    expect(zAnalysis.isCalculable).toBe(true);
    expect(zAnalysis.incalculableReason).toBeUndefined();

    // Evaluate Decision Engine As-Of latest imported date
    const latestSpread = spreadSeries[spreadSeries.length - 1].spread;
    expect(Math.abs(latestSpread)).toBeGreaterThan(0);

    const latestObs = marketDataService.getLatestObservations(latestDate, 'IMPORTED_ONLY');
    const decision = evaluateDecision({
      pair: ['GOLDM', 'GOLDTEN'],
      observedSpread: latestSpread,
      volA: latestObs['GOLDM']?.volume || 0,
      oiA: latestObs['GOLDM']?.openInterest || 0,
      volB: latestObs['GOLDTEN']?.volume || 0,
      oiB: latestObs['GOLDTEN']?.openInterest || 0,
      friction: {
        slippagePer10g: 25,
        brokerageTaxesPer10g: 35,
        liquidityHaircutPer10g: 15,
        costBufferPer10g: 20,
        liquidityThresholdScore: 50
      },
      isCalculable: zAnalysis.isCalculable,
      incalculableReason: zAnalysis.incalculableReason,
      hasSpreadData: spreadSeries.length > 0
    });

    expect(decision.expectedEdge).toBe(Math.abs(latestSpread));
    expect(decision.decision).not.toBe('NO TRADE (Spread series is empty)');
  });

  it('3. does not silently use prototype data when one leg is missing in imported data on a date', () => {
    // Construct single date where Leg A has imported data but Leg B only has prototype data
    const hybridObsA: MarketObservation[] = [
      {
        date: '2026-10-21',
        symbol: 'GOLDM',
        expiryDate: '2026-11-05',
        open: 74000,
        high: 74200,
        low: 73900,
        close: 74100,
        volume: 10000,
        openInterest: 20000,
        provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
        sourceFile: 'import_leg_a.csv',
        sourceSha256: 'shaA'
      }
    ];

    const hybridObsB: MarketObservation[] = [
      {
        date: '2026-10-21',
        symbol: 'GOLDTEN',
        expiryDate: '2026-11-27',
        open: 74050,
        high: 74250,
        low: 73950,
        close: 74150,
        volume: 5000,
        openInterest: 10000,
        provenance: 'PROTOTYPE SIMULATION',
        sourceFile: 'seed_prototype_simulation.internal',
        sourceSha256: 'shaB'
      }
    ];

    const normA = hybridObsA.map(o => normalizeObservation(o));
    const normB = hybridObsB.map(o => normalizeObservation(o));

    // Build spread series: should NOT cross provenance or silently use prototype for leg B
    const spreadPoints = buildPairSpreadSeries(normA, normB, 'GOLDM', 'GOLDTEN');
    expect(spreadPoints).toHaveLength(0);
  });

  it('4. provides explicit institutional explanation when pair spread data is absent', () => {
    // When no spread data exists
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
      hasSpreadData: false,
      isCalculable: false,
      incalculableReason: 'Spread series is empty'
    });

    expect(decision.decision).toBe('NO TRADE');
    expect(decision.rationale).toContain('Contemporaneous market data is unavailable for contract pair GOLDM / GOLDTEN');
    expect(decision.rationale).toContain('Capital preserved');
    expect(decision.triggerRules[0]).toContain('Data Availability Gate: No contemporaneous observations exist for GOLDM / GOLDTEN');
  });

  it('5. getContemporaneousPairSpread strictly evaluates contemporaneous prices and provides truthful missing-leg explanations', () => {
    const obsList: MarketObservation[] = [
      {
        date: '2026-10-23',
        symbol: 'GOLDM',
        expiryDate: '2026-11-05',
        open: 78000,
        high: 78500,
        low: 77900,
        close: 78200,
        volume: 12000,
        openInterest: 25000,
        provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
        sourceFile: 'BhavCopyDateWise_23102026.csv',
        sourceSha256: 'sha23'
      },
      {
        date: '2026-10-23',
        symbol: 'GOLDTEN',
        expiryDate: '2026-11-30',
        open: 78100,
        high: 78600,
        low: 78000,
        close: 78350,
        volume: 8000,
        openInterest: 18000,
        provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
        sourceFile: 'BhavCopyDateWise_23102026.csv',
        sourceSha256: 'sha23'
      }
    ];

    const normObs = obsList.map(o => normalizeObservation(o));

    // When both legs are present on valuation date
    expect(isSameProvenanceFamily('USER-IMPORTED DATA — SOURCE UNVERIFIED', 'USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED')).toBe(true);
    expect(isSameProvenanceFamily('PROTOTYPE SIMULATION', 'USER-IMPORTED DATA — SOURCE UNVERIFIED')).toBe(false);

    const res = getContemporaneousPairSpread(normObs, 'GOLDM', 'GOLDTEN', '2026-10-23');
    expect(res.isContemporaneous).toBe(true);
    expect(res.priceA).toBeCloseTo(78514.37, 2);
    expect(res.priceB).toBeCloseTo(78350.00, 2);
    expect(res.spread).toBeCloseTo(164.37, 2);
    expect(res.reason).toBeUndefined();

    // When Leg B is missing on valuation date
    const resMissingB = getContemporaneousPairSpread(normObs.filter(o => o.symbol === 'GOLDM'), 'GOLDM', 'GOLDTEN', '2026-10-23');
    expect(resMissingB.isContemporaneous).toBe(false);
    expect(resMissingB.reason).toContain('Missing observations for Leg B (GOLDTEN) on trading date 2026-10-23');

    // When no observations exist on date
    const resNoDate = getContemporaneousPairSpread(normObs, 'GOLDM', 'GOLDTEN', '2026-10-24');
    expect(resNoDate.isContemporaneous).toBe(false);
    expect(resNoDate.reason).toContain('No market observations exist');
  });

  it('6. preserves prototype simulation observations in memory so PROTOTYPE_ONLY mode remains intact after backup restore', () => {
    // Ingest imported records
    const obs60 = generate60SessionImportedDataset();
    const backupPayload = JSON.stringify({
      version: '1.0',
      app: 'AUREX',
      exportedAt: '2026-10-25T12:00:00.000Z',
      sourceMode: 'IMPORTED_ONLY',
      provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
      metadata: {
        filename: 'BhavCopyDateWise_batch.csv',
        fileHashSha256: 'mock_sha256',
        sourceFiles: [{ filename: 'BhavCopyDateWise_batch.csv', fileHashSha256: 'mock_sha256' }]
      },
      observationsCount: obs60.length,
      observations: obs60
    });

    marketDataService.restoreDatasetBackup(backupPayload);

    // Verify PROTOTYPE_ONLY mode still has prototype data
    const protoObs = marketDataService.getHistoricalData({ dataMode: 'PROTOTYPE_ONLY' });
    expect(protoObs.length).toBeGreaterThan(0);
    expect(protoObs.every(o => o.provenance === 'PROTOTYPE SIMULATION')).toBe(true);

    const protoDates = marketDataService.getAvailableDates('PROTOTYPE_ONLY');
    expect(protoDates.length).toBeGreaterThan(0);
    expect(protoDates[protoDates.length - 1]).toBe('2026-10-08');

    // Verify IMPORTED_ONLY mode has imported data
    const importedObs = marketDataService.getHistoricalData({ dataMode: 'IMPORTED_ONLY' });
    expect(importedObs.length).toBe(obs60.length);
    expect(importedObs.every(o => o.provenance === 'USER-IMPORTED DATA — SOURCE UNVERIFIED')).toBe(true);

    const importedDates = marketDataService.getAvailableDates('IMPORTED_ONLY');
    expect(importedDates.length).toBe(60);
    expect(importedDates[importedDates.length - 1]).toBe('2026-10-22');
  });

  it('7. reflects truthful metadata filename and avoids generic custom_bhavcopy.csv fallback', () => {
    const metaProto = marketDataService.getMetadata('PROTOTYPE_ONLY');
    expect(metaProto.filename).toBe('seed_prototype_simulation.internal');

    // Ingest sample imported records with custom Bhavcopy filenames
    const obs60 = generate60SessionImportedDataset();
    const backupPayload = JSON.stringify({
      version: '1.0',
      app: 'AUREX',
      exportedAt: '2026-10-25T12:00:00.000Z',
      sourceMode: 'IMPORTED_ONLY',
      provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
      metadata: {
        filename: 'BhavCopyDateWise_batch.csv',
        fileHashSha256: 'mock_sha256',
        sourceFiles: [{ filename: 'BhavCopyDateWise_batch.csv', fileHashSha256: 'mock_sha256' }]
      },
      observationsCount: obs60.length,
      observations: obs60
    });
    marketDataService.restoreDatasetBackup(backupPayload);

    const metaImport = marketDataService.getMetadata('IMPORTED_ONLY');
    expect(metaImport.filename).not.toBe('custom_bhavcopy.csv');
    expect(metaImport.filename).not.toBe('seed_prototype_simulation.internal');
    expect(metaImport.filename).toContain('BhavCopyDateWise');
  });
});
