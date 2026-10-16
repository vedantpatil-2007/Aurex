import { FrictionAssumptions, LiquidityGrade, CostWaterfallBreakdown } from '../types/market';

/**
 * Calculates total execution friction per 10 grams benchmark.
 * 
 * Friction Breakdown:
 * 1. Estimated bid-ask slippage on pair execution (₹ / 10g)
 * 2. Exchange turnover fees, STT, GST, SEBI fee & brokerage (₹ / 10g)
 * 3. Liquidity haircut / market impact penalty (₹ / 10g)
 * 4. Safety buffer / execution margin of error (₹ / 10g)
 */
export function calculateTotalFriction(assumptions: FrictionAssumptions): number {
  const slippage = Math.max(0, assumptions.slippagePer10g || 0);
  const brokerage = Math.max(0, assumptions.brokerageTaxesPer10g || 0);
  const haircut = Math.max(0, assumptions.liquidityHaircutPer10g || 0);
  const buffer = Math.max(0, assumptions.costBufferPer10g || 0);

  return Number((slippage + brokerage + haircut + buffer).toFixed(2));
}

/**
 * Builds structured waterfall decomposition:
 * THEORETICAL EDGE -> SLIPPAGE -> BROKERAGE/TAXES -> LIQUIDITY HAIRCUT -> SAFETY BUFFER -> NET DEFENSIBLE EDGE
 */
export function buildCostWaterfall(
  theoreticalEdge: number,
  assumptions: FrictionAssumptions
): CostWaterfallBreakdown {
  const edge = Math.max(0, theoreticalEdge);
  const slippage = Math.max(0, assumptions.slippagePer10g || 0);
  const brokerageTaxes = Math.max(0, assumptions.brokerageTaxesPer10g || 0);
  const liquidityHaircut = Math.max(0, assumptions.liquidityHaircutPer10g || 0);
  const safetyBuffer = Math.max(0, assumptions.costBufferPer10g || 0);

  const totalFriction = Number((slippage + brokerageTaxes + liquidityHaircut + safetyBuffer).toFixed(2));
  const netDefensibleEdge = Number((edge - totalFriction).toFixed(2));

  return {
    theoreticalEdge: Number(edge.toFixed(2)),
    slippage,
    brokerageTaxes,
    liquidityHaircut,
    safetyBuffer,
    totalFriction,
    netDefensibleEdge
  };
}

/**
 * Computes a standardized composite liquidity score (0–100)
 * based on the lower-liquidity leg of the contract pair.
 * 
 * In cross-contract relative value, execution capacity is always constrained
 * by the thinnest leg (e.g. GOLDGUINEA or GOLDPETAL vs GOLDM).
 */
export function calculateLiquidityScore(
  volA: number,
  oiA: number,
  volB: number,
  oiB: number
): number {
  // Safe defaults
  const vA = Math.max(0, volA || 0);
  const vB = Math.max(0, volB || 0);
  const oA = Math.max(0, oiA || 0);
  const oB = Math.max(0, oiB || 0);

  // Thinner leg constraints
  const minVol = Math.min(vA, vB);
  const minOI = Math.min(oA, oB);

  // Benchmark volumes on MCX for viable 100g equivalent spread execution:
  // Vol > 2000 lots & OI > 3000 lots = 100
  // Vol < 200 lots or OI < 400 lots = < 40
  const volScore = Math.min(50, (minVol / 2000) * 50);
  const oiScore = Math.min(50, (minOI / 3000) * 50);

  const rawScore = volScore + oiScore;
  return Number(Math.min(100, Math.max(0, rawScore)).toFixed(1));
}

/**
 * Evaluates liquidity grade based on composite liquidity score
 * against the configurable liquidity threshold.
 */
export function evaluateLiquidityGrade(
  liquidityScore: number,
  threshold: number
): LiquidityGrade {
  if (liquidityScore < threshold * 0.75) {
    return 'FAIL';
  } else if (liquidityScore < threshold) {
    return 'BORDERLINE';
  } else {
    return 'PASS';
  }
}
