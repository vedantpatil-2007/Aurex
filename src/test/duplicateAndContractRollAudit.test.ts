import { describe, it, expect, beforeEach } from 'vitest';
import { MarketDataService } from '../services/marketDataService';
import { runWalkForwardBacktest } from '../engines/backtestEngine';
import { buildPairSpreadSeries } from '../engines/relativeValueEngine';
import { validateMarketData } from '../utils/dataQuality';
import { normalizeObservation } from '../engines/normalizationEngine';
import { NormalizedObservation, ContractSymbol, DataProvenance } from '../types/market';

function makeObs(params: {
  date: string;
  symbol: ContractSymbol;
  expiryDate: string;
  close: number;
  volume: number;
  openInterest: number;
  provenance?: DataProvenance;
}): NormalizedObservation {
  return normalizeObservation({
    date: params.date,
    symbol: params.symbol,
    expiryDate: params.expiryDate,
    open: params.close,
    high: params.close,
    low: params.close,
    close: params.close,
    volume: params.volume,
    openInterest: params.openInterest,
    provenance: params.provenance ?? 'USER-IMPORTED DATA — SOURCE UNVERIFIED'
  });
}

describe('Duplicate Data Integrity & Contract-Roll Backtest Audit', () => {
  let service: MarketDataService;

  beforeEach(() => {
    service = new MarketDataService();
    service.resetToSimulation();
  });

  describe('1. Duplicate Data Integrity Audit', () => {
    it('confirms active dataset contains zero duplicate contract/date observations', () => {
      const observations = service.getHistoricalData();
      const report = validateMarketData(observations);

      expect(report.status).toBe('PASS');
      const uniquenessCheck = report.checks.find(c => c.name === 'Record Uniqueness');
      expect(uniquenessCheck).toBeDefined();
      expect(uniquenessCheck?.passed).toBe(true);
      expect(uniquenessCheck?.details).toContain('Zero duplicate');

      // Double-check manually with Set
      const seenKeys = new Set<string>();
      for (const obs of observations) {
        const key = `${obs.symbol}_${obs.date}_${obs.expiryDate}_${obs.provenance}`;
        expect(seenKeys.has(key)).toBe(false);
        seenKeys.add(key);
      }
    });

    it('isolates duplicateCount so PROTOTYPE_ONLY reports 0 and skipped duplicates do not corrupt storage', () => {
      const protoMeta = service.getMetadata('PROTOTYPE_ONLY');
      expect(protoMeta.duplicateCount).toBe(0);

      // Construct a single 24-row CSV representing one daily Bhavcopy file
      const headers = 'INSTRUMENT,SYMBOL,EXPIRY_DT,STRIKE_PR,OPTION_TYP,OPEN,HIGH,LOW,CLOSE,SETTLE_PR,CONTRACTS,VAL_INLAKH,OPEN_INT,CHG_IN_OI,TIMESTAMP';
      const sampleRow = (sym: string, exp: string, pr: number) =>
        `FUTCOM,${sym},${exp},,,${pr},${pr + 10},${pr - 10},${pr},${pr},500,200.0,1000,50,05-OCT-2026`;

      const expiries = ['05-NOV-2026', '05-DEC-2026', '05-FEB-2027', '05-APR-2027', '05-JUN-2027', '05-AUG-2027'];
      const symbols: ContractSymbol[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'];
      const rows: string[] = [headers];
      for (const sym of symbols) {
        for (const exp of expiries) {
          rows.push(sampleRow(sym, exp, 75000));
        }
      }
      const csvContent = rows.join('\n'); // Exactly 24 valid futures records

      // First ingestion: 24 new records inserted
      const firstImport = service.importFromCsv(csvContent, 'BhavCopyDateWise_05102026.csv');
      expect(firstImport.validRecords.length).toBe(24);
      expect(firstImport.mergeAnalysis?.unchangedDuplicatesCount).toBe(0);
      expect(firstImport.mergeAnalysis?.newlyInsertedCount).toBe(24);

      // Re-importing the same 24 records: exactly 24 duplicates detected and skipped
      const secondImport = service.importFromCsv(csvContent, 'BhavCopyDateWise_05102026.csv');
      expect(secondImport.mergeAnalysis?.unchangedDuplicatesCount).toBe(24);
      expect(secondImport.mergeAnalysis?.newlyInsertedCount).toBe(0);

      // Third import of same file: another 24 duplicates detected and skipped (cumulative 48)
      const thirdImport = service.importFromCsv(csvContent, 'BhavCopyDateWise_05102026.csv');
      expect(thirdImport.mergeAnalysis?.unchangedDuplicatesCount).toBe(24);

      // Fourth import: another 24 duplicates skipped -> 3 duplicate re-imports * 24 = 72 skipped duplicates!
      const fourthImport = service.importFromCsv(csvContent, 'BhavCopyDateWise_05102026.csv');
      expect(fourthImport.mergeAnalysis?.unchangedDuplicatesCount).toBe(24);

      // Verify metadata in IMPORTED_ONLY mode
      const importedMeta = service.getMetadata('IMPORTED_ONLY');
      expect(importedMeta.duplicateCount).toBe(72); // Exactly 72 skipped duplicates tracked
      expect(importedMeta.validRows).toBe(24);       // Stored valid rows remains exactly 24!

      // Confirm no duplicates leaked into the imported dataset
      const importedObs = service.getHistoricalData({ dataMode: 'IMPORTED_ONLY' });
      expect(importedObs.length).toBe(24);
      const postReport = validateMarketData(importedObs);
      const postUniqueness = postReport.checks.find(c => c.name === 'Record Uniqueness');
      expect(postUniqueness?.passed).toBe(true);
    });
  });

  describe('2. Contract Selection & Multi-Expiry Backtest Alignment', () => {
    it('selects active liquid near-month contract deterministically and avoids far-month spread spikes', () => {
      // Create multi-expiry observations for GOLDM and GOLDTEN on 20 dates
      const dates = [
        '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07',
        '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14',
        '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21',
        '2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28'
      ];

      const multiExpiryObs: NormalizedObservation[] = [];

      for (const d of dates) {
        // Near-month liquid contract (Nov 2026) - volume 30,000, realistic base price
        const normM_Nov = makeObs({
          date: d,
          symbol: 'GOLDM',
          expiryDate: '2026-11-05',
          close: 75000,
          volume: 30000,
          openInterest: 15000
        });
        const normTEN_Nov = makeObs({
          date: d,
          symbol: 'GOLDTEN',
          expiryDate: '2026-11-05',
          close: 74980,
          volume: 25000,
          openInterest: 12000
        });

        // Far-month illiquid contract (Mar 2027) - volume 50, contango price higher by ₹5,000
        const normM_Mar = makeObs({
          date: d,
          symbol: 'GOLDM',
          expiryDate: '2027-03-05',
          close: 80200,
          volume: 50,
          openInterest: 300
        });
        const normTEN_Mar = makeObs({
          date: d,
          symbol: 'GOLDTEN',
          expiryDate: '2027-03-05',
          close: 80190,
          volume: 40,
          openInterest: 250
        });

        // Push in arbitrary order (far month last, which would overwrite if naive map was used)
        multiExpiryObs.push(normM_Nov, normTEN_Nov, normM_Mar, normTEN_Mar);
      }

      const seriesM = multiExpiryObs.filter(o => o.symbol === 'GOLDM');
      const seriesTEN = multiExpiryObs.filter(o => o.symbol === 'GOLDTEN');

      // 1. Check relativeValueEngine spread calculation
      const rvSeries = buildPairSpreadSeries(seriesM, seriesTEN, 'GOLDM', 'GOLDTEN');
      expect(rvSeries.length).toBe(dates.length);
      expect(rvSeries[0].spread).toBe(321.51);
      expect(rvSeries[0].expiryA).toBe('2026-11-05');
      expect(rvSeries[0].expiryB).toBe('2026-11-05');

      // 2. Check backtestEngine selection
      const backtestResult = runWalkForwardBacktest(multiExpiryObs, {
        pair: ['GOLDM', 'GOLDTEN'],
        warmUpDays: 10,
        zScoreEntryThreshold: 2.0,
        zScoreExitThreshold: 0.5
      });

      // Spread series evaluated in backtest matches dates count
      expect(backtestResult.evaluatedDates).toBe(dates.length);

      // Since spread is stable at 321.51 across all dates, Z-score is 0, so NO false dislocation trades should trigger
      expect(backtestResult.acceptedTrades).toBe(0);
      expect(backtestResult.netPnL).toBe(0);
    });
  });

  describe('3. Contract Rollover & P&L Integrity Audit', () => {
    it('prevents artificial contango jumps from inflating or deflating P&L when contracts roll', () => {
      // Scenario:
      // Day 1 to 15: Warm-up period with normal spread ~321.51 (Nov 2026 contracts)
      // Day 16: Spread dislocates to 421.91 (SHORT_SPREAD: Sell Leg A @ 75100, Buy Leg B @ 74980)
      // Day 17: Contract rolls! Active benchmark becomes Dec contract with close = 75900 (+800 contango)
      // BUT Nov contract also traded on Day 17 at close = 75020 (reverting spread)
      // Backtest must NOT compare Dec price against Nov entry price!
      const testObs: NormalizedObservation[] = [];

      // Days 1-15: Normal calibration
      for (let i = 1; i <= 15; i++) {
        const d = `2026-10-${i.toString().padStart(2, '0')}`;
        testObs.push(
          makeObs({
            date: d,
            symbol: 'GOLDM',
            expiryDate: '2026-11-05',
            close: 75000,
            volume: 20000,
            openInterest: 10000
          }),
          makeObs({
            date: d,
            symbol: 'GOLDTEN',
            expiryDate: '2026-11-05',
            close: 74980,
            volume: 18000,
            openInterest: 9000
          })
        );
      }

      // Day 16: Dislocation (Spread jumps to 421.91 -> Z-score > 2.0 triggers SHORT_SPREAD)
      testObs.push(
        makeObs({
          date: '2026-10-16',
          symbol: 'GOLDM',
          expiryDate: '2026-11-05',
          close: 75100,
          volume: 25000,
          openInterest: 12000
        }),
        makeObs({
          date: '2026-10-16',
          symbol: 'GOLDTEN',
          expiryDate: '2026-11-05',
          close: 74980,
          volume: 22000,
          openInterest: 11000
        })
      );

      // Day 17: Contract rolls! Active benchmark becomes Dec contract with close = 75900 (+800 contango)
      // Held Nov contracts also traded on Day 17:
      testObs.push(
        makeObs({
          date: '2026-10-17',
          symbol: 'GOLDM',
          expiryDate: '2026-11-05',
          close: 75020,
          volume: 5000,
          openInterest: 2000
        }),
        makeObs({
          date: '2026-10-17',
          symbol: 'GOLDTEN',
          expiryDate: '2026-11-05',
          close: 75000,
          volume: 4000,
          openInterest: 1800
        }),
        // New active Dec contracts on Day 17 (higher volume, higher contango price):
        makeObs({
          date: '2026-10-17',
          symbol: 'GOLDM',
          expiryDate: '2026-12-05',
          close: 75900,
          volume: 35000,
          openInterest: 20000
        }),
        makeObs({
          date: '2026-10-17',
          symbol: 'GOLDTEN',
          expiryDate: '2026-12-05',
          close: 75880,
          volume: 30000,
          openInterest: 18000
        })
      );

      const result = runWalkForwardBacktest(testObs, {
        pair: ['GOLDM', 'GOLDTEN'],
        warmUpDays: 15,
        zScoreEntryThreshold: 2.0,
        zScoreExitThreshold: 0.5
      });

      expect(result.acceptedTrades).toBe(1);
      const trade = result.trades[0];
      expect(trade.status).toBe('CLOSED');
      expect(trade.exitReason).toBe('CONTRACT_ROLLOVER');
      expect(trade.expiryA).toBe('2026-11-05');
      expect(trade.expiryB).toBe('2026-11-05');

      // The exit price MUST be taken from the Nov contract (normalized 75321.59 and 75000),
      // NOT from the Dec contract (normalized 76205.23 and 75880)!
      expect(trade.exitPriceA).toBe(75321.59);
      expect(trade.exitPriceB).toBe(75000);

      // Short Leg A (GOLDM): entry 75401.91, exit 75321.59 -> gain of 80.32/10g * 10 units = ₹803.20
      // Long Leg B (GOLDTEN): entry 74980.00, exit 75000.00 -> gain of 20.00/10g * 10 units = ₹200.00
      // Total Gross P&L: 803.20 + 200.00 = ₹1,003.20
      expect(trade.legAPnL).toBe(803.2);
      expect(trade.legBPnL).toBe(200);
      expect(trade.grossPnL).toBe(1003.2);

      // Accounting identities
      expect(trade.netPnL).toBe(Number((trade.grossPnL - trade.totalFriction).toFixed(2)));
      expect(trade.grossPnL).toBe(Number((trade.legAPnL! + trade.legBPnL!).toFixed(2)));

      // Economic attribution
      expect(trade.attribution?.executionFriction).toBe(-trade.totalFriction);
      expect(trade.attribution?.goldMarketBetaPnL).toBe(0); // 1:1 hedged
      expect(trade.attribution?.relativeValueAlphaPnL).toBe(trade.grossPnL);
    });

    it('forces trade closure when held contract enters physical tender delivery window', () => {
      // If a trade is held and days-to-expiry <= 5 (tender window for MCX gold),
      // it must force exit with TENDER_WINDOW_FORCED_EXIT
      const testObs: NormalizedObservation[] = [];

      // Warm-up: 10 days
      for (let i = 1; i <= 10; i++) {
        const d = `2026-10-${i.toString().padStart(2, '0')}`;
        testObs.push(
          makeObs({
            date: d,
            symbol: 'GOLDM',
            expiryDate: '2026-10-20',
            close: 75000,
            volume: 10000,
            openInterest: 5000
          }),
          makeObs({
            date: d,
            symbol: 'GOLDTEN',
            expiryDate: '2026-10-20',
            close: 74980,
            volume: 10000,
            openInterest: 5000
          })
        );
      }

      // Day 11: Dislocation -> Entry (daysToExpiry = 9 > 5, so eligible)
      testObs.push(
        makeObs({
          date: '2026-10-11',
          symbol: 'GOLDM',
          expiryDate: '2026-10-20',
          close: 75150,
          volume: 12000,
          openInterest: 6000
        }),
        makeObs({
          date: '2026-10-11',
          symbol: 'GOLDTEN',
          expiryDate: '2026-10-20',
          close: 74980,
          volume: 12000,
          openInterest: 6000
        })
      );

      // Day 12: Tender window reached! (date 2026-10-15 is 5 days before 2026-10-20)
      testObs.push(
        makeObs({
          date: '2026-10-15',
          symbol: 'GOLDM',
          expiryDate: '2026-10-20',
          close: 75140,
          volume: 8000,
          openInterest: 4000
        }),
        makeObs({
          date: '2026-10-15',
          symbol: 'GOLDTEN',
          expiryDate: '2026-10-20',
          close: 74980,
          volume: 8000,
          openInterest: 4000
        })
      );

      const result = runWalkForwardBacktest(testObs, {
        pair: ['GOLDM', 'GOLDTEN'],
        warmUpDays: 10,
        zScoreEntryThreshold: 2.0,
        zScoreExitThreshold: 0.5
      });

      expect(result.acceptedTrades).toBe(1);
      const trade = result.trades[0];
      expect(trade.status).toBe('CLOSED');
      expect(trade.exitReason).toBe('TENDER_WINDOW_FORCED_EXIT');
    });
  });
});
