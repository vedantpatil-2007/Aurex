import {
  ContractSpecification,
  ContractSymbol,
  MarketObservation,
  NormalizedObservation,
  DataHealthSummary,
  DataProvenance,
  DatasetMetadata,
  TermStructurePoint
} from '../types/market';
import { CONTRACT_SPECIFICATIONS, CONTRACT_LIST } from '../data/contracts';
import { SEED_MARKET_DATA } from '../data/seedMarketData';
import { normalizeObservation } from '../engines/normalizationEngine';
import { validateMarketData } from '../utils/dataQuality';
import { parseBhavcopyCsv, ParseResult, ColumnMapping, computeFileSha256 } from './csvParserService';
import { SAMPLE_MCX_BHAVCOPY_CSV } from '../data/sampleOfficialBhavcopy';

type DataChangeListener = (observations: MarketObservation[]) => void;

const STORAGE_KEY = 'aurex_imported_dataset_v2';
const METADATA_KEY = 'aurex_imported_metadata_v2';

/**
 * AUREX Market Data Service (Round 2 Unified Data Engine)
 *
 * Manages ingestion, provenance tracking, discrete contract lifecycle records,
 * persistent browser storage, and reactive distribution across all analytical engines.
 */
class MarketDataService {
  private provenance: DataProvenance = 'PROTOTYPE SIMULATION';
  private localObservations: MarketObservation[] = SEED_MARKET_DATA;
  private metadata: DatasetMetadata;
  private listeners: Set<DataChangeListener> = new Set();
  private isPersistedInLocalStorage = false;

  constructor() {
    this.metadata = this.buildSimulationMetadata();
    this.tryRestoreFromLocalStorage();
  }

  private tryRestoreFromLocalStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const storedData = localStorage.getItem(STORAGE_KEY);
      const storedMeta = localStorage.getItem(METADATA_KEY);
      if (storedData && storedMeta) {
        const parsedObservations = JSON.parse(storedData) as MarketObservation[];
        const parsedMeta = JSON.parse(storedMeta) as DatasetMetadata;
        if (Array.isArray(parsedObservations) && parsedObservations.length > 0) {
          this.localObservations = parsedObservations;
          this.metadata = {
            ...parsedMeta,
            storagePersistence: 'LOCAL_STORAGE'
          };
          this.provenance = parsedMeta.provenance || 'USER-IMPORTED DATA — SOURCE UNVERIFIED';
          this.isPersistedInLocalStorage = true;
        }
      }
    } catch (e) {
      console.warn('Could not restore dataset from localStorage:', e);
    }
  }

  private saveToLocalStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.localObservations));
      localStorage.setItem(METADATA_KEY, JSON.stringify(this.metadata));
      this.isPersistedInLocalStorage = true;
      this.metadata.storagePersistence = 'LOCAL_STORAGE';
    } catch (e) {
      console.warn('Storage quota exceeded or storage unavailable; keeping dataset in session memory only:', e);
      this.isPersistedInLocalStorage = false;
      this.metadata.storagePersistence = 'SESSION_MEMORY';
    }
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
      fileHashSha256: 'sim_deterministic_seed_f7c9e0114a8b29f0',
      sourceUrl: 'https://www.mcxindia.com/market-data/bhavcopy',
      storagePersistence: 'BUNDLED_CODE',
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
      sourceClassification: 'Calibrated Prototype Simulation',
      isUserAttested: false,
      attestationNotes: undefined,
      attestationTimestamp: undefined,
      isVerified: false,
      verificationNotes: undefined
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
      if (!result[obs.symbol] || obs.volume > (result[obs.symbol]?.volume || 0)) {
        result[obs.symbol] = normalizeObservation(obs);
      }
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
   * Returns observations for a specific trading date
   */
  public getObservationsForDate(date: string): NormalizedObservation[] {
    const matches = this.localObservations.filter(o => o.date === date);
    return matches.map(obs => normalizeObservation(obs));
  }

  /**
   * Returns term structure points for a specific date and symbol, sorted by DTE
   */
  public getTermStructure(date: string, symbol: ContractSymbol): TermStructurePoint[] {
    const dateObs = this.getObservationsForDate(date).filter(o => o.symbol === symbol);

    // Sort ascending by days to expiry
    dateObs.sort((a, b) => a.daysToExpiry - b.daysToExpiry);

    return dateObs.map((obs, idx, arr) => {
      let adjacentSpread: number | undefined = undefined;
      let adjacentSpreadPct: number | undefined = undefined;

      if (idx > 0) {
        const prev = arr[idx - 1];
        adjacentSpread = Number((obs.normalizedPrice - prev.normalizedPrice).toFixed(2));
        adjacentSpreadPct = Number(((adjacentSpread / prev.normalizedPrice) * 100).toFixed(4));
      }

      return {
        symbol: obs.symbol,
        expiryDate: obs.expiryDate,
        daysToExpiry: obs.daysToExpiry,
        rawPrice: obs.close,
        normalizedPrice: obs.normalizedPrice,
        volume: obs.volume,
        openInterest: obs.openInterest,
        adjacentSpread,
        adjacentSpreadPct
      };
    });
  }

  /**
   * Returns Data Health metrics for the Data Health Panel
   */
  public getDataHealthSummary(): DataHealthSummary {
    const dates = this.getAvailableDates();
    const lastDate = dates[dates.length - 1] || 'N/A';
    const report = validateMarketData(this.localObservations);

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
      filename: this.metadata.filename,
      fileHashSha256: this.metadata.fileHashSha256,
      storagePersistence: this.isPersistedInLocalStorage ? 'BROWSER LOCAL STORAGE (PERSISTENT)' : 'SESSION MEMORY',
      isUserAttested: this.metadata.isUserAttested ?? false,
      attestationNotes: this.metadata.attestationNotes,
      attestationTimestamp: this.metadata.attestationTimestamp,
      isVerified: this.metadata.isVerified ?? false,
      verificationNotes: this.metadata.verificationNotes
    };
  }

  /**
   * Imports custom user Bhavcopy CSV dataset.
   * Defaults strictly to 'USER-IMPORTED DATA — SOURCE UNVERIFIED'.
   */
  public async importFromCsvAsync(
    csvContent: string,
    filename = 'user_upload.csv',
    customMapping?: Partial<ColumnMapping>
  ): Promise<ParseResult> {
    const hash = await computeFileSha256(csvContent);
    const provenance: DataProvenance = 'USER-IMPORTED DATA — SOURCE UNVERIFIED';

    const result = parseBhavcopyCsv(
      csvContent,
      filename,
      provenance,
      customMapping,
      hash
    );

    if (result.validRecords.length === 0) {
      throw new Error(`Import failed: 0 valid records parsed. ${result.rejectedRows.length} rows were rejected.`);
    }

    result.metadata.isUserAttested = false;
    result.metadata.isVerified = false;

    this.localObservations = result.validRecords;
    this.provenance = provenance;
    this.metadata = result.metadata;
    this.saveToLocalStorage();
    this.emitChange();

    return result;
  }

  /**
   * Synchronous import method for backward compatibility
   */
  public importFromCsv(
    csvContent: string,
    filename = 'user_upload.csv',
    customMapping?: Partial<ColumnMapping>
  ): ParseResult {
    const provenance: DataProvenance = 'USER-IMPORTED DATA — SOURCE UNVERIFIED';

    const result = parseBhavcopyCsv(
      csvContent,
      filename,
      provenance,
      customMapping
    );

    if (result.validRecords.length === 0) {
      throw new Error(`Import failed: 0 valid records parsed. ${result.rejectedRows.length} rows were rejected.`);
    }

    result.metadata.isUserAttested = false;
    result.metadata.isVerified = false;

    this.localObservations = result.validRecords;
    this.provenance = provenance;
    this.metadata = result.metadata;
    this.saveToLocalStorage();
    this.emitChange();

    return result;
  }

  /**
   * Loads bundled illustrative sample MCX Bhavcopy dataset.
   * STATED CLEARLY: 'PROTOTYPE SAMPLE — UNVERIFIED SOURCING'.
   * Never marked as verified official MCX data.
   */
  public loadBundledSample(): ParseResult {
    const result = parseBhavcopyCsv(
      SAMPLE_MCX_BHAVCOPY_CSV,
      'bundled_prototype_sample.csv',
      'PROTOTYPE SAMPLE — UNVERIFIED SOURCING'
    );

    result.metadata.knownLimitations = [
      'Bundled illustrative dataset formatted to MCX Bhavcopy schema for prototype demonstration.',
      'Calibrated to Indian gold market parameters; NOT downloaded directly from an official exchange archive.',
      'Must NOT be treated as verified official exchange data.'
    ];

    result.metadata.isUserAttested = false;
    result.metadata.attestationNotes = undefined;
    result.metadata.attestationTimestamp = undefined;
    result.metadata.isVerified = false;
    result.metadata.verificationNotes = undefined;

    this.localObservations = result.validRecords;
    this.provenance = 'PROTOTYPE SAMPLE — UNVERIFIED SOURCING';
    this.metadata = result.metadata;
    this.saveToLocalStorage();
    this.emitChange();

    return result;
  }

  /**
   * Alias for loadBundledSample for backward compatibility.
   */
  public loadOfficialSample(): ParseResult {
    return this.loadBundledSample();
  }

  /**
   * Records a user assertion/attestation that an uploaded file originated from MCX.
   * Explicitly sets provenance to 'USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED'.
   */
  public recordSourceAttestation(notes = 'User asserted origin from official MCX Bhavcopy archive'): boolean {
    if (this.provenance === 'PROTOTYPE SIMULATION' || this.provenance === 'PROTOTYPE SAMPLE — UNVERIFIED SOURCING') {
      throw new Error('Synthetic simulation or bundled prototype samples cannot accept user source attestation.');
    }

    this.provenance = 'USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED';
    this.metadata.provenance = 'USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED';
    this.metadata.isUserAttested = true;
    this.metadata.isVerified = false;
    this.metadata.attestationNotes = notes;
    this.metadata.attestationTimestamp = new Date().toISOString();
    this.metadata.sourceClassification = 'User-Attested Bhavcopy CSV File (Not Independently Verified)';

    const disclosure = 'Uploading a file and recording a source attestation does not independently verify that the file originated from MCX. AUREX currently has no independent official-source verification mechanism. User-attested datasets remain independently unverified.';
    if (!this.metadata.knownLimitations.includes(disclosure)) {
      this.metadata.knownLimitations = [disclosure, ...this.metadata.knownLimitations];
    }

    this.saveToLocalStorage();
    this.emitChange();
    return true;
  }

  /**
   * Revokes user attestation and restores dataset to 'USER-IMPORTED DATA — SOURCE UNVERIFIED'.
   */
  public revokeSourceAttestation(): void {
    if (this.provenance === 'USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED') {
      this.provenance = 'USER-IMPORTED DATA — SOURCE UNVERIFIED';
      this.metadata.provenance = 'USER-IMPORTED DATA — SOURCE UNVERIFIED';
      this.metadata.isUserAttested = false;
      this.metadata.attestationNotes = undefined;
      this.metadata.attestationTimestamp = undefined;
      this.metadata.sourceClassification = 'User-Provided Bhavcopy CSV File (Source Unverified)';
      this.saveToLocalStorage();
      this.emitChange();
    }
  }

  /**
   * Protected method: Disallows assigning 'OFFICIAL MCX DATA — SOURCE VERIFIED' via arbitrary notes.
   */
  public verifyActiveDataset(_notes?: string): boolean {
    throw new Error(
      'Independent official-source verification is unavailable: no independent exchange verification mechanism exists. Promotion to verified status via user notes is disabled to preserve quantitative audit integrity.'
    );
  }

  /**
   * Revokes verified/attested status back to unverified.
   */
  public unverifyActiveDataset(): void {
    this.revokeSourceAttestation();
  }

  /**
   * Checks whether active dataset is persisted in browser localStorage
   */
  public hasPersistedData(): boolean {
    return this.isPersistedInLocalStorage || this.metadata.storagePersistence === 'LOCAL_STORAGE';
  }

  /**
   * Clears any stored localStorage dataset and restores session prototype simulation
   */
  public clearPersistedData(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(METADATA_KEY);
      } catch (e) {
        console.warn('Error clearing localStorage:', e);
      }
    }
    this.isPersistedInLocalStorage = false;
    this.resetToSimulation();
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
