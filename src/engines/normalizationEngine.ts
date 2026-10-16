import { ContractSpecification, MarketObservation, NormalizedObservation, NormalizationBreakdown } from '../types/market';
import { CONTRACT_SPECIFICATIONS } from '../data/contracts';

/**
 * Precision Normalization Engine for MCX Gold Contracts
 * 
 * Standard Economic Benchmark: ₹ / 10g @ 999 Purity
 * 
 * Formula:
 * Price_norm = Raw Price × (10 / Quote Unit) × (999 / Purity)
 * 
 * Where:
 * - 10 / Quote Unit: scales quote basis to 10 grams
 * - 999 / Purity: adjusts fineness basis from 995 to 999 (fine gold)
 */
export function normalizePrice(
  rawPrice: number,
  quoteUnit: number,
  purity: number
): {
  normalizedPrice: number;
  unitAdjustment: number;
  purityAdjustment: number;
} {
  if (rawPrice <= 0 || !isFinite(rawPrice)) {
    return { normalizedPrice: 0, unitAdjustment: 0, purityAdjustment: 0 };
  }
  if (quoteUnit <= 0 || !isFinite(quoteUnit)) {
    throw new Error(`Invalid quoteUnit: ${quoteUnit}. Must be positive number.`);
  }
  if (purity <= 0 || !isFinite(purity)) {
    throw new Error(`Invalid purity: ${purity}. Must be positive number.`);
  }

  const unitAdjustment = 10 / quoteUnit;
  const purityAdjustment = 999 / purity;
  const normalizedPrice = rawPrice * unitAdjustment * purityAdjustment;

  return {
    normalizedPrice: Number(normalizedPrice.toFixed(2)),
    unitAdjustment: Number(unitAdjustment.toFixed(6)),
    purityAdjustment: Number(purityAdjustment.toFixed(6))
  };
}

/**
 * Returns detailed step-by-step breakdown of how a raw contract price
 * is mapped to the standard benchmark.
 */
export function getNormalizationBreakdown(
  rawPrice: number,
  spec: ContractSpecification
): NormalizationBreakdown {
  const { normalizedPrice, unitAdjustment, purityAdjustment } = normalizePrice(
    rawPrice,
    spec.quoteUnitGrams,
    spec.purityPermille
  );

  return {
    rawPrice,
    quoteUnit: spec.quoteUnitGrams,
    purity: spec.purityPermille,
    unitMultiplier: unitAdjustment,
    purityMultiplier: purityAdjustment,
    scalingFactor: Number((unitAdjustment * purityAdjustment).toFixed(6)),
    normalizedPrice,
    benchmarkUnit: '₹ / 10g @ 999'
  };
}

/**
 * Calculates calendar days remaining until contract expiry.
 */
export function calculateDaysToExpiry(currentDateStr: string, expiryDateStr: string): number {
  try {
    const current = new Date(currentDateStr);
    const expiry = new Date(expiryDateStr);
    const diffTime = expiry.getTime() - current.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  } catch {
    return 0;
  }
}

/**
 * Normalizes a single market observation with contract metadata.
 */
export function normalizeObservation(
  obs: MarketObservation,
  spec?: ContractSpecification
): NormalizedObservation {
  const contractSpec = spec || CONTRACT_SPECIFICATIONS[obs.symbol];
  if (!contractSpec) {
    throw new Error(`Unknown contract symbol: ${obs.symbol}`);
  }

  const { normalizedPrice, unitAdjustment, purityAdjustment } = normalizePrice(
    obs.close,
    contractSpec.quoteUnitGrams,
    contractSpec.purityPermille
  );

  const daysToExpiry = calculateDaysToExpiry(obs.date, obs.expiryDate);

  let lifecycleStage: 'NORMAL' | 'NEAR_EXPIRY' | 'ROLL_WINDOW' = 'NORMAL';
  if (daysToExpiry <= 5) {
    lifecycleStage = 'ROLL_WINDOW';
  } else if (daysToExpiry <= 15) {
    lifecycleStage = 'NEAR_EXPIRY';
  }

  return {
    ...obs,
    normalizedPrice,
    unitAdjustment,
    purityAdjustment,
    daysToExpiry,
    lifecycleStage
  };
}
