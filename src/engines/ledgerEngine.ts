import { 
  ContractSymbol, 
  NormalizedObservation, 
  FrictionAssumptions, 
  EdgeSurvivalLedgerData, 
  LedgerStageData,
  DataProvenance,
  DataSufficiencyAssessment
} from '../types/market';
import { CONTRACT_SPECIFICATIONS } from '../data/contracts';
import { evaluateContractComparability } from './comparabilityEngine';
import { calculateSpread } from './relativeValueEngine';
import { evaluateDecision } from './decisionEngine';
import { calculateTotalFriction } from './liquidityCostEngine';

export interface LedgerGenerationParams {
  pair: [ContractSymbol, ContractSymbol];
  obsA?: NormalizedObservation;
  obsB?: NormalizedObservation;
  provenance: DataProvenance;
  friction: FrictionAssumptions;
  historicalMean?: number;
  historicalStdDev?: number;
  zScore?: number;
  manualEdgeOverride?: number;
  dataSufficiency?: DataSufficiencyAssessment;
  isCalculable?: boolean;
  incalculableReason?: string;
}

/**
 * AUREX Signature Feature — Edge Survival Ledger Engine
 * 
 * Generates an end-to-end 8-stage auditable ledger decomposition of any
 * candidate cross-contract relative-value observation.
 */
export function buildEdgeSurvivalLedger(params: LedgerGenerationParams): EdgeSurvivalLedgerData {
  const {
    pair,
    obsA,
    obsB,
    provenance,
    friction,
    historicalMean = 0,
    historicalStdDev = 0,
    zScore = 0,
    manualEdgeOverride,
    dataSufficiency,
    isCalculable = true,
    incalculableReason
  } = params;

  const symbolA = pair[0];
  const symbolB = pair[1];
  const specA = CONTRACT_SPECIFICATIONS[symbolA];
  const specB = CONTRACT_SPECIFICATIONS[symbolB];

  const tradeDate = obsA?.date || obsB?.date || 'N/A';
  const rawCloseA = obsA?.close || 0;
  const rawCloseB = obsB?.close || 0;

  // Comparability & Normalization
  const compReport = evaluateContractComparability(obsA, obsB, pair);
  const normA = obsA?.normalizedPrice || 0;
  const normB = obsB?.normalizedPrice || 0;
  const observedSpread = calculateSpread(normA, normB);

  // Evaluate Decision Engine with strictly aligned inputs & data sufficiency
  const decisionResult = evaluateDecision({
    pair,
    observedSpread,
    manualExpectedEdge: manualEdgeOverride,
    volA: obsA?.volume || 0,
    oiA: obsA?.openInterest || 0,
    volB: obsB?.volume || 0,
    oiB: obsB?.openInterest || 0,
    friction,
    dataSufficiency,
    isCalculable,
    incalculableReason
  });

  const stages: LedgerStageData[] = [];

  // STAGE 1: SOURCE EVIDENCE
  stages.push({
    stageNumber: 1,
    stageName: 'SOURCE EVIDENCE',
    headline: `Provenance: ${provenance} | Trade Date: ${tradeDate}`,
    status: provenance === 'PROTOTYPE SIMULATION' ? 'INFO' : 'PASS',
    metrics: [
      { label: 'Dataset Provenance', value: provenance },
      { label: 'Trade Date', value: tradeDate },
      { label: `${symbolA} Raw Close`, value: `₹${rawCloseA.toLocaleString('en-IN')}`, note: `Expiry: ${obsA?.expiryDate || 'N/A'}` },
      { label: `${symbolB} Raw Close`, value: `₹${rawCloseB.toLocaleString('en-IN')}`, note: `Expiry: ${obsB?.expiryDate || 'N/A'}` }
    ],
    explanation: `Raw end-of-day settlement records ingested directly from ${provenance}. Verified that both contracts traded contemporaneously on ${tradeDate}.`,
    auditTrail: [
      `Source Record A: ${symbolA} on ${obsA?.date || 'N/A'}, Expiry: ${obsA?.expiryDate || 'N/A'}, Close: ₹${rawCloseA}`,
      `Source Record B: ${symbolB} on ${obsB?.date || 'N/A'}, Expiry: ${obsB?.expiryDate || 'N/A'}, Close: ₹${rawCloseB}`,
      `Data Classification: ${provenance}`
    ]
  });

  // STAGE 2: ECONOMIC NORMALIZATION
  const unitMultA = Number((10 / specA.quoteUnitGrams).toFixed(4));
  const purityMultA = Number((999 / specA.purityPermille).toFixed(4));
  const unitMultB = Number((10 / specB.quoteUnitGrams).toFixed(4));
  const purityMultB = Number((999 / specB.purityPermille).toFixed(4));

  stages.push({
    stageNumber: 2,
    stageName: 'ECONOMIC NORMALIZATION',
    headline: 'Unified Benchmark Basis: ₹ / 10g @ 999 Purity',
    status: 'PASS',
    metrics: [
      { label: `${symbolA} Multipliers`, value: `Unit: ×${unitMultA} | Purity: ×${purityMultA}` },
      { label: `${symbolA} Normalized`, value: `₹${normA.toLocaleString('en-IN')}/10g` },
      { label: `${symbolB} Multipliers`, value: `Unit: ×${unitMultB} | Purity: ×${purityMultB}` },
      { label: `${symbolB} Normalized`, value: `₹${normB.toLocaleString('en-IN')}/10g` }
    ],
    explanation: `Normalized using official formula: Price_norm = Raw Price × (10 / Quote Unit) × (999 / Purity). Quotes are now economically comparable.`,
    auditTrail: [
      `${symbolA}: ₹${rawCloseA} × (10 / ${specA.quoteUnitGrams}g) × (999 / ${specA.purityPermille}) = ₹${normA}`,
      `${symbolB}: ₹${rawCloseB} × (10 / ${specB.quoteUnitGrams}g) × (999 / ${specB.purityPermille}) = ₹${normB}`,
      `Economic scale parity achieved.`
    ]
  });

  // STAGE 3: RELATIVE-VALUE MEASUREMENT
  const zScoreDisplay = isCalculable ? `${zScore > 0 ? '+' : ''}${zScore.toFixed(2)}σ` : `N/A (${incalculableReason || 'Insufficient History'})`;
  stages.push({
    stageNumber: 3,
    stageName: 'RELATIVE-VALUE MEASUREMENT',
    headline: `Spread S_t = ₹${observedSpread.toFixed(2)}/10g | Z-Score: ${zScoreDisplay}`,
    status: isCalculable && Math.abs(observedSpread) > 100 ? 'PASS' : !isCalculable ? 'WARN' : 'INFO',
    metrics: [
      { label: 'Current Spread (S_t)', value: `₹${observedSpread.toFixed(2)}/10g`, note: `${symbolA} − ${symbolB}` },
      { label: 'Historical Mean Spread', value: isCalculable ? `₹${historicalMean.toFixed(2)}/10g` : 'N/A' },
      { label: 'Spread Volatility (σ)', value: isCalculable ? `₹${historicalStdDev.toFixed(2)}/10g` : 'N/A' },
      { label: 'Statistical Z-Score', value: zScoreDisplay }
    ],
    explanation: isCalculable
      ? `Spread measures price dislocation per 10 grams fine gold. Statistical z-score measures how far the spread has deviated from its single-provenance baseline.`
      : `Spread is measurable for settlement date ${tradeDate}. However, time-series statistical dispersion (Z-Score) requires multi-session single-provenance history (${incalculableReason || 'insufficient data'}). Prototype observations cannot be used to calibrate imported records.`,
    auditTrail: [
      `Spread Formula: S_t = Norm(${symbolA}) − Norm(${symbolB}) = ${normA} − ${normB} = ${observedSpread}`,
      isCalculable
        ? `Rolling Mean: ₹${historicalMean.toFixed(2)} | Rolling StdDev: ₹${historicalStdDev.toFixed(2)}`
        : `Baseline Statistics: Incalculable (${incalculableReason || 'insufficient history'})`,
      isCalculable
        ? `Statistical Z-Score: (${observedSpread} − ${historicalMean}) / ${historicalStdDev || 1} = ${zScore}`
        : `Provenance Isolation: Statistical window quarantined from disparate datasets.`
    ]
  });

  // STAGE 4: EXPIRY AND DATA CHECK
  const expiryDiff = compReport.expiryDifferenceDays;
  const isDiffMaturity = compReport.classification === 'COMPARABLE WITH MATURITY DIFFERENCE';
  stages.push({
    stageNumber: 4,
    stageName: 'EXPIRY AND DATA CHECK',
    headline: `Classification: ${compReport.classification}`,
    status: compReport.classification === 'COMPARABLE' ? 'PASS' : isDiffMaturity ? 'WARN' : 'FAIL',
    metrics: [
      { label: `${symbolA} Expiry`, value: `${obsA?.expiryDate || 'N/A'} (${compReport.daysToExpiryA}d left)` },
      { label: `${symbolB} Expiry`, value: `${obsB?.expiryDate || 'N/A'} (${compReport.daysToExpiryB}d left)` },
      { label: 'Maturity Difference', value: `${expiryDiff} calendar days` },
      { label: 'Alignment Check', value: compReport.dataDateAlignment ? 'PASS (Synchronous)' : 'FAIL (Misaligned)' }
    ],
    explanation: compReport.termStructureNote,
    auditTrail: compReport.warnings.length > 0 
      ? compReport.warnings 
      : ['Both contract legs share compatible near-month maturity schedules.']
  });

  // STAGE 5: LIQUIDITY CHECK
  const volA = obsA?.volume || 0;
  const oiA = obsA?.openInterest || 0;
  const volB = obsB?.volume || 0;
  const oiB = obsB?.openInterest || 0;
  const thinnerLeg = volA < volB ? symbolA : symbolB;
  const thinnerVol = Math.min(volA, volB);
  const thinnerOI = Math.min(oiA, oiB);

  stages.push({
    stageNumber: 5,
    stageName: 'LIQUIDITY CHECK',
    headline: `Composite Score: ${decisionResult.liquidityScore}/100 | Grade: ${decisionResult.liquidityGrade}`,
    status: decisionResult.liquidityGrade === 'PASS' ? 'PASS' : decisionResult.liquidityGrade === 'BORDERLINE' ? 'WARN' : 'FAIL',
    metrics: [
      { label: `${symbolA} Vol / OI`, value: `${volA.toLocaleString('en-IN')} lots / ${oiA.toLocaleString('en-IN')} OI` },
      { label: `${symbolB} Vol / OI`, value: `${volB.toLocaleString('en-IN')} lots / ${oiB.toLocaleString('en-IN')} OI` },
      { label: 'Execution Bottleneck', value: `${thinnerLeg} (${thinnerVol.toLocaleString('en-IN')} lots, ${thinnerOI.toLocaleString('en-IN')} OI)`, note: 'Thinner leg limits capacity' },
      { label: 'Liquidity Grade', value: decisionResult.liquidityGrade }
    ],
    explanation: `Cross-contract pairs require simultaneous two-legged execution. Execution capacity is strictly constrained by the thinner leg (${thinnerLeg}). (Daily exchange figures serve as liquidity proxies; order-book microstructure is estimated).`,
    auditTrail: [
      `Min Traded Volume: ${thinnerVol} lots | Min Open Interest: ${thinnerOI} contracts`,
      `Score Calculation: min(50, Vol/2000*50) + min(50, OI/3000*50) = ${decisionResult.liquidityScore}/100`,
      `Threshold Benchmark: ${friction.liquidityThresholdScore}`
    ]
  });

  // STAGE 6: EXECUTION FRICTION
  const totalFriction = calculateTotalFriction(friction);
  stages.push({
    stageNumber: 6,
    stageName: 'EXECUTION FRICTION',
    headline: `Total Friction Hurdle: ₹${totalFriction.toFixed(2)}/10g`,
    status: 'INFO',
    metrics: [
      { label: 'Bid-Ask Slippage', value: `₹${friction.slippagePer10g.toFixed(2)}/10g`, note: 'Two-leg crossing penalty' },
      { label: 'Brokerage & Taxes', value: `₹${friction.brokerageTaxesPer10g.toFixed(2)}/10g`, note: 'STT + GST + MCX Turnover' },
      { label: 'Liquidity Haircut', value: `₹${friction.liquidityHaircutPer10g.toFixed(2)}/10g`, note: 'Market impact proxy' },
      { label: 'Safety Buffer', value: `₹${friction.costBufferPer10g.toFixed(2)}/10g`, note: 'Execution risk margin' }
    ],
    explanation: `Deducts realistic exchange friction. Theoretical profits do not exist if transaction costs, statutory dues, and crossing costs exceed the spread.`,
    auditTrail: [
      `Slippage Allowance: ₹${friction.slippagePer10g}`,
      `Brokerage, Exchange Fee & GST: ₹${friction.brokerageTaxesPer10g}`,
      `Market Impact Haircut: ₹${friction.liquidityHaircutPer10g}`,
      `Execution Buffer: ₹${friction.costBufferPer10g}`,
      `Aggregated Hurdle = ₹${totalFriction.toFixed(2)}/10g`
    ]
  });

  // STAGE 7: NET EDGE
  const grossEdge = decisionResult.expectedEdge;
  const netEdge = decisionResult.netEdge;
  const edgeSurvives = netEdge > 0;

  stages.push({
    stageNumber: 7,
    stageName: 'NET EDGE',
    headline: `Gross: ₹${grossEdge.toFixed(2)} − Friction: ₹${totalFriction.toFixed(2)} = Net: ₹${netEdge.toFixed(2)}/10g`,
    status: edgeSurvives ? 'PASS' : 'FAIL',
    metrics: [
      { label: 'Gross Theoretical Edge', value: `₹${grossEdge.toFixed(2)}/10g` },
      { label: 'Estimated Friction', value: `−₹${totalFriction.toFixed(2)}/10g` },
      { label: 'Net Defensible Edge', value: `${netEdge > 0 ? '+' : ''}₹${netEdge.toFixed(2)}/10g` },
      { label: 'Edge Status', value: edgeSurvives ? 'SURVIVED (Positive)' : 'DEFICIT (Consumed by Friction)' }
    ],
    explanation: edgeSurvives 
      ? `Theoretical edge survives all transaction hurdles by +₹${netEdge.toFixed(2)}/10g benchmark.`
      : `Theoretical edge is entirely eliminated by estimated friction with a net deficit of ₹${Math.abs(netEdge).toFixed(2)}/10g.`,
    auditTrail: [
      `Gross Edge: ₹${grossEdge.toFixed(2)}`,
      `Total Friction: ₹${totalFriction.toFixed(2)}`,
      `Net Defensible Edge: ₹${netEdge.toFixed(2)}/10g`
    ]
  });

  // STAGE 8: FINAL DECISION
  stages.push({
    stageNumber: 8,
    stageName: 'FINAL DECISION',
    headline: `System Verdict: ${decisionResult.decision}`,
    status: decisionResult.decision === 'ACTIONABLE' ? 'PASS' : decisionResult.decision === 'WATCH' ? 'WARN' : 'FAIL',
    metrics: [
      { label: 'Final Gate Verdict', value: decisionResult.decision },
      { label: 'Active Rules Triggered', value: `${decisionResult.triggerRules.length} rules` },
      { label: 'Recommendation', value: decisionResult.decision === 'ACTIONABLE' ? 'Execute pair spread' : decisionResult.decision === 'WATCH' ? 'Monitor liquidity & depth' : 'Preserve capital (NO TRADE)' }
    ],
    explanation: decisionResult.rationale,
    auditTrail: decisionResult.triggerRules
  });

  return {
    id: `ledger_${pair[0]}_${pair[1]}_${tradeDate}`,
    timestamp: new Date().toISOString(),
    pair,
    tradeDate,
    provenance,
    decision: decisionResult.decision,
    netEdge: decisionResult.netEdge,
    stages
  };
}
