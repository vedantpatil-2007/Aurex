export type ContractSymbol = 'GOLDM' | 'GOLDTEN' | 'GOLDGUINEA' | 'GOLDPETAL';

export interface ContractSpecification {
  symbol: ContractSymbol;
  name: string;
  contractSizeGrams: number; // in grams
  quoteUnitGrams: number;     // in grams
  purityPermille: number;     // 995 or 999
  expiryScheduleDesc: string; // e.g. "3rd–5th of month" or "27th–31st of month"
  tickSize: number;           // ₹
  tradingLotDescription: string;
  deliveryUnit: string;
}

export interface MarketObservation {
  date: string;              // YYYY-MM-DD
  symbol: ContractSymbol;
  expiryDate: string;        // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openInterest: number;
}

export type ContractLifecycleStage = 'NORMAL' | 'NEAR_EXPIRY' | 'ROLL_WINDOW';

export interface NormalizedObservation extends MarketObservation {
  normalizedPrice: number;   // Price normalized to ₹ / 10g @ 999 purity
  unitAdjustment: number;    // (10 / quoteUnitGrams)
  purityAdjustment: number;  // (999 / purityPermille)
  daysToExpiry: number;
  lifecycleStage: ContractLifecycleStage;
}

export interface NormalizationBreakdown {
  rawPrice: number;
  quoteUnit: number;
  purity: number;
  unitMultiplier: number;
  purityMultiplier: number;
  scalingFactor: number;
  normalizedPrice: number;
  benchmarkUnit: string;
}

export interface RelativeValueSpreadPoint {
  date: string;
  symbolA: ContractSymbol;
  symbolB: ContractSymbol;
  priceA: number;
  priceB: number;
  spread: number;            // priceA - priceB (in ₹ / 10g)
  spreadPercentage: number;
  zScore?: number;
  meanSpread?: number;
  stdDevSpread?: number;
}

export interface ZScoreAnalysis {
  currentZScore: number;
  mean: number;
  standardDeviation: number;
  minSpread: number;
  maxSpread: number;
  series: RelativeValueSpreadPoint[];
}

export type LiquidityGrade = 'PASS' | 'BORDERLINE' | 'FAIL';
export type DecisionState = 'ACTIONABLE' | 'WATCH' | 'NO TRADE';

export interface FrictionAssumptions {
  slippagePer10g: number;          // in ₹
  brokerageTaxesPer10g: number;    // in ₹ (exchange turnover fee, STT, GST, SEBI fee, brokerage)
  liquidityHaircutPer10g: number;  // in ₹ (market impact penalty for thinner legs)
  costBufferPer10g: number;        // in ₹ (execution margin of safety)
  liquidityThresholdScore: number; // 0 to 100
}

export interface CostWaterfallBreakdown {
  theoreticalEdge: number;
  slippage: number;
  brokerageTaxes: number;
  liquidityHaircut: number;
  safetyBuffer: number;
  totalFriction: number;
  netDefensibleEdge: number;
}

export interface DecisionResult {
  pair: [ContractSymbol, ContractSymbol];
  observedSpread: number;    // ₹ / 10g
  expectedEdge: number;      // abs(spread) or targeted convergence edge
  totalFriction: number;     // slippage + brokerage + haircut + buffer
  netEdge: number;           // expectedEdge - totalFriction
  liquidityScore: number;    // 0 - 100
  liquidityGrade: LiquidityGrade;
  decision: DecisionState;
  rationale: string;
  triggerRules: string[];
  waterfall: CostWaterfallBreakdown;
}

export interface ValidationWindowResult {
  windowId: number;
  windowLabel: string;
  trainStartDate: string;
  trainEndDate: string;
  testStartDate: string;
  testEndDate: string;
  trainObservationsCount: number;
  testObservationsCount: number;
  inSampleMeanSpread: number;
  outOfSampleObservedEdge: number;
  estimatedFriction: number;
  netEdge: number;
  decisionTaken: DecisionState;
  status: 'STABLE' | 'MARGINAL' | 'REJECTED';
}

export interface DataQualityReport {
  status: 'PASS' | 'WARN';
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  checks: {
    name: string;
    passed: boolean;
    details: string;
  }[];
}

export type DataProvenance = 'OFFICIAL MCX DATA' | 'USER-IMPORTED MCX DATA' | 'PROTOTYPE SIMULATION';

export interface ContractCoverageItem {
  count: number;
  earliestDate: string;
  latestDate: string;
  expiries: string[];
}

export interface DatasetMetadata {
  provenance: DataProvenance;
  filename?: string;
  importTimestamp?: string;
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  duplicateCount: number;
  missingFieldCount: number;
  dateRange: { start: string; end: string };
  contractCoverage: Record<ContractSymbol, ContractCoverageItem>;
  knownLimitations: string[];
  sourceClassification: string;
}

export interface RejectedRow {
  rowNumber: number;
  raw: Record<string, string>;
  reason: string;
}

export interface DataHealthSummary {
  source: string;
  provenance: DataProvenance;
  totalRecords: number;
  validRecords: number;
  rejectedRecords: number;
  contractsCount: number;
  lastAvailableDate: string;
  qualityStatus: 'PASS' | 'WARN';
  contractCoverage: string;
  importTimestamp?: string;
  filename?: string;
}

export type ComparabilityClassification = 
  | 'COMPARABLE' 
  | 'COMPARABLE WITH MATURITY DIFFERENCE' 
  | 'INSUFFICIENT DATA';

export interface PairComparabilityReport {
  pair: [ContractSymbol, ContractSymbol];
  date: string;
  symbolA: ContractSymbol;
  symbolB: ContractSymbol;
  expiryA: string;
  expiryB: string;
  daysToExpiryA: number;
  daysToExpiryB: number;
  expiryDifferenceDays: number;
  dataDateAlignment: boolean;
  normalizedPriceA: number;
  normalizedPriceB: number;
  spread: number;
  volA: number;
  oiA: number;
  volB: number;
  oiB: number;
  classification: ComparabilityClassification;
  warnings: string[];
  termStructureNote: string;
}

export interface LedgerStageData {
  stageNumber: number;
  stageName: string;
  headline: string;
  status: 'PASS' | 'WARN' | 'FAIL' | 'INFO';
  metrics: { label: string; value: string | number; note?: string }[];
  explanation: string;
  auditTrail: string[];
}

export interface EdgeSurvivalLedgerData {
  id: string;
  timestamp: string;
  pair: [ContractSymbol, ContractSymbol];
  tradeDate: string;
  provenance: DataProvenance;
  decision: DecisionState;
  netEdge: number;
  stages: LedgerStageData[];
}

export interface SensitivityScenario {
  id: string;
  name: 'LOWER FRICTION' | 'BASE CASE' | 'HIGHER FRICTION';
  description: string;
  assumptions: FrictionAssumptions;
  decisionResult: DecisionResult;
  survivesEdge: boolean;
}

export interface JudgeWalkthroughStep {
  stepNumber: number;
  title: string;
  targetPage: 'overview' | 'data-lab' | 'contracts' | 'normalization' | 'relative-value' | 'ledger' | 'validation' | 'decision';
  instruction: string;
  detail: string;
  focusContract?: ContractSymbol;
  focusPair?: [ContractSymbol, ContractSymbol];
}

