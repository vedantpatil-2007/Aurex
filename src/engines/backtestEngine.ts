import {
  NormalizedObservation,
  BacktestParameters,
  BacktestPerformanceSummary,
  BacktestTrade,
  BacktestEquityPoint,
  PositionDirection,
  TradeExitReason
} from '../types/market';
import { CONTRACT_SPECIFICATIONS } from '../data/contracts';
import { calculateTotalFriction } from './liquidityCostEngine';
import { evaluatePairLifecycleEligibility } from './lifecycleEngine';

/**
 * Complete Walk-Forward Chronological Backtesting Engine
 *
 * Strict Zero Look-Ahead Bias:
 * - Observations are processed strictly in chronological order.
 * - Rolling statistical parameters (Î¼, Ïƒ, Z-score) at step t are calibrated
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

  // Align dates where both contracts have contemporaneous observations
  const obsByDateA = new Map<string, NormalizedObservation>();
  const obsByDateB = new Map<string, NormalizedObservation>();

  for (const obs of observations) {
    if (obs.symbol === symA) obsByDateA.set(obs.date, obs);
    if (obs.symbol === symB) obsByDateB.set(obs.date, obs);
  }

  const commonDates = Array.from(obsByDateA.keys())
    .filter(d => obsByDateB.has(d))
    .sort((a, b) => a.localeCompare(b));

  // Friction per 10g unit
  const frictionPer10g = calculateTotalFriction(friction);

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

  // Build daily spread series for chronological replay
  const spreadSeries: { date: string; spread: number; priceA: number; priceB: number; expA: string; expB: string }[] = [];
  for (const date of commonDates) {
    const a = obsByDateA.get(date)!;
    const b = obsByDateB.get(date)!;
    const spread = Number((a.normalizedPrice - b.normalizedPrice).toFixed(2));
    spreadSeries.push({
      date,
      spread,
      priceA: a.normalizedPrice,
      priceB: b.normalizedPrice,
      expA: a.expiryDate,
      expB: b.expiryDate
    });
  }

  // Iterate strictly forward through time
  for (let t = 0; t < spreadSeries.length; t++) {
    const current = spreadSeries[t];
    const prevEquity = currentEquity;

    // 1. Manage existing open trade (marking to market and exit evaluation)
    if (openTrade) {
      openTrade.holdingDays++;

      // Check current spread and prices
      const currentSpread = current.spread;
      const spreadDiff = openTrade.direction === 'LONG_SPREAD'
        ? currentSpread - openTrade.entrySpread
        : openTrade.entrySpread - currentSpread;

      // Evaluate exit triggers
      let shouldExit = false;
      let exitReason: TradeExitReason = 'TARGET_CONVERGENCE';

      // Check Lifecycle Eligibility (tender window forced exit)
      const lifecycleCheck = evaluatePairLifecycleEligibility(pair, current.date, current.expA, current.expB);
      if (!lifecycleCheck.isEligible) {
        shouldExit = true;
        exitReason = 'TENDER_WINDOW_FORCED_EXIT';
      }

      // Check Max Holding Period
      if (!shouldExit && openTrade.holdingDays >= maxHoldingDays) {
        shouldExit = true;
        exitReason = 'MAX_HOLDING_PERIOD';
      }

      // Check statistical convergence or stop loss using historical trailing window up to t-1
      if (!shouldExit && t >= warmUpDays) {
        const histWindow = spreadSeries.slice(Math.max(0, t - warmUpDays), t);
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

      // Force exit at last bar of simulation
      if (!shouldExit && t === spreadSeries.length - 1) {
        shouldExit = true;
        exitReason = 'END_OF_SIMULATION';
      }

      if (shouldExit) {
        openTrade.exitDate = current.date;
        openTrade.exitPriceA = current.priceA;
        openTrade.exitPriceB = current.priceB;
        openTrade.exitSpread = currentSpread;
        openTrade.status = 'CLOSED';
        openTrade.exitReason = exitReason;

        // Exit transaction costs (slippage + brokerage on closing legs)
        openTrade.exitFriction = Number((frictionPer10g * unitsOf10g).toFixed(2));
        openTrade.totalFriction = Number((openTrade.entryFriction + openTrade.exitFriction).toFixed(2));

        // Gross P&L on 100g physical spread: (spread change per 10g) * 10
        openTrade.grossPnL = Number((spreadDiff * unitsOf10g).toFixed(2));
        openTrade.netPnL = Number((openTrade.grossPnL - openTrade.totalFriction).toFixed(2));

        // Attribution: Market Beta vs Relative-Value Alpha
        const priceChangeA = current.priceA - openTrade.entryPriceA;
        const priceChangeB = current.priceB - openTrade.entryPriceB;
        const _avgMarketShift = (priceChangeA + priceChangeB) / 2; // general gold market drift

        // Spread Alpha is the gross convergence profit
        const relativeValueAlphaPnL = openTrade.grossPnL;
        // Beta is the net directional market tilt (near zero when matched)
        const goldMarketBetaPnL = 0; // Hedged 1:1 on physical gold basis
        const residualPnL = Number((openTrade.netPnL - (relativeValueAlphaPnL - openTrade.totalFriction)).toFixed(2));

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

    // 2. Evaluate entry opportunities on current bar t (requires warm-up history [t - warmUpDays, t - 1])
    if (!openTrade && t >= warmUpDays) {
      // Historical calibration window: strictly [t - warmUpDays, t - 1] (ZERO look-ahead)
      const histWindow = spreadSeries.slice(t - warmUpDays, t);
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
    attributionSummary
  };
}
