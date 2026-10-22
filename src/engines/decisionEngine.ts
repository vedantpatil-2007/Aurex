import {
  ContractSymbol,
  DecisionResult,
  DecisionState,
  FrictionAssumptions,
  DataSufficiencyAssessment
} from '../types/market';
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
  dataSufficiency?: DataSufficiencyAssessment;
  isCalculable?: boolean;
  incalculableReason?: string;
}

/**
 * AUREX Core Decision Engine (Phase 2 Enhanced + Master Integrity)
 *
 * Pipeline:
 * DATA SUFFICIENCY GATE -> LIQUIDITY CHECK -> EXECUTION COST CHECK -> DECISION
 *
 * States:
 * - ACTIONABLE: Observed relative-value edge survives data sufficiency, liquidity and estimated execution friction.
 * - WATCH: Relative-value anomaly detected, but liquidity is near the configured threshold or preliminary.
 * - NO TRADE: Theoretical opportunity does not survive estimated execution friction, fails liquidity, or lacks historical data.
 *             (Recognized as a valid capital preservation system outcome).
 */
export function evaluateDecision(inputs: DecisionEngineInputs): DecisionResult {
  const {
    pair,
    observedSpread,
    manualExpectedEdge,
    volA,
    oiA,
    volB,
    oiB,
    friction,
    dataSufficiency,
    isCalculable,
    incalculableReason
  } = inputs;

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

  // Gate 0: Data Sufficiency & Provenance Isolation (Prevent unsupported actionable verdicts on isolated single dates)
  const isMarketDerived = manualExpectedEdge === undefined;
  const lacksSufficiency = isCalculable === false || (dataSufficiency && !dataSufficiency.canFormActionableVerdict);

  if (isMarketDerived && lacksSufficiency) {
    decision = 'NO TRADE';
    const reasonDetail = isCalculable === false
      ? (incalculableReason || 'Insufficient historical sessions (< 5 sessions) for calibrated rolling statistical baseline')
      : (dataSufficiency?.reasons?.[0] || 'Walk-forward validation requires at least 15 sequential sessions');
    rationale = `Theoretical opportunity cannot be validated: ${reasonDetail}. A single-session or isolated observation without established single-provenance spread distribution cannot produce an actionable market execution verdict.`;
    triggerRules.push('Data Sufficiency Gate Triggered: Insufficient historical sessions to validate statistical edge.');
    triggerRules.push('Capital Preservation Rule: Capital preserved — no market orders without statistically verified distribution.');
  }
  // 1. Liquidity check (Capital preservation / market impact rule)
  else if (liquidityGrade === 'FAIL') {
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
    triggerRules.push(`Rule 2 Triggered: Expected Edge (₹${expectedEdge}) ≤ Total Friction (₹${totalFriction})`);
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
    triggerRules.push(`Rule 4 Triggered: Net Edge (+₹${netEdge}/10g) > 0 and Liquidity Grade = PASS (${liquidityScore} ≥ ${friction.liquidityThresholdScore})`);
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
    waterfall,
    dataSufficiency,
    isDefensible: decision === 'ACTIONABLE'
  };
}
