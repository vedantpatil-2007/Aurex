import {
  NormalizedObservation,
  BacktestParameters,
  BacktestPerformanceSummary,
  BacktestTrade,
  BacktestEquityPoint,
  PositionDirection,
  TradeExitReason,
  FrictionAssumptions
} from '../types/market';
import { CONTRACT_SPECIFICATIONS } from '../data/contracts';
import { calculateTotalFriction } from './liquidityCostEngine';
import { evaluatePairLifecycleEligibility } from './lifecycleEngine';
import { selectActiveObservation } from './relativeValueEngine';

/**
 * Complete Walk-Forward Chronological Backtesting Engine
 *
 * Strict Zero Look-Ahead Bias:
 * - Observations are processed strictly in chronological order.
 * - Rolling statistical parameters (μ, σ, Z-score) at step t are calibrated
 *   using ONLY data from the historical window [t - warmUpDays, t - 1].
 * - Future observations cannot leak into historical decisions.
 * - Realistic trade accounting: entry friction, exit friction, exposure matching,
 *   holding limits, and MCX tender window forced exit.
 */
export function runWalkForwardBacktest(
  observations: NormalizedObservation[],
  params: BacktestParameters
): BacktestPerformanceSummary {
  const {
    pair,
    zScoreEntryThreshold,
    zScoreExitThreshold,
    zScoreStopLoss = 3.0,
    maxHoldingDays = 15,
    friction,
    warmUpDays = 20,
    capitalAllocationINR = 1000000
  } = params;

  const [symA, symB] = pair;
  const specA = CONTRACT_SPECIFICATIONS[symA];
  const specB = CONTRACT_SPECIFICATIONS[symB];

  // Group observations by date and symbol to select active liquid contracts deterministically
  const obsAByDate = new Map<string, NormalizedObservation[]>();
  const obsBByDate = new Map<string, NormalizedObservation[]>();
  const obsByContractDate = new Map<string, NormalizedObservation>();

  for (const obs of observations) {
    obsByContractDate.set(`${obs.symbol}_${obs.date}_${obs.expiryDate}`, obs);
    if (obs.symbol === symA) {
      const list = obsAByDate.get(obs.date) || [];
      list.push(obs);
      obsAByDate.set(obs.date, list);
    } else if (obs.symbol === symB) {
      const list = obsBByDate.get(obs.date) || [];
      list.push(obs);
      obsBByDate.set(obs.date, list);
    }
  }

  const commonDates = Array.from(obsAByDate.keys())
    .filter(d => obsBByDate.has(d))
    .sort((a, b) => a.localeCompare(b));

  let dataSufficiencyWarning: string | undefined = undefined;
  if (commonDates.length < warmUpDays || commonDates.length < 15) {
    dataSufficiencyWarning = `INSUFFICIENT HISTORICAL DATA (Sample size limitation): Only ${commonDates.length} contemporaneous trading session(s) available for pair ${pair.join('/')}, whereas statistical walk-forward calibration requires >= ${Math.max(15, warmUpDays)} warm-up sessions. Zero trades could be calibrated on this limited sample; meaningful statistical validation requires continuous historical coverage (target >= 60 sessions). Single-session or isolated datasets cannot support historical walk-forward strategy validation.`;
  } else if (commonDates.length <= warmUpDays) {
    dataSufficiencyWarning = `Preliminary sample: Evaluated ${commonDates.length} trading sessions. All ${commonDates.length} sessions were utilized for in-sample warm-up calibration (0 out-of-sample evaluation sessions available). Strategy execution requires additional forward sessions beyond the ${warmUpDays}-session warm-up window.`;
  } else if (commonDates.length < 30) {
    dataSufficiencyWarning = `Preliminary sample: Evaluated ${commonDates.length} trading sessions (${commonDates.length - warmUpDays} out-of-sample). Statistical power is limited; results represent illustrative model calibration rather than proven alpha.`;
  }

  // Friction per 10g unit
  const defaultFriction: FrictionAssumptions = {
    slippagePer10g: 4.0,
    brokerageTaxesPer10g: 3.5,
    liquidityHaircutPer10g: 1.5,
    costBufferPer10g: 1.0,
    liquidityThresholdScore: 50
  };
  const activeFriction = friction ?? defaultFriction;
  const frictionPer10g = calculateTotalFriction(activeFriction);

  // Standardized exposure basis: 100g physical gold on each leg
  const normalizedGrams = 100;
  const unitsOf10g = normalizedGrams / 10; // 10 units of 10g

  // Determine integer lot quantities to match ~100g physical exposure
  const lotQuantityA = Math.max(1, Math.round(normalizedGrams / specA.contractSizeGrams));
  const lotQuantityB = Math.max(1, Math.round(normalizedGrams / specB.contractSizeGrams));

  const trades: BacktestTrade[] = [];
  let openTrade: BacktestTrade | null = null;
  let tradeCounter = 0;

  let totalCandidateSignals = 0;
  let rejectedSignals = 0;
  const rejectionBreakdown: Record<string, number> = {
    'INSUFFICIENT_NET_EDGE': 0,
    'TENDER_WINDOW_RESTRICTION': 0,
    'ALREADY_IN_POSITION': 0,
    'BEFORE_LISTING_DATE': 0
  };

  const dailyEquityCurve: BacktestEquityPoint[] = [];
  let currentEquity = capitalAllocationINR;
  let peakEquity = capitalAllocationINR;
  let maxDrawdownINR = 0;
  let maxDrawdownPct = 0;

  // Track historical daily returns for Sharpe ratio
  const dailyReturns: number[] = [];

  // Build daily spread series for chronological replay with provenance preservation
  const spreadSeries: {
    date: string;
    spread: number;
    priceA: number;
    priceB: number;
    expA: string;
    expB: string;
    provA: string;
    provB: string;
  }[] = [];

  for (const date of commonDates) {
    const listA = obsAByDate.get(date)!;
    const listB = obsBByDate.get(date)!;

    // Single-provenance matching consistent with relativeValueEngine:
    const aImported = listA.filter(o => o.provenance !== 'PROTOTYPE SIMULATION');
    const bImported = listB.filter(o => o.provenance !== 'PROTOTYPE SIMULATION');
    const useImported = aImported.length > 0 && bImported.length > 0;

    const a = selectActiveObservation(useImported ? aImported : listA);
    const b = selectActiveObservation(useImported ? bImported : listB);
    if (!a || !b) continue;

    const spread = Number((a.normalizedPrice - b.normalizedPrice).toFixed(2));
    spreadSeries.push({
      date,
      spread,
      priceA: a.normalizedPrice,
      priceB: b.normalizedPrice,
      expA: a.expiryDate,
      expB: b.expiryDate,
      provA: a.provenance || 'PROTOTYPE SIMULATION',
      provB: b.provenance || 'PROTOTYPE SIMULATION'
    });
  }

  // Track last known prices per exact contract expiry for rollover price protection
  const lastKnownPriceByContract = new Map<string, number>();

  // Iterate strictly forward through time
  for (let t = 0; t < spreadSeries.length; t++) {
    const current = spreadSeries[t];
    const prevEquity = currentEquity;

    // Update last known prices for observed contracts
    const curAObs = obsAByDate.get(current.date);
    if (curAObs) {
      for (const o of curAObs) lastKnownPriceByContract.set(`${symA}_${o.expiryDate}`, o.normalizedPrice);
    }
    const curBObs = obsBByDate.get(current.date);
    if (curBObs) {
      for (const o of curBObs) lastKnownPriceByContract.set(`${symB}_${o.expiryDate}`, o.normalizedPrice);
    }

    // 1. Manage existing open trade (marking to market and exit evaluation)
    if (openTrade) {
      openTrade.holdingDays++;

      const heldExpA: string = openTrade.expiryA || current.expA;
      const heldExpB: string = openTrade.expiryB || current.expB;

      // Check current spread and prices
      const currentSpread = current.spread;
      const _spreadDiff = openTrade.direction === 'LONG_SPREAD'
        ? currentSpread - openTrade.entrySpread
        : openTrade.entrySpread - currentSpread;

      // Evaluate exit triggers
      let shouldExit = false;
      let exitReason: TradeExitReason = 'TARGET_CONVERGENCE';

      // Cross-provenance boundary guard: force close if regime switches from prototype to imported
      const prevBar = spreadSeries[t - 1];
      if (prevBar && prevBar.provA !== current.provA) {
        shouldExit = true;
        exitReason = 'END_OF_SIMULATION';
      }

      // Check Lifecycle Eligibility (tender window forced exit on held contracts)
      if (!shouldExit) {
        const lifecycleCheck = evaluatePairLifecycleEligibility(pair, current.date, heldExpA, heldExpB);
        if (!lifecycleCheck.isEligible) {
          shouldExit = true;
          exitReason = 'TENDER_WINDOW_FORCED_EXIT';
        }
      }

      // Check Contract Rollover: If benchmark active contract rolled away from held contracts
      if (!shouldExit && (current.expA !== heldExpA || current.expB !== heldExpB)) {
        shouldExit = true;
        exitReason = 'CONTRACT_ROLLOVER';
      }

      // Check Max Holding Period
      if (!shouldExit && openTrade.holdingDays >= maxHoldingDays) {
        shouldExit = true;
        exitReason = 'MAX_HOLDING_PERIOD';
      }

      // Check statistical convergence or stop loss using historical trailing window up to t-1
      // Provenance Isolation: only consider prior bars with matching provenance
      if (!shouldExit) {
        const matchingPriorBars = spreadSeries
          .slice(0, t)
          .filter(p => p.provA === current.provA);

        if (matchingPriorBars.length >= warmUpDays) {
          const histWindow = matchingPriorBars.slice(-warmUpDays);
          const mean = histWindow.reduce((acc, p) => acc + p.spread, 0) / histWindow.length;
          const variance = histWindow.reduce((acc, p) => acc + Math.pow(p.spread - mean, 2), 0) / histWindow.length;
          const stdDev = Math.sqrt(variance) || 1.0;
          const currentZ = (currentSpread - mean) / stdDev;

          // Target convergence exit: Z-score reverts to threshold (e.g. 0.0)
          if (openTrade.direction === 'LONG_SPREAD' && currentZ >= zScoreExitThreshold) {
            shouldExit = true;
            exitReason = 'TARGET_CONVERGENCE';
          } else if (openTrade.direction === 'SHORT_SPREAD' && currentZ <= -zScoreExitThreshold) {
            shouldExit = true;
            exitReason = 'TARGET_CONVERGENCE';
          }

          // Stop loss: Z-score expands adversely beyond stop threshold
          if (openTrade.direction === 'LONG_SPREAD' && currentZ <= -zScoreStopLoss) {
            shouldExit = true;
            exitReason = 'STOP_LOSS';
          } else if (openTrade.direction === 'SHORT_SPREAD' && currentZ >= zScoreStopLoss) {
            shouldExit = true;
            exitReason = 'STOP_LOSS';
          }
        }
      }

      // Force exit at last bar of simulation
      if (!shouldExit && t === spreadSeries.length - 1) {
        shouldExit = true;
        exitReason = 'END_OF_SIMULATION';
      }

      if (shouldExit) {
        // Retrieve exact settlement price for the held contracts on exit date to guarantee pricing integrity
        const heldObsA = obsByContractDate.get(`${symA}_${current.date}_${heldExpA}`);
        const heldObsB = obsByContractDate.get(`${symB}_${current.date}_${heldExpB}`);

        const exitPriceA = heldObsA ? heldObsA.normalizedPrice : (current.expA === heldExpA ? current.priceA : (lastKnownPriceByContract.get(`${symA}_${heldExpA}`) ?? openTrade.entryPriceA));
        const exitPriceB = heldObsB ? heldObsB.normalizedPrice : (current.expB === heldExpB ? current.priceB : (lastKnownPriceByContract.get(`${symB}_${heldExpB}`) ?? openTrade.entryPriceB));
        const exitSpread = Number((exitPriceA - exitPriceB).toFixed(2));

        openTrade.exitDate = current.date;
        openTrade.exitPriceA = exitPriceA;
        openTrade.exitPriceB = exitPriceB;
        openTrade.exitSpread = exitSpread;
        openTrade.status = 'CLOSED';
        openTrade.exitReason = exitReason;

        // Leg-level price changes strictly using the same contract's entry and exit prices
        const priceChangeA = exitPriceA - openTrade.entryPriceA;
        const priceChangeB = exitPriceB - openTrade.entryPriceB;

        // Long spread: Buy Leg A, Sell Leg B
        // Short spread: Sell Leg A, Buy Leg B
        const dirSignA = openTrade.direction === 'LONG_SPREAD' ? 1 : -1;
        const dirSignB = openTrade.direction === 'LONG_SPREAD' ? -1 : 1;

        // Independent leg-by-leg gross P&L calculation (for 100g = 10 units of 10g)
        const legAPnL = Number((dirSignA * priceChangeA * unitsOf10g).toFixed(2));
        const legBPnL = Number((dirSignB * priceChangeB * unitsOf10g).toFixed(2));
        openTrade.legAPnL = legAPnL;
        openTrade.legBPnL = legBPnL;

        // Gross Realized P&L derived strictly from trade legs: PnL_LegA + PnL_LegB
        openTrade.grossPnL = Number((legAPnL + legBPnL).toFixed(2));

        // Exit transaction costs (slippage + brokerage on closing legs)
        openTrade.exitFriction = Number((frictionPer10g * unitsOf10g).toFixed(2));
        openTrade.totalFriction = Number((openTrade.entryFriction + openTrade.exitFriction).toFixed(2));

        // Net Realized P&L: Gross Realized P&L minus Total Friction
        openTrade.netPnL = Number((openTrade.grossPnL - openTrade.totalFriction).toFixed(2));

        // Economic Attribution:
        // Broad underlying gold price shift (mean benchmark change across both legs)
        const benchmarkGoldShift = (priceChangeA + priceChangeB) / 2;
        // Directional market tilt: unhedged physical exposure units (0 when matched 1:1)
        const netExposureUnits = (dirSignA + dirSignB) * unitsOf10g;
        const goldMarketBetaPnL = Number((netExposureUnits * benchmarkGoldShift).toFixed(2));

        // Relative-Value Spread Alpha: gross convergence profit minus any unhedged directional beta
        const relativeValueAlphaPnL = Number((openTrade.grossPnL - goldMarketBetaPnL).toFixed(2));
        const residualPnL = Number((openTrade.grossPnL - (goldMarketBetaPnL + relativeValueAlphaPnL)).toFixed(2));

        openTrade.attribution = {
          goldMarketBetaPnL,
          relativeValueAlphaPnL,
          executionFriction: -openTrade.totalFriction,
          residualPnL
        };

        currentEquity += openTrade.netPnL;
        trades.push({ ...openTrade });
        openTrade = null;
      }
    }

    // 2. Evaluate entry opportunities on current bar t (requires warm-up history of matching provenance)
    if (!openTrade) {
      // Isolate historical calibration strictly to prior observations of the same provenance
      const matchingPriorBars = spreadSeries
        .slice(0, t)
        .filter(p => p.provA === current.provA);

      if (matchingPriorBars.length >= warmUpDays) {
        // Historical calibration window: strictly single-provenance prior warmUpDays (ZERO look-ahead)
        const histWindow = matchingPriorBars.slice(-warmUpDays);
        const mean = histWindow.reduce((acc, p) => acc + p.spread, 0) / histWindow.length;
        const variance = histWindow.reduce((acc, p) => acc + Math.pow(p.spread - mean, 2), 0) / histWindow.length;
        const stdDev = Math.sqrt(variance) || 1.0;

        const currentZ = (current.spread - mean) / stdDev;

      let direction: PositionDirection | null = null;
      if (currentZ <= -zScoreEntryThreshold) {
        direction = 'LONG_SPREAD'; // Spread is cheap: buy A, sell B
      } else if (currentZ >= zScoreEntryThreshold) {
        direction = 'SHORT_SPREAD'; // Spread is rich: sell A, buy B
      }

      if (direction) {
        totalCandidateSignals++;

        // Gate 1: Check Lifecycle Eligibility (neither leg in tender window)
        const lifecycleCheck = evaluatePairLifecycleEligibility(pair, current.date, current.expA, current.expB);
        if (!lifecycleCheck.isEligible) {
          rejectedSignals++;
          rejectionBreakdown['TENDER_WINDOW_RESTRICTION']++;
        } else {
          // Gate 2: Net Edge Hurdle check (gross theoretical convergence edge must exceed round-trip friction)
          const expectedConvergenceEdge = Math.abs(current.spread - mean);
          const roundTripFriction = frictionPer10g * 2; // entry + exit hurdle

          if (expectedConvergenceEdge <= roundTripFriction) {
            rejectedSignals++;
            rejectionBreakdown['INSUFFICIENT_NET_EDGE']++;
          } else {
            // Signal passes all gates: Execute Entry
            tradeCounter++;
            const entryFriction = Number((frictionPer10g * unitsOf10g).toFixed(2));

            openTrade = {
              tradeId: `TRD-${tradeCounter.toString().padStart(3, '0')}`,
              pair,
              direction,
              entryDate: current.date,
              entryPriceA: current.priceA,
              entryPriceB: current.priceB,
              expiryA: current.expA,
              expiryB: current.expB,
              entrySpread: current.spread,
              lotQuantityA,
              lotQuantityB,
              normalizedGrams,
              grossPnL: 0,
              entryFriction,
              exitFriction: 0,
              totalFriction: entryFriction,
              netPnL: -entryFriction, // marked down immediately by entry cost
              status: 'OPEN',
              holdingDays: 0
            };
          }
        }
      }
    }
  }

    // 3. Record daily equity curve
    const dayPnl = currentEquity - prevEquity;
    dailyReturns.push(prevEquity > 0 ? dayPnl / prevEquity : 0);

    peakEquity = Math.max(peakEquity, currentEquity);
    const drawdown = peakEquity - currentEquity;
    const drawdownPct = peakEquity > 0 ? (drawdown / peakEquity) * 100 : 0;

    if (drawdown > maxDrawdownINR) maxDrawdownINR = drawdown;
    if (drawdownPct > maxDrawdownPct) maxDrawdownPct = drawdownPct;

    dailyEquityCurve.push({
      date: current.date,
      equity: Number(currentEquity.toFixed(2)),
      drawdown: Number(drawdown.toFixed(2)),
      pnl: Number(dayPnl.toFixed(2)),
      activePositions: openTrade ? 1 : 0
    });
  }

  // Final summary statistics
  const completedTrades = trades.filter(t => t.status === 'CLOSED');
  const winCount = completedTrades.filter(t => t.netPnL > 0).length;
  const lossCount = completedTrades.filter(t => t.netPnL <= 0).length;
  const winRatePct = completedTrades.length > 0 ? Number(((winCount / completedTrades.length) * 100).toFixed(1)) : 0;

  const grossPnL = Number(completedTrades.reduce((acc, t) => acc + t.grossPnL, 0).toFixed(2));
  const totalFrictionCosts = Number(completedTrades.reduce((acc, t) => acc + t.totalFriction, 0).toFixed(2));
  const netPnL = Number((grossPnL - totalFrictionCosts).toFixed(2));

  const totalGains = completedTrades.filter(t => t.netPnL > 0).reduce((acc, t) => acc + t.netPnL, 0);
  const totalLosses = Math.abs(completedTrades.filter(t => t.netPnL < 0).reduce((acc, t) => acc + t.netPnL, 0));
  const profitFactor = totalLosses > 0 ? Number((totalGains / totalLosses).toFixed(2)) : (totalGains > 0 ? 99.9 : 0);

  const avgTradeDurationDays = completedTrades.length > 0
    ? Number((completedTrades.reduce((acc, t) => acc + t.holdingDays, 0) / completedTrades.length).toFixed(1))
    : 0;
  const avgTradePnL = completedTrades.length > 0
    ? Number((netPnL / completedTrades.length).toFixed(2))
    : 0;

  // Annualized Sharpe Ratio calculation: (mean / std) * sqrt(252)
  const meanReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const varReturn = dailyReturns.length > 1
    ? dailyReturns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (dailyReturns.length - 1)
    : 0;
  const stdReturn = Math.sqrt(varReturn) || 0;
  const sharpeRatio = stdReturn > 0 ? Number(((meanReturn / stdReturn) * Math.sqrt(252)).toFixed(2)) : 0;

  const attributionSummary = {
    totalGoldBetaPnL: Number(completedTrades.reduce((acc, t) => acc + (t.attribution?.goldMarketBetaPnL || 0), 0).toFixed(2)),
    totalRelativeValueAlphaPnL: Number(completedTrades.reduce((acc, t) => acc + (t.attribution?.relativeValueAlphaPnL || 0), 0).toFixed(2)),
    totalFrictionCost: -totalFrictionCosts,
    totalResidualPnL: Number(completedTrades.reduce((acc, t) => acc + (t.attribution?.residualPnL || 0), 0).toFixed(2))
  };

  return {
    pair,
    totalCandidateSignals,
    acceptedTrades: trades.length,
    rejectedSignals,
    rejectionBreakdown,
    completedTrades: completedTrades.length,
    openTrades: openTrade ? 1 : 0,
    winCount,
    lossCount,
    winRatePct,
    grossPnL,
    totalFrictionCosts,
    netPnL,
    profitFactor,
    maxDrawdownINR: Number(maxDrawdownINR.toFixed(2)),
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    sharpeRatio,
    avgTradeDurationDays,
    avgTradePnL,
    dailyEquityCurve,
    trades,
    attributionSummary,
    dataSufficiencyWarning,
    totalAvailableDates: commonDates.length,
    evaluatedDates: spreadSeries.length,
    warmUpDates: warmUpDays,
    executionAssumption: 'Simulated execution assumes daily settlement price fill with configured slippage model; settlement prices are not guaranteed executable order-book fills.'
  };
}
