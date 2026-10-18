import { 
  ContractSpecification, 
  ContractSymbol, 
  MarketObservation, 
  NormalizedObservation, 
  DataHealthSummary,
  DataProvenance,
  DatasetMetadata
} from '../types/market';
import { CONTRACT_SPECIFICATIONS, CONTRACT_LIST } from '../data/contracts';
import { SEED_MARKET_DATA } from '../data/seedMarketData';
import { normalizeObservation } from '../engines/normalizationEngine';
import { validateMarketData } from '../utils/dataQuality';
import { parseBhavcopyCsv, ParseResult, ColumnMapping } from './csvParserService';
import { SAMPLE_MCX_BHAVCOPY_CSV } from '../data/sampleOfficialBhavcopy';

type DataChangeListener = (observations: MarketObservation[]) => void;

/**
 * AUREX Market Data Service (Round 2 Unified Data Engine)
 * 
 * Manages ingestion, provenance tracking, discrete contract lifecycle records,
 * and reactive distribution across all analytical engines.
 */
class MarketDataService {
  private provenance: DataProvenance = 'PROTOTYPE SIMULATION';
  private localObservations: MarketObservation[] = SEED_MARKET_DATA;
  private metadata: DatasetMetadata;
  private listeners: Set<DataChangeListener> = new Set();

  constructor() {
    this.metadata = this.buildSimulationMetadata();
  }

  private buildSimulationMetadata(): DatasetMetadata {
    const dates = Array.from(new Set(SEED_MARKET_DATA.map(o => o.date))).sort();
    
    const coverageMap: Record<ContractSymbol, { count: number; earliestDate: string; latestDate: string; expiries: Set<string> }> = {
      GOLDM: { count: 0, earliestDate: '', latestDate: '', expiries: new Set() },
      GOLDTEN: { count: 0, earliestDate: '', latestDate: '', expiries: new Set() },
      GOLDGUINEA: { count: 0, earliestDate: '', latestDate: '', expiries: new Set() },
      GOLDPETAL: { count: 0, earliestDate: '', latestDate: '', expiries: new Set() }
    };

    for (const r of SEED_MARKET_DATA) {
      const entry = coverageMap[r.symbol];
      if (entry) {
        entry.count++;
        if (!entry.earliestDate || r.date < entry.earliestDate) entry.earliestDate = r.date;
        if (!entry.latestDate || r.date > entry.latestDate) entry.latestDate = r.date;
        entry.expiries.add(r.expiryDate);
      }
    }

    return {
      provenance: 'PROTOTYPE SIMULATION',
      filename: 'seed_prototype_simulation.internal',
      importTimestamp: '2026-10-08T17:30:00.000Z',
      totalRows: SEED_MARKET_DATA.length,
      validRows: SEED_MARKET_DATA.length,
      rejectedRows: 0,
      duplicateCount: 0,
      missingFieldCount: 0,
      dateRange: {
        start: dates[0] || '2026-07-15',
        end: dates[dates.length - 1] || '2026-10-08'
      },
      contractCoverage: {
        GOLDM: { ...coverageMap.GOLDM, expiries: Array.from(coverageMap.GOLDM.expiries) },
        GOLDTEN: { ...coverageMap.GOLDTEN, expiries: Array.from(coverageMap.GOLDTEN.expiries) },
        GOLDGUINEA: { ...coverageMap.GOLDGUINEA, expiries: Array.from(coverageMap.GOLDGUINEA.expiries) },
        GOLDPETAL: { ...coverageMap.GOLDPETAL, expiries: Array.from(coverageMap.GOLDPETAL.expiries) }
      },
      knownLimitations: [
        'Calibrated prototype simulation based on historical Indian gold volatility and official MCX PS03 contract parameters.',
        'Not live or historical exchange execution; intended for functional architecture verification.'
      ],
      sourceClassification: 'Calibrated Prototype Simulation'
    };
  }

  /**
   * Subscribe to dataset change events
   */
  public subscribe(listener: DataChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener(this.localObservations);
    }
  }

  /**
   * Returns list of monitored contract specifications
   */
  public getContracts(): ContractSpecification[] {
    return CONTRACT_LIST;
  }

  /**
   * Returns contract specification by symbol
   */
  public getContractSpec(symbol: ContractSymbol): ContractSpecification {
    const spec = CONTRACT_SPECIFICATIONS[symbol];
    if (!spec) {
      throw new Error(`Unrecognized contract symbol: ${symbol}`);
    }
    return spec;
  }

  /**
   * Returns current data provenance
   */
  public getProvenance(): DataProvenance {
    return this.provenance;
  }

  /**
   * Returns dataset metadata
   */
  public getMetadata(): DatasetMetadata {
    return this.metadata;
  }

  /**
   * Returns raw historical observations.
   * Filterable by symbol and date range.
   */
  public getHistoricalData(filter?: {
    symbol?: ContractSymbol;
    startDate?: string;
    endDate?: string;
  }): MarketObservation[] {
    let result = [...this.localObservations];

    if (filter?.symbol) {
      result = result.filter(o => o.symbol === filter.symbol);
    }
    if (filter?.startDate) {
      result = result.filter(o => o.date >= filter.startDate!);
    }
    if (filter?.endDate) {
      result = result.filter(o => o.date <= filter.endDate!);
    }

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Returns historical observations normalized to ₹ / 10g @ 999 purity.
   */
  public getNormalizedHistoricalData(filter?: {
    symbol?: ContractSymbol;
    startDate?: string;
    endDate?: string;
  }): NormalizedObservation[] {
    const raw = this.getHistoricalData(filter);
    return raw.map(obs => normalizeObservation(obs));
  }

  /**
   * Returns latest available observation per contract symbol
   */
  public getLatestObservations(): Record<ContractSymbol, NormalizedObservation> {
    const dates = this.getAvailableDates();
    if (dates.length === 0) {
      return {} as Record<ContractSymbol, NormalizedObservation>;
    }
    const latestDate = dates[dates.length - 1];
    const latestRaw = this.localObservations.filter(o => o.date === latestDate);

    const result: Partial<Record<ContractSymbol, NormalizedObservation>> = {};
    for (const obs of latestRaw) {
      result[obs.symbol] = normalizeObservation(obs);
    }

    // Fallback: If any symbol is missing on latest date, pick its most recent observation
    const allSymbols: ContractSymbol[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'];
    for (const sym of allSymbols) {
      if (!result[sym]) {
        const symObs = this.localObservations.filter(o => o.symbol === sym);
        if (symObs.length > 0) {
          result[sym] = normalizeObservation(symObs[symObs.length - 1]);
        }
      }
    }

    return result as Record<ContractSymbol, NormalizedObservation>;
  }

  /**
   * Returns distinct trading dates sorted in ascending chronological order
   */
  public getAvailableDates(): string[] {
    const dates = Array.from(new Set(this.localObservations.map(o => o.date)));
    return dates.sort((a, b) => a.localeCompare(b));
  }

  /**
   * Returns Data Health metrics for the Data Health Panel
   */
  public getDataHealthSummary(): DataHealthSummary {
    const dates = this.getAvailableDates();
    const lastDate = dates[dates.length - 1] || 'N/A';
    const report = validateMarketData(this.localObservations);

    // Count distinct contracts available in dataset
    const availableContracts = new Set(this.localObservations.map(o => o.symbol));

    return {
      source: this.metadata.sourceClassification,
      provenance: this.provenance,
      totalRecords: this.localObservations.length,
      validRecords: report.validRecords,
      rejectedRecords: this.metadata.rejectedRows,
      contractsCount: availableContracts.size,
      lastAvailableDate: lastDate,
      qualityStatus: report.status,
      contractCoverage: `${availableContracts.size} / 4 Monitored`,
      importTimestamp: this.metadata.importTimestamp,
      filename: this.metadata.filename
    };
  }

  /**
   * Imports custom user Bhavcopy CSV dataset
   */
  public importFromCsv(
    csvContent: string,
    filename = 'user_upload.csv',
    customMapping?: Partial<ColumnMapping>
  ): ParseResult {
    const result = parseBhavcopyCsv(
      csvContent,
      filename,
      'USER-IMPORTED MCX DATA',
      customMapping
    );

    if (result.validRecords.length === 0) {
      throw new Error(`Import failed: 0 valid records parsed. ${result.rejectedRows.length} rows were rejected.`);
    }

    this.localObservations = result.validRecords;
    this.provenance = 'USER-IMPORTED MCX DATA';
    this.metadata = result.metadata;
    this.emitChange();

    return result;
  }

  /**
   * Loads pre-packaged verified historical sample MCX Bhavcopy dataset
   */
  public loadOfficialSample(): ParseResult {
    const result = parseBhavcopyCsv(
      SAMPLE_MCX_BHAVCOPY_CSV,
      'mcx_bhavcopy_sep_oct_2026.csv',
      'OFFICIAL MCX DATA'
    );

    this.localObservations = result.validRecords;
    this.provenance = 'OFFICIAL MCX DATA';
    this.metadata = result.metadata;
    this.emitChange();

    return result;
  }

  /**
   * Resets dataset back to calibrated deterministic prototype simulation
   */
  public resetToSimulation(): void {
    this.localObservations = SEED_MARKET_DATA;
    this.provenance = 'PROTOTYPE SIMULATION';
    this.metadata = this.buildSimulationMetadata();
    this.emitChange();
  }
}

export const marketDataService = new MarketDataService();
