export type ContractSymbol = 'GOLDM' | 'GOLDTEN' | 'GOLDGUINEA' | 'GOLDPETAL';
export type DataMode = 'ALL' | 'PROTOTYPE_ONLY' | 'IMPORTED_ONLY';

export interface DataSufficiencyAssessment {
  dataMode: DataMode;
  asOfDate: string;
  totalEligibleObservations: number;
  distinctTradingDates: number;
  contemporaneousPairDates: number;
  earliestEligibleDate: string;
  latestEligibleDate: string;
  isPairMatched: boolean;
  canMeasureSingleDateSpread: boolean;
  canComputeRollingDistribution: boolean;
  canComputeZScore: boolean;
  canRunWalkForwardBacktest: boolean;
  canFormActionableVerdict: boolean;
  sufficiencyStatus: 'SUFFICIENT' | 'PRELIMINARY' | 'INSUFFICIENT';
  backtestReadiness: 'READY' | 'PRELIMINARY_SAMPLE' | 'INSUFFICIENT_HISTORICAL_DATA';
  explanation: string;
  reasons: string[];
  provenanceBreakdown: {
    prototypeCount: number;
    importedCount: number;
    officialVerifiedCount: number;
  };
}

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
  listingEffectiveDate?: string; // e.g. "2025-04-01" for GOLDTEN
  tenderPeriodDays?: number;     // 5 days
  deliveryMechanism?: string;    // "Compulsory Delivery"
  officialCircular?: string;
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
  provenance?: DataProvenance;
  sourceFile?: string;
  sourceSha256?: string;
}

export type ContractLifecycleStage = 'NORMAL' | 'NEAR_EXPIRY' | 'ROLL_WINDOW';

export interface NormalizedObservation extends MarketObservation {
  normalizedPrice: number;   // Price normalized to ₹ / 10g @ 999 purity
  unitAdjustment: number;    // (10 / quoteUnitGrams)
  purityAdjustment: number;  // (999 / purityPermille)
  daysToExpiry: number;      // Calendar days to expiry
  tradingDaysToExpiry?: number; // Trading days to expiry (excluding weekends & MCX holidays)
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
  provenanceA?: DataProvenance;
  provenanceB?: DataProvenance;
  isCrossProvenanceBoundary?: boolean;
}

export interface ZScoreAnalysis {
  currentZScore: number;
  mean: number;
  standardDeviation: number;
  minSpread: number;
  maxSpread: number;
  series: RelativeValueSpreadPoint[];
  isCalculable?: boolean;
  incalculableReason?: string;
  rollingWindowDays?: number;
  isCrossProvenanceContaminated?: boolean;
  calibrationObservationCount?: number;
  calibrationProvenance?: DataProvenance;
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
  dataSufficiency?: DataSufficiencyAssessment;
  isDefensible?: boolean;
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

export type DataProvenance =
  | 'PROTOTYPE SIMULATION'
  | 'PROTOTYPE SAMPLE — UNVERIFIED SOURCING'
  | 'USER-IMPORTED DATA — SOURCE UNVERIFIED'
  | 'USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED'
  | 'OFFICIAL MCX DATA — SOURCE VERIFIED'
  | 'HYBRID / MIXED PROVENANCE';

export interface ContractCoverageItem {
  count: number;
  earliestDate: string;
  latestDate: string;
  expiries: string[];
}

export interface ImportedSourceFileMetadata {
  filename: string;
  fileHashSha256: string;
  dateRange: { start: string; end: string };
  validRows: number;
  importTimestamp: string;
}

export interface MergeConflictDetail {
  symbol: ContractSymbol;
  date: string;
  expiryDate: string;
  existingClose: number;
  incomingClose: number;
  difference: string;
}

export interface MergeAnalysis {
  sourceFilename: string;
  detectedTradingDates: string[];
  validFuturesInSource: number;
  newlyInsertedCount: number;
  unchangedDuplicatesCount: number;
  conflictingCount: number;
  conflictingObservations: MergeConflictDetail[];
  unsupportedInstrumentCount: number;
  otherRejectedCount: number;
  projectedTotalRecords: number;
  projectedDateRange: { start: string; end: string };
  isAccumulating: boolean;
}

export interface ProvenanceBreakdown {
  prototypeSimulationCount: number;
  userImportedCount: number;
  officialVerifiedCount: number;
}

export interface DatasetMetadata {
  provenance: DataProvenance;
  provenanceBreakdown?: ProvenanceBreakdown;
  filename?: string;
  fileHashSha256?: string;
  sourceUrl?: string;
  storagePersistence?: 'LOCAL_STORAGE' | 'SESSION_MEMORY' | 'BUNDLED_CODE';
  importTimestamp?: string;
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  duplicateCount: number;
  missingFieldCount: number;
  dateRange: { start: string; end: string };
  contractCoverage: Record<ContractSymbol, ContractCoverageItem>;
  sourceFiles?: ImportedSourceFileMetadata[];
  knownLimitations: string[];
  sourceClassification: string;
  isUserAttested?: boolean;
  attestationNotes?: string;
  attestationTimestamp?: string;
  isVerified?: boolean;
  verificationNotes?: string;
}

export interface RejectedRow {
  rowNumber: number;
  raw: Record<string, string>;
  reason: string;
}

export interface DataHealthSummary {
  source: string;
  provenance: DataProvenance;
  provenanceBreakdown?: ProvenanceBreakdown;
  totalRecords: number;
  validRecords: number;
  rejectedRecords: number;
  contractsCount: number;
  lastAvailableDate: string;
  qualityStatus: 'PASS' | 'WARN';
  contractCoverage: string;
  importTimestamp?: string;
  filename?: string;
  fileHashSha256?: string;
  storagePersistence?: string;
  isUserAttested?: boolean;
  attestationNotes?: string;
  attestationTimestamp?: string;
  isVerified?: boolean;
  verificationNotes?: string;
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

/* ========================================================================
 * WORKSTREAM 2: Term Structure, Futures Curve & Carry Analytics Types
 * ======================================================================== */

export interface TermStructurePoint {
  symbol: ContractSymbol;
  expiryDate: string;
  daysToExpiry: number;
  rawPrice: number;
  normalizedPrice: number;
  volume: number;
  openInterest: number;
  adjacentSpread?: number;       // ₹ / 10g vs previous (nearer) expiry
  adjacentSpreadPct?: number;    // % vs previous expiry
}

export interface FuturesCurve {
  date: string;
  symbol: ContractSymbol;
  points: TermStructurePoint[];
  nearPoint?: TermStructurePoint;
  farPoint?: TermStructurePoint;
  spreadNearFar?: number;
  spreadNearFarPct?: number;
  daysBetweenExpiries?: number;
  annualizedSimpleCarry?: number;
  annualizedContinuousCarry?: number;
  annualizedCompoundedCarry?: number; // Kept as alias for annualizedContinuousCarry
  annualizedGeometricCarry?: number;  // 100 * ((Far/Near)^(365/ΔD) - 1)
  carryCalculationStatus?: 'VALID' | 'EQUAL_EXPIRIES' | 'INSUFFICIENT_EXPIRIES' | 'INVALID_PRICES';
}

export interface ConstantMaturityReference {
  tenorDays: number;
  interpolatedPrice: number;
  isExtrapolated: boolean;
  status: 'VALID' | 'OUT_OF_RANGE' | 'INSUFFICIENT_EXPIRIES';
}

export interface RollDownDecomposition {
  symbol: ContractSymbol;
  tenorDays: number;
  dateCurrent: string;
  datePrevious: string;
  priceCurrent: number;
  pricePrevious: number;
  totalChange: number;
  mechanicalRollDown: number;
  curveShift: number;
  explanation: string;
}

/* ========================================================================
 * WORKSTREAM 3 & 4: Walk-Forward Backtesting, Accounting & Attribution Types
 * ======================================================================== */

export type PositionDirection = 'LONG_SPREAD' | 'SHORT_SPREAD';
export type TradeExitReason =
  | 'TARGET_CONVERGENCE'
  | 'STOP_LOSS'
  | 'MAX_HOLDING_PERIOD'
  | 'TENDER_WINDOW_FORCED_EXIT'
  | 'END_OF_SIMULATION';

export interface TradeAttribution {
  goldMarketBetaPnL: number;     // Movement attributable to overall gold market trend
  relativeValueAlphaPnL: number; // Movement attributable to spread convergence
  executionFriction: number;     // Entry + exit friction costs
  residualPnL: number;           // Basis drift / residual imbalance
}

export interface BacktestTrade {
  tradeId: string;
  pair: [ContractSymbol, ContractSymbol];
  direction: PositionDirection;
  entryDate: string;
  exitDate?: string;
  entryPriceA: number;
  entryPriceB: number;
  exitPriceA?: number;
  exitPriceB?: number;
  entrySpread: number;
  exitSpread?: number;
  lotQuantityA: number;
  lotQuantityB: number;
  normalizedGrams: number;
  legAPnL?: number;
  legBPnL?: number;
  grossPnL: number;
  entryFriction: number;
  exitFriction: number;
  totalFriction: number;
  netPnL: number;
  status: 'OPEN' | 'CLOSED';
  exitReason?: TradeExitReason;
  holdingDays: number;
  attribution?: TradeAttribution;
}

export interface BacktestParameters {
  pair: [ContractSymbol, ContractSymbol];
  zScoreEntryThreshold: number;   // e.g. 1.5
  zScoreExitThreshold: number;    // e.g. 0.0 (mean reversion)
  zScoreStopLoss?: number;        // e.g. 3.0
  maxHoldingDays: number;         // e.g. 15
  friction: FrictionAssumptions;
  warmUpDays: number;             // e.g. 20
  capitalAllocationINR: number;   // e.g. 1,000,000
}

export interface BacktestEquityPoint {
  date: string;
  equity: number;
  drawdown: number;
  pnl: number;
  activePositions: number;
}

export interface BacktestPerformanceSummary {
  pair: [ContractSymbol, ContractSymbol];
  totalCandidateSignals: number;
  acceptedTrades: number;
  rejectedSignals: number;
  rejectionBreakdown: Record<string, number>;
  completedTrades: number;
  openTrades: number;
  winCount: number;
  lossCount: number;
  winRatePct: number;
  grossPnL: number;
  totalFrictionCosts: number;
  netPnL: number;
  profitFactor: number;
  maxDrawdownINR: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  avgTradeDurationDays: number;
  avgTradePnL: number;
  dailyEquityCurve: BacktestEquityPoint[];
  trades: BacktestTrade[];
  attributionSummary: {
    totalGoldBetaPnL: number;
    totalRelativeValueAlphaPnL: number;
    totalFrictionCost: number;
    totalResidualPnL: number;
  };
  dataSufficiencyWarning?: string;
  totalAvailableDates?: number;
  evaluatedDates?: number;
  warmUpDates?: number;
  executionAssumption?: string;
}

/* ========================================================================
 * WORKSTREAM 5: Contract Lifecycle Intelligence Types
 * ======================================================================== */

export interface ContractDeliveryRules {
  symbol: ContractSymbol;
  deliveryType: 'COMPULSORY_DELIVERY';
  tenderPeriodDays: number;        // 5 trading days prior to expiry
  deliveryUnit: string;
  deliveryCenter: string;
  listingEffectiveDate: string;    // e.g. "2025-04-01" for GOLDTEN
  officialCircularReference: string;
}

export interface LifecycleEligibilityCheck {
  symbol: ContractSymbol;
  date: string;
  expiryDate: string;
  daysToExpiry: number;            // Calendar days to expiry
  tradingDaysToExpiry?: number;    // Business/trading days excluding weekends & MCX holidays
  lifecycleStage: ContractLifecycleStage;
  isEligibleForNewEntry: boolean;
  mustForcedExit: boolean;
  warnings: string[];
  rejectionReason?: string;
}

/* ========================================================================
 * WORKSTREAM 6: Trader Intelligence, Signal Quality & Alert Types
 * ======================================================================== */

export type AlertSeverity = 'INFO' | 'WARNING' | 'ACTION_REQUIRED' | 'CRITICAL';
export type AlertCategory = 'SIGNAL' | 'LIFECYCLE' | 'DATA_HEALTH' | 'COST_HURDLE' | 'SYSTEM';

export interface PlatformAlert {
  id: string;
  timestamp: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  pair?: [ContractSymbol, ContractSymbol];
  symbol?: ContractSymbol;
  triggerRule?: string;
  sourceProvenance?: DataProvenance;
  isRead?: boolean;
}
