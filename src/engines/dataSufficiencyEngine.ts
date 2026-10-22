import {
  ContractSymbol,
  NormalizedObservation,
  DataMode,
  DataSufficiencyAssessment
} from '../types/market';

export interface DataSufficiencyParams {
  observations: NormalizedObservation[];
  pair: [ContractSymbol, ContractSymbol];
  asOfDate: string;
  dataMode: DataMode;
}

/**
 * AUREX Centralized Data-Sufficiency Assessment Engine
 *
 * Provides a unified quantitative sufficiency evaluation used across:
 * - Relative Value
 * - Validation & Backtesting
 * - Decision Engine
 * - Edge Survival Ledger
 * - Overview KPI Dashboard
 *
 * Strictly prevents treating isolated single-date observations as
 * long-term multi-session validation evidence, and prevents cross-provenance
 * statistical leakage.
 */
export function assessDataSufficiency(params: DataSufficiencyParams): DataSufficiencyAssessment {
  const { observations, pair, asOfDate, dataMode } = params;
  const [symA, symB] = pair;

  // Filter observations strictly As-Of selected valuation date
  const asOfObs = observations.filter(o => o.date <= asOfDate);

  // Group by date and check contemporaneous pair observations
  const obsByDateA = new Map<string, NormalizedObservation[]>();
  const obsByDateB = new Map<string, NormalizedObservation[]>();

  let prototypeCount = 0;
  let importedCount = 0;
  let officialVerifiedCount = 0;

  for (const obs of asOfObs) {
    const prov = obs.provenance;
    if (prov === 'OFFICIAL MCX DATA — SOURCE VERIFIED') {
      officialVerifiedCount++;
    } else if (
      prov === 'USER-IMPORTED DATA — SOURCE UNVERIFIED' ||
      prov === 'USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED' ||
      prov === 'PROTOTYPE SAMPLE — UNVERIFIED SOURCING'
    ) {
      importedCount++;
    } else {
      prototypeCount++;
    }

    if (obs.symbol === symA) {
      const list = obsByDateA.get(obs.date) || [];
      list.push(obs);
      obsByDateA.set(obs.date, list);
    }
    if (obs.symbol === symB) {
      const list = obsByDateB.get(obs.date) || [];
      list.push(obs);
      obsByDateB.set(obs.date, list);
    }
  }

  const allDates = Array.from(new Set(asOfObs.map(o => o.date))).sort();
  const contemporaneousPairDates = allDates.filter(
    d => obsByDateA.has(d) && obsByDateB.has(d)
  );

  const totalEligibleObservations = asOfObs.length;
  const distinctTradingDates = allDates.length;
  const earliestEligibleDate = allDates[0] || 'N/A';
  const latestEligibleDate = allDates[allDates.length - 1] || 'N/A';
  const isPairMatched = contemporaneousPairDates.length > 0;

  // Quantitative capability thresholds
  const canMeasureSingleDateSpread = contemporaneousPairDates.length >= 1;
  const canComputeZScore = contemporaneousPairDates.length >= 5;
  const canComputeRollingDistribution = contemporaneousPairDates.length >= 5;
  const canRunWalkForwardBacktest = contemporaneousPairDates.length >= 15;
  const canFormActionableVerdict = contemporaneousPairDates.length >= 15;

  const reasons: string[] = [];

  // Determine Backtest Readiness
  let backtestReadiness: DataSufficiencyAssessment['backtestReadiness'] = 'INSUFFICIENT_HISTORICAL_DATA';
  if (contemporaneousPairDates.length >= 60) {
    backtestReadiness = 'READY';
  } else if (contemporaneousPairDates.length >= 15) {
    backtestReadiness = 'PRELIMINARY_SAMPLE';
    reasons.push(
      `Preliminary historical sample: ${contemporaneousPairDates.length} contemporaneous sessions available. Meets minimum 15-session walk-forward threshold, but statistical power is limited (target >= 60 sessions).`
    );
  } else {
    backtestReadiness = 'INSUFFICIENT_HISTORICAL_DATA';
    reasons.push(
      `Insufficient historical depth for backtesting: Pair ${symA}/${symB} has ${contemporaneousPairDates.length} contemporaneous session(s) as-of ${asOfDate}. Walk-forward out-of-sample validation requires >= 15 sequential sessions (target >= 60 sessions).`
    );
  }

  // Determine Overall Statistical Sufficiency
  let sufficiencyStatus: DataSufficiencyAssessment['sufficiencyStatus'] = 'INSUFFICIENT';
  if (contemporaneousPairDates.length >= 20) {
    sufficiencyStatus = 'SUFFICIENT';
  } else if (contemporaneousPairDates.length >= 5) {
    sufficiencyStatus = 'PRELIMINARY';
    reasons.push(
      `Preliminary historical sample: ${contemporaneousPairDates.length} sessions available. Z-score and rolling spread dispersion can be calculated, but out-of-sample walk-forward validation requires >= 15 sessions (target >= 20 sessions).`
    );
  } else if (contemporaneousPairDates.length >= 1) {
    sufficiencyStatus = 'INSUFFICIENT';
    reasons.push(
      `Insufficient time-series history: ${contemporaneousPairDates.length} session${contemporaneousPairDates.length === 1 ? '' : 's'} available as of ${asOfDate}. Minimum 5 contemporaneous single-provenance sessions required for rolling baseline distribution and Z-score calibration.`
    );
  } else {
    sufficiencyStatus = 'INSUFFICIENT';
    reasons.push(
      `Zero contemporaneous trading sessions found for pair ${symA}/${symB} up to valuation date ${asOfDate}.`
    );
  }

  // Data Mode specific clarifications
  if (dataMode === 'IMPORTED_ONLY') {
    if (distinctTradingDates === 1) {
      reasons.push(
        `Active Mode is IMPORTED_ONLY with 1 authentic trading date (${latestEligibleDate}). Single-date pricing is valid; time-series backtesting requires uploading additional MCX Bhavcopy dates in Data Lab.`
      );
    }
  } else if (dataMode === 'ALL') {
    if (prototypeCount > 0 && importedCount > 0) {
      reasons.push(
        `Active Mode is ALL (Hybrid). Prototype simulation and user-imported observations are kept strictly isolated. Statistical windows cannot cross the dataset boundary.`
      );
    }
  }

  const explanation = reasons.length > 0
    ? reasons.join(' ')
    : `Sufficient historical data: ${contemporaneousPairDates.length} contemporaneous sessions available for pair ${symA}/${symB}.`;

  return {
    dataMode,
    asOfDate,
    totalEligibleObservations,
    distinctTradingDates,
    contemporaneousPairDates: contemporaneousPairDates.length,
    earliestEligibleDate,
    latestEligibleDate,
    isPairMatched,
    canMeasureSingleDateSpread,
    canComputeRollingDistribution,
    canComputeZScore,
    canRunWalkForwardBacktest,
    canFormActionableVerdict,
    sufficiencyStatus,
    backtestReadiness,
    explanation,
    reasons,
    provenanceBreakdown: {
      prototypeCount,
      importedCount,
      officialVerifiedCount
    }
  };
}
