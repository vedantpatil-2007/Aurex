import {
  ContractSpecification,
  ContractSymbol,
  MarketObservation,
  NormalizedObservation,
  DataHealthSummary,
  DataProvenance,
  DatasetMetadata,
  TermStructurePoint,
  ContractCoverageItem,
  ImportedSourceFileMetadata,
  MergeAnalysis,
  MergeConflictDetail,
  DataMode,
  ProvenanceBreakdown,
  DataSufficiencyAssessment
} from '../types/market';
import { CONTRACT_SPECIFICATIONS, CONTRACT_LIST } from '../data/contracts';
import { SEED_MARKET_DATA } from '../data/seedMarketData';
import { normalizeObservation } from '../engines/normalizationEngine';
import { validateMarketData } from '../utils/dataQuality';
import { parseBhavcopyCsv, ParseResult, ColumnMapping, computeFileSha256, computeQuickHash } from './csvParserService';
import { SAMPLE_MCX_BHAVCOPY_CSV } from '../data/sampleOfficialBhavcopy';
import { assessDataSufficiency } from '../engines/dataSufficiencyEngine';
import { getActiveObservation } from '../engines/relativeValueEngine';

type DataChangeListener = (observations: MarketObservation[]) => void;

const STORAGE_KEY = 'aurex_imported_dataset_v2';
const METADATA_KEY = 'aurex_imported_metadata_v2';
const DATA_MODE_KEY = 'aurex_data_mode_v2';

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
  private activeDataMode: DataMode = 'ALL';

  constructor() {
    this.activeDataMode = this.tryRestoreDataMode();
    this.metadata = this.buildSimulationMetadata();
    this.tryRestoreFromLocalStorage();
  }

  private tryRestoreDataMode(): DataMode {
    if (typeof window === 'undefined' || !window.localStorage) return 'ALL';
    try {
      const stored = localStorage.getItem(DATA_MODE_KEY);
      if (stored === 'ALL' || stored === 'PROTOTYPE_ONLY' || stored === 'IMPORTED_ONLY') {
        return stored as DataMode;
      }
    } catch {
      // fallback
    }
    return 'ALL';
  }

  public getActiveDataMode(): DataMode {
    return this.activeDataMode;
  }

  public setActiveDataMode(mode: DataMode): void {
    if (this.activeDataMode === mode) return;
    this.activeDataMode = mode;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(DATA_MODE_KEY, mode);
      } catch (e) {
        console.warn('Could not persist dataMode to localStorage:', e);
      }
    }
    this.emitChange();
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
  public getProvenance(dataMode?: DataMode): DataProvenance {
    if (dataMode === 'PROTOTYPE_ONLY') {
      return 'PROTOTYPE SIMULATION';
    }
    if (dataMode === 'IMPORTED_ONLY') {
      return this.metadata.isUserAttested
        ? 'USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED'
        : 'USER-IMPORTED DATA — SOURCE UNVERIFIED';
    }
    return this.provenance;
  }

  /**
   * Returns discrete observation provenance breakdown counts for the given or active data mode
   */
  public getProvenanceBreakdown(dataMode?: DataMode): ProvenanceBreakdown {
    const effectiveMode = dataMode ?? this.activeDataMode;
    const obsList = effectiveMode === 'ALL'
      ? this.localObservations
      : this.getHistoricalData({ dataMode: effectiveMode });

    let prototypeSimulationCount = 0;
    let userImportedCount = 0;
    let officialVerifiedCount = 0;

    for (const obs of obsList) {
      if (obs.provenance === 'OFFICIAL MCX DATA — SOURCE VERIFIED') {
        officialVerifiedCount++;
      } else if (
        obs.provenance === 'USER-IMPORTED DATA — SOURCE UNVERIFIED' ||
        obs.provenance === 'USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED' ||
        obs.provenance === 'PROTOTYPE SAMPLE — UNVERIFIED SOURCING'
      ) {
        userImportedCount++;
      } else {
        prototypeSimulationCount++;
      }
    }

    return {
      prototypeSimulationCount,
      userImportedCount,
      officialVerifiedCount
    };
  }

  /**
   * Returns dataset metadata reflecting the requested or active data mode.
   * Total stored rows reflects total physical records in memory, while
   * validRows, dateRange, and contractCoverage reflect the active mode.
   */
  public getMetadata(dataMode?: DataMode): DatasetMetadata {
    const mode = dataMode ?? this.activeDataMode;
    const breakdown = this.getProvenanceBreakdown(mode);
    const modeObs = this.getHistoricalData({ dataMode: mode });

    const totalStored = this.localObservations.length;
    const modeDates = Array.from(new Set(modeObs.map(o => o.date))).sort((a, b) => a.localeCompare(b));

    const dateRange = modeDates.length > 0
      ? { start: modeDates[0], end: modeDates[modeDates.length - 1] }
      : { start: 'N/A', end: 'N/A' };

    // Compute contract coverage strictly from mode-filtered observations
    const allSymbols: ContractSymbol[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'];
    const contractCoverage: Record<ContractSymbol, ContractCoverageItem> = {} as any;
    for (const sym of allSymbols) {
      const symObs = modeObs.filter(o => o.symbol === sym);
      const symDates = Array.from(new Set(symObs.map(o => o.date))).sort((a, b) => a.localeCompare(b));
      const symExpiries = Array.from(new Set(symObs.map(o => o.expiryDate))).sort((a, b) => a.localeCompare(b));
      contractCoverage[sym] = {
        count: symObs.length,
        earliestDate: symDates[0] || 'N/A',
        latestDate: symDates[symDates.length - 1] || 'N/A',
        expiries: symExpiries
      };
    }

    // Filter source files relevant to this mode
    let sourceFiles = this.metadata.sourceFiles;
    if (sourceFiles && mode !== 'ALL') {
      if (mode === 'PROTOTYPE_ONLY') {
        sourceFiles = [];
      } else if (mode === 'IMPORTED_ONLY') {
        sourceFiles = this.metadata.sourceFiles;
      }
    }

    return {
      ...this.metadata,
      totalRows: totalStored,
      validRows: modeObs.length,
      dateRange,
      contractCoverage,
      sourceFiles,
      provenance: mode === 'PROTOTYPE_ONLY'
        ? 'PROTOTYPE SIMULATION'
        : mode === 'IMPORTED_ONLY'
        ? (this.metadata.isUserAttested
          ? 'USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED'
          : 'USER-IMPORTED DATA — SOURCE UNVERIFIED')
        : this.getProvenance(),
      provenanceBreakdown: breakdown
    };
  }

  /**
   * Returns raw historical observations.
   * Filterable by symbol, date range, as-of date (preventing look-ahead bias), and data mode.
   * Authoritative central data selection layer.
   */
  public getHistoricalData(filter?: {
    symbol?: ContractSymbol;
    startDate?: string;
    endDate?: string;
    asOfDate?: string;
    dataMode?: DataMode;
  }): MarketObservation[] {
    let result = [...this.localObservations];
    const mode = filter?.dataMode ?? this.activeDataMode;

    if (filter?.symbol) {
      result = result.filter(o => o.symbol === filter.symbol);
    }
    if (filter?.startDate) {
      result = result.filter(o => o.date >= filter.startDate!);
    }
    if (filter?.endDate) {
      result = result.filter(o => o.date <= filter.endDate!);
    }
    if (filter?.asOfDate) {
      result = result.filter(o => o.date <= filter.asOfDate!);
    }
    if (mode === 'PROTOTYPE_ONLY') {
      result = result.filter(o => o.provenance === 'PROTOTYPE SIMULATION' || (!o.provenance && o.date <= '2026-10-08'));
    } else if (mode === 'IMPORTED_ONLY') {
      result = result.filter(o => o.provenance !== 'PROTOTYPE SIMULATION' && o.provenance !== undefined);
    }

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Alias for getHistoricalData returning all active market observations
   */
  public getObservations(): MarketObservation[] {
    return this.getHistoricalData();
  }

  /**
   * Alias for getMetadata
   */
  public getDatasetMetadata(): DatasetMetadata {
    return this.getMetadata();
  }

  /**
   * Returns historical observations normalized to ₹ / 10g @ 999 purity.
   */
  public getNormalizedHistoricalData(filter?: {
    symbol?: ContractSymbol;
    startDate?: string;
    endDate?: string;
    asOfDate?: string;
    dataMode?: DataMode;
  }): NormalizedObservation[] {
    const raw = this.getHistoricalData(filter);
    return raw.map(obs => normalizeObservation(obs));
  }

  /**
   * Returns authoritative active near-month observation per contract symbol as-of a specific date and mode.
   * Applies the documented exchange active-selection policy:
   * 1. Observations on exact as-of date
   * 2. Highest volume
   * 3. Nearest expiry (Days to Expiry >= 3)
   * 4. Earliest valid expiry fallback
   */
  public getLatestObservations(asOfDate?: string, dataMode?: DataMode): Record<ContractSymbol, NormalizedObservation> {
    const mode = dataMode ?? this.activeDataMode;
    let dates = this.getAvailableDates(mode);
    if (asOfDate) {
      dates = dates.filter(d => d <= asOfDate);
    }
    if (dates.length === 0) {
      return {} as Record<ContractSymbol, NormalizedObservation>;
    }
    const latestDate = dates[dates.length - 1];
    const modeNormObs = this.getNormalizedHistoricalData({ dataMode: mode });

    const allSymbols: ContractSymbol[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'];
    const result: Partial<Record<ContractSymbol, NormalizedObservation>> = {};
    for (const sym of allSymbols) {
      const activeObs = getActiveObservation(modeNormObs, sym, latestDate);
      if (activeObs) {
        result[sym] = activeObs;
      }
    }

    return result as Record<ContractSymbol, NormalizedObservation>;
  }

  /**
   * Returns distinct trading dates sorted in ascending chronological order for the given or active data mode
   */
  public getAvailableDates(dataMode?: DataMode): string[] {
    const mode = dataMode ?? this.activeDataMode;
    const modeObs = this.getHistoricalData({ dataMode: mode });
    const dates = Array.from(new Set(modeObs.map(o => o.date)));
    return dates.sort((a, b) => a.localeCompare(b));
  }

  /**
   * Returns observations for a specific trading date and data mode
   */
  public getObservationsForDate(date: string, dataMode?: DataMode): NormalizedObservation[] {
    const mode = dataMode ?? this.activeDataMode;
    const modeObs = this.getHistoricalData({ dataMode: mode });
    const matches = modeObs.filter(o => o.date === date);
    if (mode === 'ALL') {
      const importedMatches = matches.filter(o => o.provenance !== 'PROTOTYPE SIMULATION');
      if (importedMatches.length > 0) {
        return importedMatches.map(obs => normalizeObservation(obs));
      }
    }
    return matches.map(obs => normalizeObservation(obs));
  }

  /**
   * Returns term structure points for a specific date and symbol, sorted by DTE
   */
  public getTermStructure(date: string, symbol: ContractSymbol, dataMode?: DataMode): TermStructurePoint[] {
    const dateObs = this.getObservationsForDate(date, dataMode).filter(o => o.symbol === symbol);

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
   * Evaluates centralized data sufficiency across modules
   */
  public getDataSufficiency(params?: {
    pair?: [ContractSymbol, ContractSymbol];
    asOfDate?: string;
    dataMode?: DataMode;
  }): DataSufficiencyAssessment {
    const mode = params?.dataMode ?? this.activeDataMode;
    const pair = params?.pair ?? ['GOLDM', 'GOLDTEN'];
    const asOfDate = params?.asOfDate ?? this.getAvailableDates(mode).slice(-1)[0] ?? '2026-10-08';
    const observations = this.getNormalizedHistoricalData({ dataMode: mode, asOfDate });
    return assessDataSufficiency({ observations, pair, asOfDate, dataMode: mode });
  }

  /**
   * Returns Data Health metrics for the Data Health Panel
   */
  public getDataHealthSummary(dataMode?: DataMode): DataHealthSummary {
    const mode = dataMode ?? this.activeDataMode;
    const dates = this.getAvailableDates(mode);
    const lastDate = dates[dates.length - 1] || 'N/A';
    const modeObs = this.getHistoricalData({ dataMode: mode });
    const report = validateMarketData(modeObs);
    const breakdown = this.getProvenanceBreakdown(mode);
    const isHybrid = breakdown.prototypeSimulationCount > 0 && breakdown.userImportedCount > 0;
    const currentProvenance = mode === 'PROTOTYPE_ONLY'
      ? 'PROTOTYPE SIMULATION'
      : mode === 'IMPORTED_ONLY'
      ? 'USER-IMPORTED DATA — SOURCE UNVERIFIED'
      : isHybrid
      ? 'HYBRID / MIXED PROVENANCE'
      : this.provenance;

    const availableContracts = new Set(modeObs.map(o => o.symbol));

    return {
      source: isHybrid
        ? `Hybrid Dataset (${breakdown.prototypeSimulationCount} Prototype Sim + ${breakdown.userImportedCount} User-Imported)`
        : mode === 'PROTOTYPE_ONLY'
        ? 'Calibrated Prototype Simulation'
        : mode === 'IMPORTED_ONLY'
        ? `Imported MCX Bhavcopy (${breakdown.userImportedCount} observations)`
        : this.metadata.sourceClassification,
      provenance: currentProvenance,
      provenanceBreakdown: breakdown,
      totalRecords: modeObs.length,
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
   * Recalculates discrete contract coverage across accumulated market records
   */
  private recalculateCoverage(records: MarketObservation[]): Record<ContractSymbol, ContractCoverageItem> {
    const coverageMap: Record<ContractSymbol, { count: number; earliestDate: string; latestDate: string; expiries: Set<string> }> = {
      GOLDM: { count: 0, earliestDate: '', latestDate: '', expiries: new Set() },
      GOLDTEN: { count: 0, earliestDate: '', latestDate: '', expiries: new Set() },
      GOLDGUINEA: { count: 0, earliestDate: '', latestDate: '', expiries: new Set() },
      GOLDPETAL: { count: 0, earliestDate: '', latestDate: '', expiries: new Set() }
    };

    for (const r of records) {
      const entry = coverageMap[r.symbol];
      if (entry) {
        entry.count++;
        if (!entry.earliestDate || r.date < entry.earliestDate) entry.earliestDate = r.date;
        if (!entry.latestDate || r.date > entry.latestDate) entry.latestDate = r.date;
        entry.expiries.add(r.expiryDate);
      }
    }

    return {
      GOLDM: { ...coverageMap.GOLDM, expiries: Array.from(coverageMap.GOLDM.expiries) },
      GOLDTEN: { ...coverageMap.GOLDTEN, expiries: Array.from(coverageMap.GOLDTEN.expiries) },
      GOLDGUINEA: { ...coverageMap.GOLDGUINEA, expiries: Array.from(coverageMap.GOLDGUINEA.expiries) },
      GOLDPETAL: { ...coverageMap.GOLDPETAL, expiries: Array.from(coverageMap.GOLDPETAL.expiries) }
    };
  }

  /**
   * Performs pre-import merge analysis.
   * Compares incoming parsed records with existing observations to detect:
   * - Genuine new trading dates / contracts to be accumulated.
   * - Identical duplicate observations (idempotent).
   * - Conflicting observations with same contract identity but divergent prices/values.
   * - Accurate counts of unsupported instruments and malformed rows.
   */
  public analyzeImportMerge(
    csvContent: string,
    filename = 'user_upload.csv',
    customMapping?: Partial<ColumnMapping>,
    knownFileHash?: string
  ): { parseResult: ParseResult; mergeAnalysis: MergeAnalysis } {
    const parseResult = parseBhavcopyCsv(
      csvContent,
      filename,
      'USER-IMPORTED DATA — SOURCE UNVERIFIED',
      customMapping,
      knownFileHash
    );

    const isAccumulating = this.localObservations.length > 0;

    const detectedTradingDates = Array.from(
      new Set(parseResult.validRecords.map(r => r.date))
    ).sort();

    const unsupportedInstrumentCount = parseResult.rejectedRows.filter(
      r => r.reason.includes('Non-futures instrument') || r.reason.includes('Option contract')
    ).length;
    const otherRejectedCount = parseResult.rejectedRows.length - unsupportedInstrumentCount;

    if (!isAccumulating) {
      const mergeAnalysis: MergeAnalysis = {
        sourceFilename: filename,
        detectedTradingDates,
        validFuturesInSource: parseResult.validRecords.length,
        newlyInsertedCount: parseResult.validRecords.length,
        unchangedDuplicatesCount: 0,
        conflictingCount: 0,
        conflictingObservations: [],
        unsupportedInstrumentCount,
        otherRejectedCount,
        projectedTotalRecords: parseResult.validRecords.length,
        projectedDateRange: parseResult.metadata.dateRange,
        isAccumulating: false
      };
      parseResult.mergeAnalysis = mergeAnalysis;
      return { parseResult, mergeAnalysis };
    }

    // Isolate merge conflict and duplicate detection by provenance.
    // User-imported market data must only be compared against existing records of the same provenance family (imported vs imported).
    // Prototype simulation records belong to an isolated synthetic provenance and must not block or conflict with real user imports.
    const existingImportedRecords = this.localObservations.filter(
      obs => obs.provenance !== 'PROTOTYPE SIMULATION'
    );
    const existingMap = new Map<string, MarketObservation>();
    for (const obs of existingImportedRecords) {
      existingMap.set(`${obs.symbol}_${obs.date}_${obs.expiryDate}`, obs);
    }

    let newlyInsertedCount = 0;
    let unchangedDuplicatesCount = 0;
    const conflictingObservations: MergeConflictDetail[] = [];

    for (const inc of parseResult.validRecords) {
      const key = `${inc.symbol}_${inc.date}_${inc.expiryDate}`;
      const ext = existingMap.get(key);
      if (!ext) {
        newlyInsertedCount++;
      } else {
        const isCloseDiff = Math.abs(ext.close - inc.close) > 0.01;
        const isOpenDiff = Math.abs(ext.open - inc.open) > 0.01;
        const isHighDiff = Math.abs(ext.high - inc.high) > 0.01;
        const isLowDiff = Math.abs(ext.low - inc.low) > 0.01;
        const isVolDiff = ext.volume !== inc.volume;
        const isOIDiff = ext.openInterest !== inc.openInterest;

        if (isCloseDiff || isOpenDiff || isHighDiff || isLowDiff || isVolDiff || isOIDiff) {
          const diffs: string[] = [];
          if (isCloseDiff) diffs.push(`Close ₹${ext.close} vs ₹${inc.close}`);
          if (isOpenDiff) diffs.push(`Open ₹${ext.open} vs ₹${inc.open}`);
          if (isHighDiff) diffs.push(`High ₹${ext.high} vs ₹${inc.high}`);
          if (isLowDiff) diffs.push(`Low ₹${ext.low} vs ₹${inc.low}`);
          if (isVolDiff) diffs.push(`Vol ${ext.volume} vs ${inc.volume}`);
          if (isOIDiff) diffs.push(`OI ${ext.openInterest} vs ${inc.openInterest}`);

          conflictingObservations.push({
            symbol: inc.symbol,
            date: inc.date,
            expiryDate: inc.expiryDate,
            existingClose: ext.close,
            incomingClose: inc.close,
            difference: diffs.join(', ')
          });
        } else {
          unchangedDuplicatesCount++;
        }
      }
    }

    const allProjectedDates = Array.from(
      new Set([...this.localObservations.map(o => o.date), ...detectedTradingDates])
    ).sort();

    const mergeAnalysis: MergeAnalysis = {
      sourceFilename: filename,
      detectedTradingDates,
      validFuturesInSource: parseResult.validRecords.length,
      newlyInsertedCount,
      unchangedDuplicatesCount,
      conflictingCount: conflictingObservations.length,
      conflictingObservations,
      unsupportedInstrumentCount,
      otherRejectedCount,
      projectedTotalRecords: this.localObservations.length + newlyInsertedCount,
      projectedDateRange: {
        start: allProjectedDates[0] || 'N/A',
        end: allProjectedDates[allProjectedDates.length - 1] || 'N/A'
      },
      isAccumulating: true
    };

    parseResult.mergeAnalysis = mergeAnalysis;
    return { parseResult, mergeAnalysis };
  }

  /**
   * Imports custom user Bhavcopy CSV dataset.
   * Deterministically merges compatible trading dates into the active imported historical dataset.
   * Prevents silent overwriting of conflicting observations.
   */
  public async importFromCsvAsync(
    csvContent: string,
    filename = 'user_upload.csv',
    customMapping?: Partial<ColumnMapping>,
    forceReplace = false
  ): Promise<ParseResult> {
    const hash = await computeFileSha256(csvContent);
    const { parseResult, mergeAnalysis } = this.analyzeImportMerge(
      csvContent,
      filename,
      customMapping,
      hash
    );

    if (parseResult.validRecords.length === 0) {
      throw new Error(`Import failed: 0 valid records parsed. ${parseResult.rejectedRows.length} rows were rejected.`);
    }

    if (mergeAnalysis.conflictingCount > 0 && !forceReplace) {
      throw new Error(
        `Import conflict: Detected ${mergeAnalysis.conflictingCount} conflicting observation(s) on existing contract dates. ` +
        `Conflicting records: [${mergeAnalysis.conflictingObservations.map(c => `${c.symbol} ${c.date} (${c.difference})`).join('; ')}]. ` +
        `Silent overwriting is prevented. Resolve source file or choose explicit replacement.`
      );
    }

    this.applyMerge(parseResult, mergeAnalysis, filename, hash, forceReplace);
    return parseResult;
  }

  /**
   * Synchronous import method for backward compatibility
   */
  public importFromCsv(
    csvContent: string,
    filename = 'user_upload.csv',
    customMapping?: Partial<ColumnMapping>,
    forceReplace = false
  ): ParseResult {
    const hash = computeQuickHash(csvContent);
    const { parseResult, mergeAnalysis } = this.analyzeImportMerge(
      csvContent,
      filename,
      customMapping,
      hash
    );

    if (parseResult.validRecords.length === 0) {
      throw new Error(`Import failed: 0 valid records parsed. ${parseResult.rejectedRows.length} rows were rejected.`);
    }

    if (mergeAnalysis.conflictingCount > 0 && !forceReplace) {
      throw new Error(
        `Import conflict: Detected ${mergeAnalysis.conflictingCount} conflicting observation(s) on existing contract dates. ` +
        `Conflicting records: [${mergeAnalysis.conflictingObservations.map(c => `${c.symbol} ${c.date} (${c.difference})`).join('; ')}]. ` +
        `Silent overwriting is prevented. Resolve source file or choose explicit replacement.`
      );
    }

    this.applyMerge(parseResult, mergeAnalysis, filename, hash, forceReplace);
    return parseResult;
  }

  private applyMerge(
    parseResult: ParseResult,
    mergeAnalysis: MergeAnalysis,
    filename: string,
    fileHash: string,
    forceReplace: boolean
  ): void {
    if (forceReplace || !mergeAnalysis.isAccumulating) {
      // Replace imported historical dataset while preserving prototype simulation records
      const protoRecords = this.localObservations.filter(o => o.provenance === 'PROTOTYPE SIMULATION');
      const validRecords = [...parseResult.validRecords].sort((a, b) => a.date.localeCompare(b.date));
      this.localObservations = [...protoRecords, ...validRecords];
      this.provenance = 'USER-IMPORTED DATA — SOURCE UNVERIFIED';

      const sourceFileEntry: ImportedSourceFileMetadata = {
        filename,
        fileHashSha256: fileHash,
        dateRange: parseResult.metadata.dateRange,
        validRows: validRecords.length,
        importTimestamp: new Date().toISOString()
      };

      this.metadata = {
        ...parseResult.metadata,
        provenance: this.provenance,
        fileHashSha256: fileHash,
        sourceFiles: [sourceFileEntry],
        isUserAttested: false,
        isVerified: false
      };
    } else {
      // Accumulate genuinely new observations into existing active dataset.
      // Deduplicate strictly against existing records of the same provenance family (imported vs imported).
      // Never allow prototype simulation records to filter out genuine user-imported observations.
      const existingImportedKeys = new Set(
        this.localObservations
          .filter(o => o.provenance !== 'PROTOTYPE SIMULATION')
          .map(o => `${o.symbol}_${o.date}_${o.expiryDate}`)
      );
      const newRecords = parseResult.validRecords.filter(
        o => !existingImportedKeys.has(`${o.symbol}_${o.date}_${o.expiryDate}`)
      );

      const mergedRecords = [...this.localObservations, ...newRecords].sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      const existingFiles = this.metadata.sourceFiles || [];
      const alreadyHasHash = existingFiles.some(f => f.fileHashSha256 === fileHash);
      const updatedFiles: ImportedSourceFileMetadata[] = alreadyHasHash
        ? existingFiles
        : [
            ...existingFiles,
            {
              filename,
              fileHashSha256: fileHash,
              dateRange: parseResult.metadata.dateRange,
              validRows: parseResult.validRecords.length,
              importTimestamp: new Date().toISOString()
            }
          ];

      const allDates = Array.from(new Set(mergedRecords.map(o => o.date))).sort();
      const updatedCoverage = this.recalculateCoverage(mergedRecords);

      this.localObservations = mergedRecords;

      // Update provenance breakdown
      const breakdown = this.getProvenanceBreakdown();
      const isHybrid = breakdown.prototypeSimulationCount > 0 && breakdown.userImportedCount > 0;
      if (this.provenance === 'PROTOTYPE SIMULATION' || this.provenance === 'PROTOTYPE SAMPLE — UNVERIFIED SOURCING') {
        this.provenance = 'USER-IMPORTED DATA — SOURCE UNVERIFIED';
      }

      this.metadata = {
        ...this.metadata,
        provenance: this.provenance,
        provenanceBreakdown: breakdown,
        filename: updatedFiles.map(f => f.filename).join(', '),
        fileHashSha256: fileHash,
        sourceClassification: isHybrid
          ? `Hybrid Dataset (${breakdown.prototypeSimulationCount} Prototype Simulation + ${breakdown.userImportedCount} User-Imported)`
          : this.provenance === 'USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED'
          ? 'User-Attested Bhavcopy CSV File (Not Independently Verified)'
          : 'User-Imported MCX Bhavcopy Dataset',
        validRows: mergedRecords.length,
        totalRows: mergedRecords.length,
        rejectedRows: (this.metadata.rejectedRows || 0) + parseResult.metadata.rejectedRows,
        duplicateCount: (this.metadata.duplicateCount || 0) + mergeAnalysis.unchangedDuplicatesCount,
        dateRange: {
          start: allDates[0] || 'N/A',
          end: allDates[allDates.length - 1] || 'N/A'
        },
        contractCoverage: updatedCoverage,
        sourceFiles: updatedFiles,
        knownLimitations: [
          'User-imported data merged into active dataset.',
          'Unverified against official exchange archives; trade execution audit required before capital allocation.'
        ]
      };
    }

    this.saveToLocalStorage();
    this.emitChange();

    parseResult.metadata = this.metadata;
    parseResult.mergeAnalysis = mergeAnalysis;
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

  /**
   * Clears all active market observations and stored persistence,
   * leaving an empty dataset with 0 records.
   */
  public clearDataset(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(METADATA_KEY);
      } catch (e) {
        console.warn('Error clearing localStorage:', e);
      }
    }
    this.isPersistedInLocalStorage = false;
    this.localObservations = [];
    this.provenance = 'USER-IMPORTED DATA — SOURCE UNVERIFIED';
    this.metadata = {
      provenance: this.provenance,
      filename: 'empty',
      fileHashSha256: '',
      sourceUrl: 'https://www.mcxindia.com/market-data/bhavcopy',
      storagePersistence: 'SESSION_MEMORY',
      importTimestamp: new Date().toISOString(),
      totalRows: 0,
      validRows: 0,
      rejectedRows: 0,
      duplicateCount: 0,
      missingFieldCount: 0,
      dateRange: { start: 'N/A', end: 'N/A' },
      contractCoverage: {
        GOLDM: { count: 0, earliestDate: '', latestDate: '', expiries: [] },
        GOLDTEN: { count: 0, earliestDate: '', latestDate: '', expiries: [] },
        GOLDGUINEA: { count: 0, earliestDate: '', latestDate: '', expiries: [] },
        GOLDPETAL: { count: 0, earliestDate: '', latestDate: '', expiries: [] }
      },
      knownLimitations: ['Empty dataset. Ingest Bhavcopy CSV data to initialize analysis.'],
      sourceClassification: 'Uninitialized / Empty Dataset',
      isUserAttested: false,
      isVerified: false
    };
    this.emitChange();
  }
}

export { MarketDataService };
export const marketDataService = new MarketDataService();
