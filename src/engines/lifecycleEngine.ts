import {
  ContractSymbol,
  ContractLifecycleStage,
  LifecycleEligibilityCheck
} from '../types/market';
import { CONTRACT_SPECIFICATIONS, CONTRACT_DELIVERY_RULES } from '../data/contracts';
import { calculateDaysToExpiry } from './normalizationEngine';
import { calculateTradingDays } from '../utils/exchangeCalendar';

/**
 * Contract Lifecycle & Trading Eligibility Engine
 *
 * Enforces authoritative MCX bullion tender period and delivery restrictions.
 * Prevents catastrophic physical delivery allocation by barring new positions
 * during the 5-trading-day tender window and enforcing modelled safety exits.
 *
 * Authoritative References:
 * - MCX Circular No. MCX/TRD/134/2025 (Launch of Gold Ten Futures & Compulsory Delivery Specifications)
 * - MCX Gold Mini, Gold Guinea & Gold Petal Contract Specifications
 * - SEBI Master Circular for Commodity Derivatives Exchanges (Tender Window & Delivery Margins)
 */
export function evaluateLifecycleEligibility(
  symbol: ContractSymbol,
  currentDateStr: string,
  expiryDateStr: string,
  customHolidays?: readonly string[]
): LifecycleEligibilityCheck {
  const spec = CONTRACT_SPECIFICATIONS[symbol];
  const deliveryRules = CONTRACT_DELIVERY_RULES[symbol];
  const daysToExpiry = calculateDaysToExpiry(currentDateStr, expiryDateStr);
  const tradingDays = calculateTradingDays(currentDateStr, expiryDateStr, customHolidays);

  const warnings: string[] = [];
  let isEligibleForNewEntry = true;
  let mustForcedExit = false;
  let rejectionReason: string | undefined = undefined;

  // 1. Verify listing effective date (e.g. GOLDTEN effective from 2025-04-01)
  if (spec?.listingEffectiveDate && currentDateStr < spec.listingEffectiveDate) {
    isEligibleForNewEntry = false;
    mustForcedExit = true;
    rejectionReason = `Contract ${symbol} was not listed on MCX on ${currentDateStr}. Official effective launch date: ${spec.listingEffectiveDate} (Ref: ${deliveryRules?.officialCircularReference || 'MCX Circular MCX/TRD/134/2025'}).`;
    warnings.push(rejectionReason);
  }

  // 2. Classify lifecycle stage using authoritative TRADING DAYS for tender period
  let lifecycleStage: ContractLifecycleStage = 'NORMAL';
  const tenderTradingDays = deliveryRules?.tenderPeriodDays || 5;

  if (daysToExpiry <= 0 || tradingDays <= 0) {
    lifecycleStage = 'ROLL_WINDOW';
    isEligibleForNewEntry = false;
    mustForcedExit = true;
    rejectionReason = `Contract ${symbol} has expired on ${expiryDateStr}. No trading permitted.`;
    warnings.push(rejectionReason);
  } else if (tradingDays <= tenderTradingDays) {
    lifecycleStage = 'ROLL_WINDOW';
    isEligibleForNewEntry = false;
    mustForcedExit = true;
    rejectionReason = `Contract ${symbol} has entered the MCX 5-trading-day tender window (${tradingDays} trading days / ${daysToExpiry} calendar days to expiry on ${expiryDateStr}). Under MCX compulsory delivery rules (Circular MCX/TRD/134/2025), new entry positions are strictly restricted and open speculative positions must be liquidated to prevent physical delivery obligations.`;
    warnings.push(rejectionReason);
  } else if (tradingDays <= 10 || daysToExpiry <= 15) {
    lifecycleStage = 'NEAR_EXPIRY';
    warnings.push(`Contract ${symbol} is near expiry (${tradingDays} trading days / ${daysToExpiry} calendar days remaining). Approaching delivery tender window; holding period should not exceed ${tradingDays - tenderTradingDays} trading sessions.`);
  }

  return {
    symbol,
    date: currentDateStr,
    expiryDate: expiryDateStr,
    daysToExpiry,
    tradingDaysToExpiry: tradingDays,
    lifecycleStage,
    isEligibleForNewEntry,
    mustForcedExit,
    warnings,
    rejectionReason
  };
}

/**
 * Checks pair lifecycle compatibility for a proposed spread trade.
 * Both legs must pass eligibility to permit entry.
 */
export function evaluatePairLifecycleEligibility(
  pair: [ContractSymbol, ContractSymbol],
  currentDateStr: string,
  expiryA: string,
  expiryB: string,
  customHolidays?: readonly string[]
): {
  isEligible: boolean;
  legA: LifecycleEligibilityCheck;
  legB: LifecycleEligibilityCheck;
  rejectionReason?: string;
  warnings: string[];
} {
  const legA = evaluateLifecycleEligibility(pair[0], currentDateStr, expiryA, customHolidays);
  const legB = evaluateLifecycleEligibility(pair[1], currentDateStr, expiryB, customHolidays);

  const warnings = [...legA.warnings, ...legB.warnings];
  const isEligible = legA.isEligibleForNewEntry && legB.isEligibleForNewEntry;
  let rejectionReason: string | undefined = undefined;

  if (!legA.isEligibleForNewEntry) {
    rejectionReason = `Leg A (${pair[0]}): ${legA.rejectionReason}`;
  } else if (!legB.isEligibleForNewEntry) {
    rejectionReason = `Leg B (${pair[1]}): ${legB.rejectionReason}`;
  }

  return {
    isEligible,
    legA,
    legB,
    rejectionReason,
    warnings
  };
}
