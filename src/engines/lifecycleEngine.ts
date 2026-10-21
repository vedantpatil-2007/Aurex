import {
  ContractSymbol,
  ContractLifecycleStage,
  LifecycleEligibilityCheck
} from '../types/market';
import { CONTRACT_SPECIFICATIONS, CONTRACT_DELIVERY_RULES } from '../data/contracts';
import { calculateDaysToExpiry } from './normalizationEngine';

/**
 * Contract Lifecycle & Trading Eligibility Engine
 *
 * Enforces authoritative MCX bullion tender period and delivery restrictions.
 * Prevents catastrophic physical delivery allocation by barring new positions
 * during the 5-day tender window and enforcing planned exits.
 */
export function evaluateLifecycleEligibility(
  symbol: ContractSymbol,
  currentDateStr: string,
  expiryDateStr: string
): LifecycleEligibilityCheck {
  const spec = CONTRACT_SPECIFICATIONS[symbol];
  const deliveryRules = CONTRACT_DELIVERY_RULES[symbol];
  const daysToExpiry = calculateDaysToExpiry(currentDateStr, expiryDateStr);

  const warnings: string[] = [];
  let isEligibleForNewEntry = true;
  let mustForcedExit = false;
  let rejectionReason: string | undefined = undefined;

  // 1. Verify listing effective date (e.g. GOLDTEN effective from 2025-04-01)
  if (spec?.listingEffectiveDate && currentDateStr < spec.listingEffectiveDate) {
    isEligibleForNewEntry = false;
    mustForcedExit = true;
    rejectionReason = `Contract ${symbol} was not listed on MCX on ${currentDateStr}. Official effective launch date: ${spec.listingEffectiveDate} (Ref: ${deliveryRules?.officialCircularReference || 'MCX Circular'}).`;
    warnings.push(rejectionReason);
  }

  // 2. Classify lifecycle stage
  let lifecycleStage: ContractLifecycleStage = 'NORMAL';

  if (daysToExpiry <= 0) {
    lifecycleStage = 'ROLL_WINDOW';
    isEligibleForNewEntry = false;
    mustForcedExit = true;
    rejectionReason = `Contract ${symbol} has expired on ${expiryDateStr}. No trading permitted.`;
    warnings.push(rejectionReason);
  } else if (daysToExpiry <= (deliveryRules?.tenderPeriodDays || 5)) {
    lifecycleStage = 'ROLL_WINDOW';
    isEligibleForNewEntry = false;
    mustForcedExit = true;
    rejectionReason = `Contract ${symbol} has entered the MCX 5-day tender window (${daysToExpiry} days to expiry). Under MCX compulsory delivery rules, new entry positions are strictly restricted to prevent physical vault delivery obligations.`;
    warnings.push(rejectionReason);
  } else if (daysToExpiry <= 15) {
    lifecycleStage = 'NEAR_EXPIRY';
    warnings.push(`Contract ${symbol} is near expiry (${daysToExpiry} days remaining). Approaching delivery/tender window; holding period should not exceed ${daysToExpiry - 5} sessions.`);
  }

  return {
    symbol,
    date: currentDateStr,
    expiryDate: expiryDateStr,
    daysToExpiry,
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
  expiryB: string
): {
  isEligible: boolean;
  legA: LifecycleEligibilityCheck;
  legB: LifecycleEligibilityCheck;
  rejectionReason?: string;
  warnings: string[];
} {
  const legA = evaluateLifecycleEligibility(pair[0], currentDateStr, expiryA);
  const legB = evaluateLifecycleEligibility(pair[1], currentDateStr, expiryB);

  const warnings = [...legA.warnings, ...legB.warnings];
  let isEligible = legA.isEligibleForNewEntry && legB.isEligibleForNewEntry;
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
