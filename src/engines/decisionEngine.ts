import { ContractSymbol, DecisionResult, DecisionState, FrictionAssumptions } from '../types/market';
import { calculateLiquidityScore, evaluateLiquidityGrade, buildCostWaterfall } from './liquidityCostEngine';

export interface DecisionEngineInputs {
  pair: [ContractSymbol, ContractSymbol];
  observedSpread: number;         // Current spread (₹ / 10g)
  manualExpectedEdge?: number;    // Optional manual demonstration override
  volA: number;
  oiA: number;
  volB: number;
  oiB: number;
  friction: FrictionAssumptions;
}

/**
 * AUREX Core Decision Engine (Phase 2 Enhanced)
 *
 * Pipeline:
 * THEORETICAL EDGE -> LIQUIDITY CHECK -> EXECUTION COST CHECK -> DECISION
 *
 * States:
 * - ACTIONABLE: Observed relative-value edge survives liquidity and estimated execution friction.
 * - WATCH: Relative-value anomaly detected, but liquidity is near the configured threshold.
 * - NO TRADE: Theoretical opportunity does not survive estimated execution friction (or fails liquidity).
 *             (Recognized as a valid capital preservation system outcome).
 */
export function evaluateDecision(inputs: DecisionEngineInputs): DecisionResult {
  const { pair, observedSpread, manualExpectedEdge, volA, oiA, volB, oiB, friction } = inputs;

  const expectedEdge = manualExpectedEdge !== undefined
    ? Math.max(0, manualExpectedEdge)
    : Math.abs(observedSpread);

  const waterfall = buildCostWaterfall(expectedEdge, friction);
  const totalFriction = waterfall.totalFriction;
  const netEdge = waterfall.netDefensibleEdge;

  const liquidityScore = calculateLiquidityScore(volA, oiA, volB, oiB);
  const liquidityGrade = evaluateLiquidityGrade(liquidityScore, friction.liquidityThresholdScore);

  let decision: DecisionState;
  let rationale = '';
  const triggerRules: string[] = [];

  // 1. Liquidity check first (Capital preservation / market impact rule)
  if (liquidityGrade === 'FAIL') {
    decision = 'NO TRADE';
    rationale = `Theoretical opportunity does not survive execution screening: Liquidity score (${liquidityScore}/100) failed minimum execution threshold (${friction.liquidityThresholdScore}). Order book depth is insufficient to execute without severe adverse market impact.`;
    triggerRules.push(`Rule 1 Triggered: Liquidity Grade = FAIL (${liquidityScore} < ${Math.round(friction.liquidityThresholdScore * 0.75)})`);
    triggerRules.push(`Capital Preservation Rule: NO TRADE is a valid risk management outcome to prevent illiquid trapped positions.`);
  }
  // 2. Cost friction check (Honest validation rule)
  else if (expectedEdge <= totalFriction) {
    decision = 'NO TRADE';
    const deficit = Math.abs(netEdge);
    rationale = `Theoretical opportunity does not survive estimated execution friction. Theoretical edge of ₹${expectedEdge.toFixed(2)} is exceeded by transaction hurdles (₹${totalFriction.toFixed(2)}), resulting in a net deficit of ₹${deficit.toFixed(2)}/10g.`;
    triggerRules.push(`Rule 2 Triggered: Expected Edge (₹${expectedEdge}) â‰¤ Total Friction (₹${totalFriction})`);
    triggerRules.push(`Cost Integrity Rule: Reject false signals where slippage, taxes, haircut & buffer consume the theoretical edge.`);
  }
  // 3. Borderline liquidity check (Watchlist / pending confirmation)
  else if (liquidityGrade === 'BORDERLINE') {
    decision = 'WATCH';
    rationale = `Relative-value anomaly detected (+₹${netEdge.toFixed(2)}/10g net edge), but liquidity is near the configured threshold (${liquidityScore}/100 vs ${friction.liquidityThresholdScore}). Stage for execution but monitor spread stability and depth.`;
    triggerRules.push(`Rule 3 Triggered: Net Edge > 0 (+₹${netEdge}), but Liquidity is BORDERLINE (${liquidityScore} in [${Math.round(friction.liquidityThresholdScore * 0.75)}, ${friction.liquidityThresholdScore}))`);
    triggerRules.push(`Prudence Rule: Do not commit capital until volume confirms.`);
  }
  // 4. Actionable opportunity
  else {
    decision = 'ACTIONABLE';
    rationale = `Observed relative-value edge survives liquidity and estimated execution friction. Dislocation of ₹${expectedEdge.toFixed(2)}/10g yields net defensible edge of +₹${netEdge.toFixed(2)}/10g with confirmed liquidity depth (${liquidityScore}/100).`;
    triggerRules.push(`Rule 4 Triggered: Net Edge (+₹${netEdge}/10g) > 0 and Liquidity Grade = PASS (${liquidityScore} â‰¥ ${friction.liquidityThresholdScore})`);
    triggerRules.push(`Actionable Signal: Dislocation exceeds all transaction hurdles with sufficient depth.`);
  }

  return {
    pair,
    observedSpread,
    expectedEdge: Number(expectedEdge.toFixed(2)),
    totalFriction,
    netEdge,
    liquidityScore,
    liquidityGrade,
    decision,
    rationale,
    triggerRules,
    waterfall
  };
}
