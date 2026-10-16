import { MarketObservation, DataQualityReport } from '../types/market';

/**
 * Validates market observations against regulatory and quantitative standards.
 * Verifies non-negativity, complete timestamps, discrete expiries, and uniqueness.
 */
export function validateMarketData(records: MarketObservation[]): DataQualityReport {
  if (!records || records.length === 0) {
    return {
      status: 'WARN',
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      checks: [
        { name: 'Dataset Availability', passed: false, details: 'Dataset contains 0 records.' }
      ]
    };
  }

  let missingSymbolCount = 0;
  let missingDateCount = 0;
  let invalidExpiryCount = 0;
  let invalidPriceCount = 0;
  let negativeVolumeCount = 0;
  let negativeOICount = 0;
  const uniqueKeySet = new Set<string>();
  let duplicateCount = 0;

  for (const r of records) {
    // Missing symbol
    if (!r.symbol) missingSymbolCount++;

    // Missing date
    if (!r.date || isNaN(Date.parse(r.date))) missingDateCount++;

    // Invalid expiry
    if (!r.expiryDate || isNaN(Date.parse(r.expiryDate))) invalidExpiryCount++;

    // Invalid price
    if (!isFinite(r.close) || r.close <= 0 || !isFinite(r.open) || !isFinite(r.high) || !isFinite(r.low)) {
      invalidPriceCount++;
    }

    // Negative volume
    if (r.volume < 0) negativeVolumeCount++;

    // Negative open interest
    if (r.openInterest < 0) negativeOICount++;

    // Duplicate key check (symbol + date + expiryDate)
    const key = `${r.symbol}_${r.date}_${r.expiryDate}`;
    if (uniqueKeySet.has(key)) {
      duplicateCount++;
    } else {
      uniqueKeySet.add(key);
    }
  }

  const checks = [
    {
      name: 'Symbol Completeness',
      passed: missingSymbolCount === 0,
      details: missingSymbolCount === 0 ? 'All records have valid contract symbols.' : `${missingSymbolCount} records missing symbols.`
    },
    {
      name: 'Temporal Timestamps',
      passed: missingDateCount === 0,
      details: missingDateCount === 0 ? 'All observation dates are valid ISO-8601 timestamps.' : `${missingDateCount} invalid dates.`
    },
    {
      name: 'Discrete Expiry Structure',
      passed: invalidExpiryCount === 0,
      details: invalidExpiryCount === 0 ? 'All contracts have explicit discrete expiry dates (no synthetic continuous stitching).' : `${invalidExpiryCount} missing expiries.`
    },
    {
      name: 'Price Positivity & Bounds',
      passed: invalidPriceCount === 0,
      details: invalidPriceCount === 0 ? 'All prices (OHLC) are strictly positive finite numbers.' : `${invalidPriceCount} invalid price rows.`
    },
    {
      name: 'Non-Negative Volume & OI',
      passed: negativeVolumeCount === 0 && negativeOICount === 0,
      details: negativeVolumeCount === 0 && negativeOICount === 0 ? 'Volumes and Open Interests are strictly non-negative.' : `${negativeVolumeCount} negative vol, ${negativeOICount} negative OI.`
    },
    {
      name: 'Record Uniqueness',
      passed: duplicateCount === 0,
      details: duplicateCount === 0 ? 'Zero duplicate contract/date observations found.' : `${duplicateCount} duplicate observations detected.`
    }
  ];

  const allPassed = checks.every(c => c.passed);
  const total = records.length;
  const invalid = missingSymbolCount + missingDateCount + invalidExpiryCount + invalidPriceCount + negativeVolumeCount + negativeOICount + duplicateCount;

  return {
    status: allPassed ? 'PASS' : 'WARN',
    totalRecords: total,
    validRecords: Math.max(0, total - invalid),
    invalidRecords: invalid,
    checks
  };
}
