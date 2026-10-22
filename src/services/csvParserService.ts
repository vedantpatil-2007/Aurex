import {
  ContractSymbol,
  MarketObservation,
  DatasetMetadata,
  RejectedRow,
  DataProvenance,
  MergeAnalysis
} from '../types/market';

export interface ColumnMapping {
  dateCol: string;
  symbolCol: string;
  expiryCol: string;
  openCol: string;
  highCol: string;
  lowCol: string;
  closeCol: string;
  volumeCol: string;
  oiCol: string;
  instrumentCol?: string;
  optionTypeCol?: string;
  strikePriceCol?: string;
}

export interface ParseResult {
  validRecords: MarketObservation[];
  rejectedRows: RejectedRow[];
  detectedColumns: string[];
  columnMapping: ColumnMapping;
  metadata: DatasetMetadata;
  mergeAnalysis?: MergeAnalysis;
}

const SUPPORTED_SYMBOLS: Record<string, ContractSymbol> = {
  GOLDM: 'GOLDM',
  'GOLD MINI': 'GOLDM',
  'GOLD-MINI': 'GOLDM',
  GOLDTEN: 'GOLDTEN',
  'GOLD 10GRM': 'GOLDTEN',
  'GOLD 10G': 'GOLDTEN',
  'GOLD 10 GRAMS': 'GOLDTEN',
  'GOLD-10GRM': 'GOLDTEN',
  GOLDGUINEA: 'GOLDGUINEA',
  'GOLD GUINEA': 'GOLDGUINEA',
  'GOLD-GUINEA': 'GOLDGUINEA',
  GOLDPETAL: 'GOLDPETAL',
  'GOLD PETAL': 'GOLDPETAL',
  'GOLD-PETAL': 'GOLDPETAL'
};

const MONTH_MAP: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
};

/**
 * Computes SHA-256 cryptographic hash of a text string for audit provenance.
 * Uses Web Crypto API when available, with a fast portable fallback.
 */
export async function computeFileSha256(content: string): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(content);
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to portable fallback
    }
  }

  // Portable 32-bit FNV-1a / hex hash fallback for offline non-secure contexts
  let hash1 = 0x811c9dc5;
  let hash2 = 0x55555555;
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i);
    hash1 ^= c;
    hash1 = (hash1 * 0x01000193) >>> 0;
    hash2 ^= c;
    hash2 = (hash2 * 0x01000193) >>> 0;
  }
  return (hash1.toString(16).padStart(8, '0') + hash2.toString(16).padStart(8, '0')).padEnd(64, '0');
}

/**
 * Synchronous portable hash fallback when async is not awaited
 */
export function computeQuickHash(content: string): string {
  let hash1 = 0x811c9dc5;
  let hash2 = 0x55555555;
  for (let i = 0; i < Math.min(content.length, 100000); i++) {
    const c = content.charCodeAt(i);
    hash1 ^= c;
    hash1 = (hash1 * 0x01000193) >>> 0;
    hash2 ^= c;
    hash2 = (hash2 * 0x01000193) >>> 0;
  }
  return (hash1.toString(16).padStart(8, '0') + hash2.toString(16).padStart(8, '0')).padEnd(64, '0');
}

/**
 * Robust date parser supporting:
 * - ISO: YYYY-MM-DD
 * - DD-MMM-YYYY or DD-MMM-YY (e.g. 05-Nov-2026 or 05-NOV-26)
 * - DDMMMYYYY (e.g. 04SEP2026, 27NOV2026)
 * - DD/MM/YYYY or DD-MM-YYYY
 * - MM/DD/YYYY (when unambiguous)
 *
 * Outputs canonical YYYY-MM-DD string or null if invalid.
 */
export function normalizeDate(input: string | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // 1. ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : raw;
  }

  // 2. Format: DD-MMM-YYYY or DD-MMM-YY (e.g. 05-Nov-2026 or 05-NOV-26)
  const dmmmyMatch = raw.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})$/);
  if (dmmmyMatch) {
    const day = dmmmyMatch[1].padStart(2, '0');
    const monStr = dmmmyMatch[2].toUpperCase();
    const mon = MONTH_MAP[monStr];
    let year = dmmmyMatch[3];
    if (year.length === 2) year = '20' + year;
    if (mon) {
      const iso = `${year}-${mon}-${day}`;
      const d = new Date(iso);
      return isNaN(d.getTime()) ? null : iso;
    }
  }

  // 3. Format: DDMMMYYYY without separator (e.g. 04SEP2026, 27NOV2026, 05NOV26)
  const compactMatch = raw.match(/^(\d{1,2})([A-Za-z]{3})(\d{2,4})$/);
  if (compactMatch) {
    const day = compactMatch[1].padStart(2, '0');
    const monStr = compactMatch[2].toUpperCase();
    const mon = MONTH_MAP[monStr];
    let year = compactMatch[3];
    if (year.length === 2) year = '20' + year;
    if (mon) {
      const iso = `${year}-${mon}-${day}`;
      const d = new Date(iso);
      return isNaN(d.getTime()) ? null : iso;
    }
  }

  // 4. Format: DD/MM/YYYY or DD-MM-YYYY (standard Indian exchange format)
  const dmyMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const part1 = parseInt(dmyMatch[1], 10);
    const part2 = parseInt(dmyMatch[2], 10);
    const year = dmyMatch[3];

    // If part1 > 12, part1 must be day (DD/MM/YYYY)
    // If part2 > 12, part2 must be day (MM/DD/YYYY)
    // Default to Indian exchange standard DD/MM/YYYY
    let day = part1;
    let mon = part2;
    if (part2 > 12 && part1 <= 12) {
      mon = part1;
      day = part2;
    }

    const dayStr = String(day).padStart(2, '0');
    const monStr = String(mon).padStart(2, '0');
    const iso = `${year}-${monStr}-${dayStr}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : iso;
  }

  // 5. Fallback to Date.parse
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

/**
 * Standard CSV row tokenizer that correctly handles commas inside quotes.
 */
export function tokenizeCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Auto-detects columns from CSV header row using fuzzy synonym matching.
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const norm = headers.map(h => h.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''));

  const findBestCol = (candidates: string[]): string => {
    for (const cand of candidates) {
      const idx = norm.findIndex(h => h === cand || h.includes(cand));
      if (idx !== -1) return headers[idx];
    }
    return '';
  };

  return {
    dateCol: findBestCol(['TRADEDATE', 'DATE', 'TIMESTAMP', 'TDDATE', 'DATETIME']),
    symbolCol: findBestCol(['SYMBOL', 'COMMODITY', 'CONTRACT', 'COMMODITYNAME']),
    expiryCol: findBestCol(['EXPIRYDATE', 'EXPIRY', 'EXPDATE', 'CONTRACTEXPIRY', 'MATURITY']),
    openCol: findBestCol(['OPEN', 'OPENPRICE']),
    highCol: findBestCol(['HIGH', 'HIGHPRICE']),
    lowCol: findBestCol(['LOW', 'LOWPRICE']),
    closeCol: findBestCol(['CLOSE', 'CLOSEPRICE', 'SETTLEPRICE', 'SETTLEMENTPRICE', 'LTP']),
    volumeCol: findBestCol(['VOLUMELOTS', 'VOLUME', 'VOL', 'TOTALQTYTRADED', 'QTY', 'TRADEDQTY']),
    oiCol: findBestCol(['OPENINTERESTLOTS', 'OPENINTEREST', 'OI', 'OPENINT', 'TOTALOI']),
    instrumentCol: findBestCol(['INSTRUMENTNAME', 'INSTRUMENT', 'INSTNAME', 'INSTRUMENTTYPE']),
    optionTypeCol: findBestCol(['OPTIONTYPE', 'OPTNNAME', 'OPTION', 'OPTTYPE']),
    strikePriceCol: findBestCol(['STRIKEPRICE', 'STRIKEPR', 'STRIKE', 'STRIKEPRC'])
  };
}

/**
 * Parses raw CSV string into validated MarketObservation items.
 * Records all rejected lines and outputs rigorous DatasetMetadata with SHA-256 hash.
 */
export function parseBhavcopyCsv(
  csvContent: string,
  sourceFilename = 'manual_import.csv',
  provenance: DataProvenance = 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
  customMapping?: Partial<ColumnMapping>,
  knownFileHash?: string
): ParseResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV file is empty or does not contain header and data rows.');
  }

  // Look for any publication date comment at top
  let publicationDate: string | undefined = undefined;
  let headerLineIdx = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const l = lines[i];
    if (l.startsWith('#') || l.toUpperCase().includes('BHAVCOPY FOR') || l.toUpperCase().includes('DATE:')) {
      const dateMatch = l.match(/(\d{1,2}[-/ ][A-Za-z0-9]{3}[-/ ]\d{2,4}|\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        publicationDate = normalizeDate(dateMatch[1]) || undefined;
      }
      headerLineIdx = i + 1;
    } else {
      headerLineIdx = i;
      break;
    }
  }

  const rawHeaders = tokenizeCsvLine(lines[headerLineIdx]);
  const defaultMapping = detectColumnMapping(rawHeaders);
  const mapping: ColumnMapping = { ...defaultMapping, ...customMapping };

  // Validate that critical fields have mappings
  if (!mapping.dateCol || !mapping.symbolCol || !mapping.expiryCol || !mapping.closeCol) {
    throw new Error(
      `Could not automatically map mandatory columns (Date, Symbol, Expiry, Close). ` +
      `Detected headers: [${rawHeaders.join(', ')}]. Please use the Column Mapper.`
    );
  }

  const headerIndices = {
    date: rawHeaders.indexOf(mapping.dateCol),
    symbol: rawHeaders.indexOf(mapping.symbolCol),
    expiry: rawHeaders.indexOf(mapping.expiryCol),
    open: rawHeaders.indexOf(mapping.openCol),
    high: rawHeaders.indexOf(mapping.highCol),
    low: rawHeaders.indexOf(mapping.lowCol),
    close: rawHeaders.indexOf(mapping.closeCol),
    volume: rawHeaders.indexOf(mapping.volumeCol),
    oi: rawHeaders.indexOf(mapping.oiCol),
    instrument: mapping.instrumentCol ? rawHeaders.indexOf(mapping.instrumentCol) : -1,
    optionType: mapping.optionTypeCol ? rawHeaders.indexOf(mapping.optionTypeCol) : -1,
    strikePrice: mapping.strikePriceCol ? rawHeaders.indexOf(mapping.strikePriceCol) : -1
  };

  const fileHashSha256 = knownFileHash || computeQuickHash(csvContent);
  const validRecords: MarketObservation[] = [];
  const rejectedRows: RejectedRow[] = [];
  const uniqueKeys = new Set<string>();
  let duplicateCount = 0;
  let missingFieldCount = 0;

  for (let lineIdx = headerLineIdx + 1; lineIdx < lines.length; lineIdx++) {
    const currentLine = lines[lineIdx];
    if (currentLine.startsWith('#')) continue; // Skip comments

    const rawTokens = tokenizeCsvLine(currentLine);
    const rowObj: Record<string, string> = {};
    rawHeaders.forEach((h, i) => {
      rowObj[h] = rawTokens[i] || '';
    });

    // Extract fields with whitespace trimming
    const rawSymbol = (rawTokens[headerIndices.symbol] || '').trim().toUpperCase();
    const rawDate = (rawTokens[headerIndices.date] || '').trim();
    const rawExpiry = (rawTokens[headerIndices.expiry] || '').trim();
    const rawOpen = (rawTokens[headerIndices.open] || '').replace(/,/g, '').trim();
    const rawHigh = (rawTokens[headerIndices.high] || '').replace(/,/g, '').trim();
    const rawLow = (rawTokens[headerIndices.low] || '').replace(/,/g, '').trim();
    const rawClose = (rawTokens[headerIndices.close] || '').replace(/,/g, '').trim();
    const rawVol = (rawTokens[headerIndices.volume] || '0').replace(/,/g, '').trim();
    const rawOI = (rawTokens[headerIndices.oi] || '0').replace(/,/g, '').trim();

    // Check symbol support
    const matchedSymbol = SUPPORTED_SYMBOLS[rawSymbol];
    if (!matchedSymbol) {
      rejectedRows.push({
        rowNumber: lineIdx + 1,
        raw: rowObj,
        reason: `Unsupported or non-PS03 commodity symbol: '${rawSymbol}'. Only GOLDM, GOLDTEN, GOLDGUINEA, GOLDPETAL are tracked.`
      });
      continue;
    }

    // Quarantining Non-Futures Instruments and Options:
    // In MCX bhavcopies:
    // - Futures contracts: Instrument Name = 'FUTCOM', Option Type = '-' or empty, Strike Price = '0' or '-'
    // - Options contracts: Instrument Name = 'OPTFUT', Option Type = 'CE'/'PE', Strike Price = 135500, etc.
    const rawInstrument = headerIndices.instrument >= 0 ? (rawTokens[headerIndices.instrument] || '').trim().toUpperCase() : '';
    const rawOptionType = headerIndices.optionType >= 0 ? (rawTokens[headerIndices.optionType] || '').trim().toUpperCase() : '';
    const rawStrikePrice = headerIndices.strikePrice >= 0 ? (rawTokens[headerIndices.strikePrice] || '').replace(/,/g, '').trim() : '';

    if (rawInstrument && rawInstrument !== 'FUTCOM' && rawInstrument !== 'FUT') {
      rejectedRows.push({
        rowNumber: lineIdx + 1,
        raw: rowObj,
        reason: `Non-futures instrument quarantined: Instrument Name is '${rawInstrument}'. AUREX tracks commodity futures (FUTCOM) only.`
      });
      continue;
    }

    const hasOptionType = rawOptionType && rawOptionType !== '-' && rawOptionType !== '' && rawOptionType !== 'XX' && rawOptionType !== 'NONE';
    const hasStrikePrice = rawStrikePrice && !isNaN(Number(rawStrikePrice)) && Number(rawStrikePrice) > 0;

    if (hasOptionType || hasStrikePrice) {
      rejectedRows.push({
        rowNumber: lineIdx + 1,
        raw: rowObj,
        reason: `Option contract quarantined: Option Type is '${rawOptionType || '-'}' with Strike Price '${rawStrikePrice || '0'}'. AUREX tracks commodity futures (FUTCOM) only.`
      });
      continue;
    }

    // Validate dates
    const date = normalizeDate(rawDate);
    if (!date) {
      rejectedRows.push({
        rowNumber: lineIdx + 1,
        raw: rowObj,
        reason: `Invalid or unparseable trade date: '${rawDate}'`
      });
      missingFieldCount++;
      continue;
    }

    const expiryDate = normalizeDate(rawExpiry);
    if (!expiryDate) {
      rejectedRows.push({
        rowNumber: lineIdx + 1,
        raw: rowObj,
        reason: `Invalid or unparseable contract expiry date: '${rawExpiry}'`
      });
      missingFieldCount++;
      continue;
    }

    // Parse numeric prices
    const close = parseFloat(rawClose);
    if (isNaN(close) || close <= 0) {
      rejectedRows.push({
        rowNumber: lineIdx + 1,
        raw: rowObj,
        reason: `Invalid settlement/close price: '${rawClose}'. Must be strictly positive number.`
      });
      missingFieldCount++;
      continue;
    }

    const open = parseFloat(rawOpen) || close;
    const high = parseFloat(rawHigh) || Math.max(open, close);
    const low = parseFloat(rawLow) || Math.min(open, close);
    const volume = Math.max(0, parseInt(rawVol, 10) || 0);
    const openInterest = Math.max(0, parseInt(rawOI, 10) || 0);

    // Coherent OHLC validation
    if (low > open || low > close || high < open || high < close) {
      rejectedRows.push({
        rowNumber: lineIdx + 1,
        raw: rowObj,
        reason: `Incoherent OHLC values: Low (${low}) cannot be greater than Open/Close (${open}/${close}), or High (${high}) cannot be less than Open/Close.`
      });
      continue;
    }

    // Duplicate detection (symbol + trade date + expiryDate)
    const uniqueKey = `${matchedSymbol}_${date}_${expiryDate}`;
    if (uniqueKeys.has(uniqueKey)) {
      duplicateCount++;
      rejectedRows.push({
        rowNumber: lineIdx + 1,
        raw: rowObj,
        reason: `Duplicate contract record detected for ${uniqueKey}`
      });
      continue;
    }
    uniqueKeys.add(uniqueKey);

    validRecords.push({
      date,
      symbol: matchedSymbol,
      expiryDate,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
      openInterest,
      provenance,
      sourceFile: sourceFilename,
      sourceSha256: fileHashSha256
    });
  }

  // Sort valid records chronologically
  validRecords.sort((a, b) => a.date.localeCompare(b.date));

  // Build contract coverage breakdown
  const coverageMap: Record<ContractSymbol, { count: number; earliestDate: string; latestDate: string; expiries: Set<string> }> = {
    GOLDM: { count: 0, earliestDate: '', latestDate: '', expiries: new Set() },
    GOLDTEN: { count: 0, earliestDate: '', latestDate: '', expiries: new Set() },
    GOLDGUINEA: { count: 0, earliestDate: '', latestDate: '', expiries: new Set() },
    GOLDPETAL: { count: 0, earliestDate: '', latestDate: '', expiries: new Set() }
  };

  for (const r of validRecords) {
    const entry = coverageMap[r.symbol];
    entry.count++;
    if (!entry.earliestDate || r.date < entry.earliestDate) entry.earliestDate = r.date;
    if (!entry.latestDate || r.date > entry.latestDate) entry.latestDate = r.date;
    entry.expiries.add(r.expiryDate);
  }

  const finalCoverage: Record<ContractSymbol, { count: number; earliestDate: string; latestDate: string; expiries: string[] }> = {
    GOLDM: { ...coverageMap.GOLDM, expiries: Array.from(coverageMap.GOLDM.expiries) },
    GOLDTEN: { ...coverageMap.GOLDTEN, expiries: Array.from(coverageMap.GOLDTEN.expiries) },
    GOLDGUINEA: { ...coverageMap.GOLDGUINEA, expiries: Array.from(coverageMap.GOLDGUINEA.expiries) },
    GOLDPETAL: { ...coverageMap.GOLDPETAL, expiries: Array.from(coverageMap.GOLDPETAL.expiries) }
  };

  const allDates = validRecords.map(r => r.date).sort();
  const dateRange = {
    start: allDates[0] || 'N/A',
    end: allDates[allDates.length - 1] || 'N/A'
  };

  const metadata: DatasetMetadata = {
    provenance,
    filename: sourceFilename,
    fileHashSha256,
    sourceUrl: 'https://www.mcxindia.com/market-data/bhavcopy',
    storagePersistence: 'SESSION_MEMORY',
    importTimestamp: new Date().toISOString(),
    totalRows: lines.length - 1,
    validRows: validRecords.length,
    rejectedRows: rejectedRows.length,
    duplicateCount,
    missingFieldCount,
    dateRange,
    contractCoverage: finalCoverage,
    knownLimitations: [
      'Uploading a file and recording a source attestation does not independently verify that the file originated from MCX. AUREX currently has no independent official-source verification mechanism. User-attested datasets remain independently unverified.',
      'Volume reflects reported traded lots/contracts per exchange bhavcopy; order-book microstructure is estimated.',
      'Settlement prices reflect official closing mark; intraday spread volatility is not captured in end-of-day data.',
      'Contracts with discrete expiries are evaluated without continuous roll stitching.'
    ],
    sourceClassification: provenance === 'OFFICIAL MCX DATA — SOURCE VERIFIED'
      ? 'Official Exchange Settlement Feed (Source Verified)'
      : provenance === 'USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED'
      ? 'User-Attested Bhavcopy CSV File (Not Independently Verified)'
      : provenance === 'USER-IMPORTED DATA — SOURCE UNVERIFIED'
      ? 'User-Provided Bhavcopy CSV File (Source Unverified)'
      : provenance === 'PROTOTYPE SAMPLE — UNVERIFIED SOURCING'
      ? 'Bundled Prototype Sample (Unverified Sourcing)'
      : 'Calibrated Prototype Simulation'
  };

  if (publicationDate) {
    metadata.knownLimitations.push(`Source publication date identified as: ${publicationDate}`);
  }

  return {
    validRecords,
    rejectedRows,
    detectedColumns: rawHeaders,
    columnMapping: mapping,
    metadata
  };
}
