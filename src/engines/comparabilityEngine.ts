import { 
  ContractSymbol, 
  NormalizedObservation, 
  PairComparabilityReport, 
  ComparabilityClassification 
} from '../types/market';
import { calculateDaysToExpiry } from './normalizationEngine';

/**
 * AUREX Contract Comparability Engine (Priority Three)
 * 
 * Evaluates whether two distinct MCX gold futures contracts can be compared
 * economically on a specific date, factoring in maturity mismatch, liquidity,
 * and discrete expiry lifecycle.
 * 
 * Rules:
 * - Same metal does not mean same contract economics.
 * - If expiry dates differ, spread includes term-structure carry/roll basis.
 * - Does not invent spline curves from insufficient observations.
 * - Does not stitch near-month contracts into synthetic continuous series.
 */
export function evaluateContractComparability(
  obsA?: NormalizedObservation,
  obsB?: NormalizedObservation,
  pair: [ContractSymbol, ContractSymbol] = ['GOLDM', 'GOLDTEN']
): PairComparabilityReport {
  const symbolA = pair[0];
  const symbolB = pair[1];

  // Insufficient data guard
  if (!obsA || !obsB || !isFinite(obsA.normalizedPrice) || !isFinite(obsB.normalizedPrice)) {
    return {
      pair,
      date: obsA?.date || obsB?.date || 'N/A',
      symbolA,
      symbolB,
      expiryA: obsA?.expiryDate || 'N/A',
      expiryB: obsB?.expiryDate || 'N/A',
      daysToExpiryA: 0,
      daysToExpiryB: 0,
      expiryDifferenceDays: 0,
      dataDateAlignment: false,
      normalizedPriceA: obsA?.normalizedPrice || 0,
      normalizedPriceB: obsB?.normalizedPrice || 0,
      spread: 0,
      volA: obsA?.volume || 0,
      oiA: obsA?.openInterest || 0,
      volB: obsB?.volume || 0,
      oiB: obsB?.openInterest || 0,
      classification: 'INSUFFICIENT DATA',
      warnings: ['One or both contract legs lack market observations for this trade date.'],
      termStructureNote: 'Cannot evaluate term structure without simultaneous settlement observations.'
    };
  }

  const dateAlignment = obsA.date === obsB.date;
  const dteA = obsA.daysToExpiry !== undefined ? obsA.daysToExpiry : calculateDaysToExpiry(obsA.date, obsA.expiryDate);
  const dteB = obsB.daysToExpiry !== undefined ? obsB.daysToExpiry : calculateDaysToExpiry(obsB.date, obsB.expiryDate);
  const expiryDiff = Math.abs(dteA - dteB);
  const spread = Number((obsA.normalizedPrice - obsB.normalizedPrice).toFixed(2));

  const warnings: string[] = [];

  if (!dateAlignment) {
    warnings.push(`Temporal Misalignment: ${symbolA} date (${obsA.date}) differs from ${symbolB} date (${obsB.date}).`);
  }

  // Expiry difference warning
  if (expiryDiff > 0) {
    warnings.push(
      `Maturity Mismatch: ${symbolA} expires ${obsA.expiryDate} (${dteA}d to expiry), whereas ${symbolB} expires ${obsB.expiryDate} (${dteB}d to expiry). Expiry difference is ${expiryDiff} calendar days.`
    );
  }

  // Thin leg warning
  const minVol = Math.min(obsA.volume, obsB.volume);
  const thinnerSymbol = obsA.volume < obsB.volume ? symbolA : symbolB;
  if (minVol < 500) {
    warnings.push(
      `Execution Bottleneck: Thinner leg (${thinnerSymbol}) reported only ${minVol} lots volume. Spread execution capacity is strictly constrained by this leg.`
    );
  }

  // Classification logic
  let classification: ComparabilityClassification;
  let termStructureNote = '';

  if (!dateAlignment) {
    classification = 'INSUFFICIENT DATA';
    termStructureNote = 'Observations are from different trading sessions; spread is not economically contemporaneous.';
  } else if (expiryDiff <= 5) {
    classification = 'COMPARABLE';
    termStructureNote = 'Near-synchronous maturities: Spread represents primarily delivery/lot size basis rather than calendar carry.';
  } else {
    classification = 'COMPARABLE WITH MATURITY DIFFERENCE';
    termStructureNote = `Spread includes ${expiryDiff}-day financing, warehouse storage, and term-structure roll carry. Do not interpret raw spread as pure instantaneous arbitrage.`;
  }

  return {
    pair,
    date: obsA.date,
    symbolA,
    symbolB,
    expiryA: obsA.expiryDate,
    expiryB: obsB.expiryDate,
    daysToExpiryA: dteA,
    daysToExpiryB: dteB,
    expiryDifferenceDays: expiryDiff,
    dataDateAlignment: dateAlignment,
    normalizedPriceA: obsA.normalizedPrice,
    normalizedPriceB: obsB.normalizedPrice,
    spread,
    volA: obsA.volume,
    oiA: obsA.openInterest,
    volB: obsB.volume,
    oiB: obsB.openInterest,
    classification,
    warnings,
    termStructureNote
  };
}
