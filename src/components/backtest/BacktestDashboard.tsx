import React, { useState, useMemo } from 'react';
import {
  ContractSymbol,
  NormalizedObservation,
  BacktestParameters,
  FrictionAssumptions
} from '../../types/market';
import { runWalkForwardBacktest } from '../../engines/backtestEngine';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  Play,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  DollarSign,
  Activity,
  Layers,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface BacktestDashboardProps {
  observations: NormalizedObservation[];
  selectedPair: [ContractSymbol, ContractSymbol];
  onPairChange?: (pair: [ContractSymbol, ContractSymbol]) => void;
  defaultFriction?: FrictionAssumptions;
}

export const BacktestDashboard: React.FC<BacktestDashboardProps> = ({
  observations,
  selectedPair,
  onPairChange,
  defaultFriction = {
    slippagePer10g: 20,
    brokerageTaxesPer10g: 30,
    liquidityHaircutPer10g: 15,
    costBufferPer10g: 15,
    liquidityThresholdScore: 50
  }
}) => {
  const [entryZ, setEntryZ] = useState<number>(1.2);
  const [exitZ, setExitZ] = useState<number>(0.0);
  const [stopLossZ, setStopLossZ] = useState<number>(2.5);
  const [maxHolding, setMaxHolding] = useState<number>(12);
  const [warmUp, setWarmUp] = useState<number>(15);
  const [friction, setFriction] = useState<FrictionAssumptions>(defaultFriction);

  // Compute backtest strictly without look-ahead bias
  const backtestResult = useMemo(() => {
    const params: BacktestParameters = {
      pair: selectedPair,
      zScoreEntryThreshold: entryZ,
      zScoreExitThreshold: exitZ,
      zScoreStopLoss: stopLossZ,
      maxHoldingDays: maxHolding,
      friction,
      warmUpDays: warmUp,
      capitalAllocationINR: 1000000
    };
    return runWalkForwardBacktest(observations, params);
  }, [observations, selectedPair, entryZ, exitZ, stopLossZ, maxHolding, friction, warmUp]);

  return (
    <div className="space-y-6">
      {/* Simulation Controls Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                Workstream 3 & 4
              </span>
              <span className="text-xs text-slate-500 font-mono">Zero Look-Ahead Walk-Forward Replay</span>
            </div>
            <h3 className="text-base font-bold font-mono text-slate-900 mt-1 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              Chronological Trade-Level Simulation
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Replays daily market settlements chronologically. Rolling parameters (μ, σ, Z) at step t use historical data only.
            </p>
          </div>

          {/* Quick Pair Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-slate-600">Spread Pair:</span>
            <span className="text-xs font-mono font-bold bg-slate-100 border border-slate-200 px-2.5 py-1 rounded text-slate-800">
              {selectedPair[0]} / {selectedPair[1]}
            </span>
          </div>
        </div>

        {/* Strategy Parameters Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1.5 bg-slate-50 border border-slate-200/80 p-3 rounded-lg">
            <div className="flex justify-between font-mono">
              <span className="text-slate-600">Entry Threshold:</span>
              <span className="font-bold text-slate-900">|Z| ≥ {entryZ.toFixed(1)}σ</span>
            </div>
            <input
              type="range" min="0.8" max="2.5" step="0.1" value={entryZ}
              onChange={e => setEntryZ(parseFloat(e.target.value))}
              className="w-full accent-amber-600 h-1.5 bg-slate-200 rounded cursor-pointer"
            />
            <div className="text-[10px] text-slate-400">Statistical spread dislocation gate</div>
          </div>

          <div className="space-y-1.5 bg-slate-50 border border-slate-200/80 p-3 rounded-lg">
            <div className="flex justify-between font-mono">
              <span className="text-slate-600">Exit / Convergence:</span>
              <span className="font-bold text-slate-900">Z = {exitZ.toFixed(1)}σ</span>
            </div>
            <input
              type="range" min="-0.5" max="0.5" step="0.1" value={exitZ}
              onChange={e => setExitZ(parseFloat(e.target.value))}
              className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded cursor-pointer"
            />
            <div className="text-[10px] text-slate-400">Mean reversion target exit</div>
          </div>

          <div className="space-y-1.5 bg-slate-50 border border-slate-200/80 p-3 rounded-lg">
            <div className="flex justify-between font-mono">
              <span className="text-slate-600">Stop Loss:</span>
              <span className="font-bold text-slate-900">|Z| ≥ {stopLossZ.toFixed(1)}σ</span>
            </div>
            <input
              type="range" min="1.8" max="4.0" step="0.1" value={stopLossZ}
              onChange={e => setStopLossZ(parseFloat(e.target.value))}
              className="w-full accent-rose-600 h-1.5 bg-slate-200 rounded cursor-pointer"
            />
            <div className="text-[10px] text-slate-400">Adverse basis expansion safeguard</div>
          </div>

          <div className="space-y-1.5 bg-slate-50 border border-slate-200/80 p-3 rounded-lg">
            <div className="flex justify-between font-mono">
              <span className="text-slate-600">Max Holding Period:</span>
              <span className="font-bold text-slate-900">{maxHolding} days</span>
            </div>
            <input
              type="range" min="5" max="25" step="1" value={maxHolding}
              onChange={e => setMaxHolding(parseInt(e.target.value, 10))}
              className="w-full accent-slate-700 h-1.5 bg-slate-200 rounded cursor-pointer"
            />
            <div className="text-[10px] text-slate-400">Forces exit if trade stalls</div>
          </div>
        </div>
      </div>

      {/* Sample Size Warning Banner & Execution Model */}
      {backtestResult.dataSufficiencyWarning && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3 text-xs shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold font-mono text-amber-950">
              Statistical Validation Caveat: Historical Sample Size Notice
            </div>
            <p className="text-amber-900 leading-relaxed">
              {backtestResult.dataSufficiencyWarning}
            </p>
            {backtestResult.executionAssumption && (
              <p className="text-[11px] font-mono text-amber-800 pt-0.5">
                Execution Model: {backtestResult.executionAssumption}
              </p>
            )}
          </div>
        </div>
      )}

      {/* KPI Performance Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Net Realized P&L</div>
          <div className={`text-lg font-bold ${backtestResult.netPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatINR(backtestResult.netPnL)}
          </div>
          <div className="text-[10px] text-slate-500">Capital: ₹10,00,000</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Win Rate</div>
          <div className="text-lg font-bold text-slate-900">
            {backtestResult.winRatePct}%
          </div>
          <div className="text-[10px] text-slate-500">{backtestResult.winCount}W / {backtestResult.lossCount}L</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Profit Factor</div>
          <div className="text-lg font-bold text-slate-900">
            {backtestResult.profitFactor.toFixed(2)}x
          </div>
          <div className="text-[10px] text-slate-500">Gross: {formatINR(backtestResult.grossPnL)}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sharpe Ratio</div>
          <div className="text-lg font-bold text-slate-900">
            {backtestResult.sharpeRatio.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500">Annualized (252d)</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Max Drawdown</div>
          <div className="text-lg font-bold text-rose-700">
            {formatINR(backtestResult.maxDrawdownINR)}
          </div>
          <div className="text-[10px] text-rose-600">({backtestResult.maxDrawdownPct}%)</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Friction</div>
          <div className="text-lg font-bold text-slate-700">
            {formatINR(backtestResult.totalFrictionCosts)}
          </div>
          <div className="text-[10px] text-slate-500">Round-trip entry/exit</div>
        </div>
      </div>

      {/* Signals & Gate Rejections Breakdown */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-800 uppercase tracking-wider">Signals Evaluation:</span>
          <span className="bg-white border border-slate-200 px-2.5 py-1 rounded">
            Candidate Dislocation Signals: <strong>{backtestResult.totalCandidateSignals}</strong>
          </span>
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded">
            Accepted & Executed: <strong>{backtestResult.acceptedTrades}</strong>
          </span>
          <span className="bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 rounded">
            Filtered by Gates: <strong>{backtestResult.rejectedSignals}</strong>
          </span>
        </div>

        {/* Rejection pills */}
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(backtestResult.rejectionBreakdown).map(([reason, count]) => count > 0 && (
            <span key={reason} className="px-2 py-0.5 rounded text-[11px] bg-slate-200 text-slate-700">
              {reason.replace(/_/g, ' ')}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* Equity Curve & Drawdown Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div>
            <h4 className="text-sm font-bold font-mono text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Simulated Portfolio Equity Curve (Net of Transaction Costs)
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Daily marked-to-market trajectory based on 100g physical gold exposure matching.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
            {backtestResult.dailyEquityCurve.length} Simulation Sessions
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={backtestResult.dailyEquityCurve} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                tickFormatter={(v) => `₹${Math.round(v).toLocaleString('en-IN')}`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Portfolio Equity']}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#equityGrad)"
                name="Portfolio Equity"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trade-Level History Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-5 py-3 font-mono font-bold text-xs text-slate-800 border-b border-slate-200 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            Trade-Level Accounting Ledger ({backtestResult.trades.length} Executed Trades)
          </span>
          <span className="text-[11px] font-sans font-normal text-slate-500">
            Hedge Convention: 100g physical gold exposure matching per leg
          </span>
        </div>

        {backtestResult.trades.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No candidate signals cleared the Z-score and transaction cost hurdle gates during this simulation period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Trade ID</th>
                  <th className="py-2.5 px-3">Direction</th>
                  <th className="py-2.5 px-3">Entry Date</th>
                  <th className="py-2.5 px-3">Exit Date</th>
                  <th className="py-2.5 px-3 text-right">Entry Spread</th>
                  <th className="py-2.5 px-3 text-right">Exit Spread</th>
                  <th className="py-2.5 px-3 text-right">Gross P&L</th>
                  <th className="py-2.5 px-3 text-right">Total Fees</th>
                  <th className="py-2.5 px-3 text-right">Net P&L</th>
                  <th className="py-2.5 px-3">Exit Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backtestResult.trades.map(trade => (
                  <tr key={trade.tradeId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{trade.tradeId}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        trade.direction === 'LONG_SPREAD'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {trade.direction === 'LONG_SPREAD' ? 'LONG A / SHORT B' : 'SHORT A / LONG B'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{trade.entryDate}</td>
                    <td className="py-2.5 px-3 text-slate-600">{trade.exitDate || 'Open'}</td>
                    <td className="py-2.5 px-3 text-right text-slate-700">{formatINR(trade.entrySpread)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-700">{trade.exitSpread !== undefined ? formatINR(trade.exitSpread) : '—'}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-800">{formatINR(trade.grossPnL)}</td>
                    <td className="py-2.5 px-3 text-right text-rose-600">−{formatINR(trade.totalFriction)}</td>
                    <td className={`py-2.5 px-3 text-right font-bold ${trade.netPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatINR(trade.netPnL)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {trade.exitReason?.replace(/_/g, ' ') || 'ACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
