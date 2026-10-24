import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import { marketDataService } from '../services/marketDataService';
import { calculateZScore, buildPairSpreadSeries } from '../engines/relativeValueEngine';
import { NormalizedObservation } from '../types/market';

describe('AUREX Historical Data Import Conflict & Provenance Isolation Audit', () => {
  // Authentic 24-record MCX Gold Futures CSV snippet for 05-Oct-2026
  const REAL_FILE_PATH_05 = 'C:/Users/HP/Downloads/BhavCopyDateWise_05102026.csv';

  const SAMPLE_05_OCT_CSV = [
    'Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close,Volume(Lots),Volume(In 000\'s),Value(Lacs),Open Interest(Lots)',
    '"05 Oct 2026","FUTCOM","GOLDM","05OCT2026","-","0","146867.00","147766.00","146626.00","146900.00","147729.00","151","15.100 GRMS ","2221.41","433"',
    '"05 Oct 2026","FUTCOM","GOLDM","05NOV2026","-","0","148167.00","148943.00","147629.00","148160.00","149055.00","31301","3130.100 GRMS ","464247.38","43249"',
    '"05 Oct 2026","FUTCOM","GOLDM","04DEC2026","-","0","149225.00","150221.00","148818.00","149315.00","150374.00","13286","1328.600 GRMS ","198694.14","14860"',
    '"05 Oct 2026","FUTCOM","GOLDM","05JAN2027","-","0","150664.00","151428.00","150141.00","150567.00","151629.00","1002","100.200 GRMS ","15099.83","3892"',
    '"05 Oct 2026","FUTCOM","GOLDM","05FEB2027","-","0","152118.00","152849.00","151612.00","151836.00","153150.00","384","38.400 GRMS ","5846.09","1840"',
    '"05 Oct 2026","FUTCOM","GOLDM","05MAR2027","-","0","153783.00","154196.00","153177.00","153425.00","154617.00","56","5.600 GRMS ","860.56","255"',
    '"05 Oct 2026","FUTCOM","GOLDTEN","30OCT2026","-","0","148889.00","149297.00","148037.00","148542.00","149436.00","18435","184.350 GRMS ","27413.98","31210"',
    '"05 Oct 2026","FUTCOM","GOLDTEN","30NOV2026","-","0","150297.00","150729.00","149319.00","149774.00","150834.00","10458","104.580 GRMS ","15690.04","16218"',
    '"05 Oct 2026","FUTCOM","GOLDTEN","31DEC2026","-","0","151600.00","151939.00","150721.00","151028.00","152128.00","2698","26.980 GRMS ","4081.90","7298"',
    '"05 Oct 2026","FUTCOM","GOLDTEN","29JAN2027","-","0","152645.00","153386.00","152122.00","152526.00","153611.00","568","5.680 GRMS ","867.30","3128"',
    '"05 Oct 2026","FUTCOM","GOLDTEN","26FEB2027","-","0","154287.00","154779.00","153600.00","153933.00","154910.00","187","1.870 GRMS ","288.11","799"',
    '"05 Oct 2026","FUTCOM","GOLDTEN","31MAR2027","-","0","155475.00","155811.00","154807.00","155419.00","155662.00","13","0.130 GRMS ","20.20","24"',
    '"05 Oct 2026","FUTCOM","GOLDGUINEA","30OCT2026","-","0","120078.00","120078.00","119000.00","119421.00","119993.00","7862","62.896 GRMS ","9394.32","13985"',
    '"05 Oct 2026","FUTCOM","GOLDGUINEA","30NOV2026","-","0","120783.00","121040.00","120100.00","120527.00","121147.00","2884","23.072 GRMS ","3478.75","7821"',
    '"05 Oct 2026","FUTCOM","GOLDGUINEA","31DEC2026","-","0","121906.00","122167.00","121262.00","121540.00","122171.00","813","6.504 GRMS ","989.80","3337"',
    '"05 Oct 2026","FUTCOM","GOLDGUINEA","29JAN2027","-","0","122801.00","123157.00","122373.00","122572.00","123222.00","172","1.376 GRMS ","211.07","1778"',
    '"05 Oct 2026","FUTCOM","GOLDGUINEA","26FEB2027","-","0","124000.00","124113.00","123280.00","123607.00","124072.00","72","0.576 GRMS ","89.04","460"',
    '"05 Oct 2026","FUTCOM","GOLDGUINEA","31MAR2027","-","0","124526.00","125040.00","124526.00","125040.00","125651.00","13","0.104 GRMS ","16.25","13"',
    '"05 Oct 2026","FUTCOM","GOLDPETAL","30OCT2026","-","0","14951.00","15002.00","14870.00","14921.00","15002.00","181337","181.337 GRMS ","27083.36","201786"',
    '"05 Oct 2026","FUTCOM","GOLDPETAL","30NOV2026","-","0","15104.00","15125.00","15004.00","15053.00","15138.00","62364","62.364 GRMS ","9398.25","119777"',
    '"05 Oct 2026","FUTCOM","GOLDPETAL","31DEC2026","-","0","15261.00","15263.00","15146.00","15187.00","15278.00","27427","27.427 GRMS ","4173.31","54929"',
    '"05 Oct 2026","FUTCOM","GOLDPETAL","29JAN2027","-","0","15446.00","15447.00","15300.00","15326.00","15423.00","5894","5.894 GRMS ","905.40","36812"',
    '"05 Oct 2026","FUTCOM","GOLDPETAL","26FEB2027","-","0","15402.00","15557.00","15402.00","15476.00","15561.00","1880","1.880 GRMS ","291.46","11936"',
    '"05 Oct 2026","FUTCOM","GOLDPETAL","31MAR2027","-","0","15645.00","15679.00","15598.00","15614.00","15693.00","827","0.827 GRMS ","129.28","600"'
  ].join('\n');

  function getCsvContent05(): string {
    if (fs.existsSync(REAL_FILE_PATH_05)) {
      return fs.readFileSync(REAL_FILE_PATH_05, 'utf8');
    }
    return SAMPLE_05_OCT_CSV;
  }

  beforeEach(() => {
    marketDataService.resetToSimulation();
    marketDataService.setActiveDataMode('ALL');
  });

  it('1. prototype-vs-imported conflict immunity: importing 05-Oct-2026 does not report conflicts against prototype simulation data', () => {
    const csvContent = getCsvContent05();
    const { parseResult, mergeAnalysis } = marketDataService.analyzeImportMerge(
      csvContent,
      'BhavCopyDateWise_05102026.csv'
    );

    expect(parseResult.validRecords).toHaveLength(24);
    // Crucial requirement: Must not report conflicts against prototype simulation records
    expect(mergeAnalysis.conflictingCount).toBe(0);
    expect(mergeAnalysis.conflictingObservations).toHaveLength(0);
    expect(mergeAnalysis.newlyInsertedCount).toBe(24);
    expect(mergeAnalysis.unchangedDuplicatesCount).toBe(0);
    expect(mergeAnalysis.projectedTotalRecords).toBe(434 + 24);
    expect(mergeAnalysis.isAccumulating).toBe(true);

    // Import must succeed without forceReplace
    const importResult = marketDataService.importFromCsv(csvContent, 'BhavCopyDateWise_05102026.csv');
    expect(importResult.validRecords).toHaveLength(24);

    // Total stored observations in ALL mode must be 458
    expect(marketDataService.getHistoricalData({ dataMode: 'ALL' })).toHaveLength(458);
  });

  it('2. provenance isolation: prototype simulation records remain intact and untouched after user import', () => {
    const csvContent = getCsvContent05();
    marketDataService.importFromCsv(csvContent, 'BhavCopyDateWise_05102026.csv');

    // PROTOTYPE_ONLY must have exactly 434 records, untouched
    const protoData = marketDataService.getHistoricalData({ dataMode: 'PROTOTYPE_ONLY' });
    expect(protoData).toHaveLength(434);
    expect(protoData.every(o => o.provenance === 'PROTOTYPE SIMULATION')).toBe(true);

    // Prototype records for 2026-10-05 still exist with their original simulated prices (~74000)
    const proto05 = protoData.filter(o => o.date === '2026-10-05');
    expect(proto05.length).toBeGreaterThan(0);
    const protoGoldM = proto05.find(o => o.symbol === 'GOLDM' && o.expiryDate === '2026-11-05');
    expect(protoGoldM).toBeDefined();
    expect(protoGoldM?.provenance).toBe('PROTOTYPE SIMULATION');
    expect(protoGoldM?.close).toBeLessThan(100000); // Simulated price is ~74000, not 148160

    // IMPORTED_ONLY must have exactly the 24 imported records with authentic prices
    const impData = marketDataService.getHistoricalData({ dataMode: 'IMPORTED_ONLY' });
    expect(impData).toHaveLength(24);
    expect(impData.every(o => o.provenance === 'USER-IMPORTED DATA — SOURCE UNVERIFIED')).toBe(true);
    expect(impData.every(o => o.date === '2026-10-05')).toBe(true);

    const impGoldM = impData.find(o => o.symbol === 'GOLDM' && o.expiryDate === '2026-11-05');
    expect(impGoldM).toBeDefined();
    expect(impGoldM?.close).toBe(148160.00); // Authentic MCX Bhavcopy price
  });

  it('3. duplicate imports remain idempotent within imported provenance', () => {
    const csvContent = getCsvContent05();
    // First import
    marketDataService.importFromCsv(csvContent, 'BhavCopyDateWise_05102026.csv');
    expect(marketDataService.getHistoricalData({ dataMode: 'ALL' })).toHaveLength(458);

    // Analyze re-import of the exact same file
    const { mergeAnalysis } = marketDataService.analyzeImportMerge(
      csvContent,
      'BhavCopyDateWise_05102026.csv'
    );
    expect(mergeAnalysis.conflictingCount).toBe(0);
    expect(mergeAnalysis.unchangedDuplicatesCount).toBe(24);
    expect(mergeAnalysis.newlyInsertedCount).toBe(0);
    expect(mergeAnalysis.projectedTotalRecords).toBe(458);

    // Perform re-import
    marketDataService.importFromCsv(csvContent, 'BhavCopyDateWise_05102026.csv');
    expect(marketDataService.getHistoricalData({ dataMode: 'ALL' })).toHaveLength(458);
    expect(marketDataService.getHistoricalData({ dataMode: 'IMPORTED_ONLY' })).toHaveLength(24);
  });

  it('4. same-source conflict protection: divergent prices on an already imported contract are detected and blocked', () => {
    const csvContent = getCsvContent05();
    marketDataService.importFromCsv(csvContent, 'BhavCopyDateWise_05102026.csv');

    // Create conflicting CSV with modified valid OHLC prices for GOLDM 05NOV2026
    const conflictingCsv = csvContent.replace(
      '"148943.00","147629.00","148160.00"',
      '"205000.00","147629.00","199999.00"'
    );

    const { mergeAnalysis } = marketDataService.analyzeImportMerge(
      conflictingCsv,
      'BhavCopyDateWise_05102026_divergent.csv'
    );

    // Must detect conflict against the existing user-imported record!
    expect(mergeAnalysis.conflictingCount).toBe(1);
    expect(mergeAnalysis.conflictingObservations).toHaveLength(1);
    expect(mergeAnalysis.conflictingObservations[0].symbol).toBe('GOLDM');
    expect(mergeAnalysis.conflictingObservations[0].date).toBe('2026-10-05');
    expect(mergeAnalysis.conflictingObservations[0].difference).toContain('Close ₹148160 vs ₹199999');

    // Attempting import without forceReplace must throw
    expect(() => {
      marketDataService.importFromCsv(conflictingCsv, 'BhavCopyDateWise_05102026_divergent.csv');
    }).toThrow(/Import conflict: Detected 1 conflicting observation/);
  });

  it('5. mode switching and statistical baseline isolation in ALL mode', () => {
    const csvContent = getCsvContent05();
    marketDataService.importFromCsv(csvContent, 'BhavCopyDateWise_05102026.csv');

    // Check metadata in each mode
    const metaAll = marketDataService.getMetadata('ALL');
    expect(metaAll.validRows).toBe(458);
    expect(metaAll.totalRows).toBe(458);

    const metaProto = marketDataService.getMetadata('PROTOTYPE_ONLY');
    expect(metaProto.validRows).toBe(434);

    const metaImp = marketDataService.getMetadata('IMPORTED_ONLY');
    expect(metaImp.validRows).toBe(24);
    expect(metaImp.dateRange.start).toBe('2026-10-05');
    expect(metaImp.dateRange.end).toBe('2026-10-05');

    // On 2026-10-05 in ALL mode, getObservationsForDate should return imported observations
    const obs05All = marketDataService.getObservationsForDate('2026-10-05', 'ALL');
    expect(obs05All).toHaveLength(24);
    expect(obs05All.every(o => o.provenance === 'USER-IMPORTED DATA — SOURCE UNVERIFIED')).toBe(true);

    // On 2026-10-05 in PROTOTYPE_ONLY mode, it returns prototype observations
    const obs05Proto = marketDataService.getObservationsForDate('2026-10-05', 'PROTOTYPE_ONLY');
    expect(obs05Proto.length).toBeGreaterThan(0);
    expect(obs05Proto.every(o => o.provenance === 'PROTOTYPE SIMULATION')).toBe(true);

    // Statistical isolation: calculateZScore on ALL mode for 2026-10-05 does not mix prototype baselines
    const normAll = marketDataService.getNormalizedHistoricalData({ dataMode: 'ALL' });
    const seriesA = normAll.filter(o => o.symbol === 'GOLDM');
    const seriesB = normAll.filter(o => o.symbol === 'GOLDTEN');
    const pairSpreads = buildPairSpreadSeries(seriesA, seriesB, 'GOLDM', 'GOLDTEN');

    // Target point on 2026-10-05 is user-imported
    const point05 = pairSpreads.find(p => p.date === '2026-10-05');
    expect(point05).toBeDefined();
    expect(point05?.provenanceA).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');

    const targetIdx = pairSpreads.findIndex(p => p.date === '2026-10-05');
    const spreadsUpTo05 = pairSpreads.slice(0, targetIdx + 1);
    const zResult = calculateZScore(spreadsUpTo05, 20);
    expect(zResult.calibrationProvenance).toBe('USER-IMPORTED DATA — SOURCE UNVERIFIED');
    expect(zResult.calibrationObservationCount).toBe(1);
    expect(zResult.isCalculable).toBe(false);
    expect(zResult.incalculableReason).toContain('Statistical calibration cannot cross provenance boundary');
  });
});
