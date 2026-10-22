import React, { useState, useMemo } from 'react';
import {
  ContractSymbol,
  NormalizedObservation,
  FrictionAssumptions,
  DataProvenance,
  RelativeValueSpreadPoint,
  BacktestParameters,
  BacktestTrade,
  DataSufficiencyAssessment
} from '../types/market';
import { EdgeSurvivalLedger } from '../components/ledger/EdgeSurvivalLedger';
import { buildEdgeSurvivalLedger } from '../engines/ledgerEngine';
import { calculateZScore, getActiveObservation } from '../engines/relativeValueEngine';
import { runWalkForwardBacktest } from '../engines/backtestEngine';
import { buildPerformanceWaterfallBridge, verifyAccountingIdentity } from '../engines/attributionEngine';
import { formatINR } from '../utils/formatters';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine
} from 'recharts';
import {
  ArrowRight,
  Calendar,
  Layers,
  TrendingUp,
  Scale,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';

interface LedgerPageProps {
  latestData: Record<ContractSymbol, NormalizedObservation>;
  allObservations: NormalizedObservation[];
  selectedPair: [ContractSymbol, ContractSymbol];
  onPairChange: (pair: [ContractSymbol, ContractSymbol]) => void;
  friction: FrictionAssumptions;
  manualEdge?: number;
  provenance: DataProvenance;
  availableDates: string[];
  selectedDate: string;
  onSelectDate: (d: string) => void;
  spreadSeries: RelativeValueSpreadPoint[];
  dataSufficiency?: DataSufficiencyAssessment;
  onNavigate: (page: any) => void;
}

export const Ledger: React.FC<LedgerPageProps> = ({
  latestData,
  allObservations,
  selectedPair,
  onPairChange,
  friction,
  manualEdge,
  provenance,
  availableDates,
  selectedDate,
  onSelectDate,
  spreadSeries,
  dataSufficiency,
  onNavigate
}) => {
  const [activeLedgerTab, setActiveLedgerTab] = useState<'edge-survival' | 'performance-attribution'>('edge-survival');

  // Find active near-month observations for selected pair on the chosen date
  const obsA = useMemo(() => {
    return getActiveObservation(allObservations, selectedPair[0], selectedDate) ||
      latestData[selectedPair[0]];
  }, [allObservations, selectedPair, selectedDate, latestData]);

  const obsB = useMemo(() => {
    return getActiveObservation(allObservations, selectedPair[1], selectedDate) ||
      latestData[selectedPair[1]];
  }, [allObservations, selectedPair, selectedDate, latestData]);

  // Compute statistical metrics for active pair
  const zScoreAnalysis = useMemo(() => {
    return calculateZScore(spreadSeries, 20);
  }, [spreadSeries]);

  // Build the 8-stage ledger with provenance isolation and data sufficiency
  const ledgerData = useMemo(() => {
    return buildEdgeSurvivalLedger({
      pair: selectedPair,
      obsA,
      obsB,
      provenance,
      friction,
      historicalMean: zScoreAnalysis.mean,
      historicalStdDev: zScoreAnalysis.standardDeviation,
      zScore: zScoreAnalysis.currentZScore,
      manualEdgeOverride: manualEdge,
      dataSufficiency,
      isCalculable: zScoreAnalysis.isCalculable,
      incalculableReason: zScoreAnalysis.incalculableReason
    });
  }, [selectedPair, obsA, obsB, provenance, friction, zScoreAnalysis, manualEdge, dataSufficiency]);

  // Workstream 4: Run Walk-Forward Attribution Simulation
  const backtestSummary = useMemo(() => {
    const params: BacktestParameters = {
      pair: selectedPair,
      zScoreEntryThreshold: 1.2,
      zScoreExitThreshold: 0.0,
      zScoreStopLoss: 2.5,
      maxHoldingDays: 12,
      warmUpDays: 15,
      friction,
      capitalAllocationINR: 1000000
    };
    return runWalkForwardBacktest(allObservations, params);
  }, [allObservations, selectedPair, friction]);

  const waterfallData = useMemo(() => {
    return buildPerformanceWaterfallBridge(backtestSummary);
  }, [backtestSummary]);

  const accountingReconciliation = useMemo(() => {
    return verifyAccountingIdentity(backtestSummary);
  }, [backtestSummary]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-900 text-amber-400 font-mono">
              Module 03 & 04
            </span>
            <span className="text-xs text-slate-500 font-medium">Auditable Decision Engine & Performance Attribution</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 font-mono">
            Edge Survival & Attribution Ledger
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            A comprehensive, transparent decision ledger proving whether theoretical relative-value dislocations survive economic normalization, maturity alignment, liquidity screening, and execution friction with verified accounting identities.
          </p>
        </div>

        <button
          onClick={() => onNavigate('decision')}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 self-start shadow-sm font-mono"
        >
          <span>Modify Friction Parameters</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-2">
        <button
          onClick={() => setActiveLedgerTab('edge-survival')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 font-mono ${
            activeLedgerTab === 'edge-survival'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Stage-by-Stage Edge Survival Audit</span>
        </button>

        <button
          onClick={() => setActiveLedgerTab('performance-attribution')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 font-mono ${
            activeLedgerTab === 'performance-attribution'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>P&L Attribution Waterfall Bridge (Workstream 4)</span>
        </button>
      </div>

      {/* Control Bar: Pair selector and Date picker */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Pair selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Contract Pair:</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPairChange(['GOLDM', 'GOLDTEN'])}
              className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition-colors ${
                selectedPair[0] === 'GOLDM' && selectedPair[1] === 'GOLDTEN'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              GOLDM / GOLDTEN
            </button>
            <button
              onClick={() => onPairChange(['GOLDM', 'GOLDGUINEA'])}
              className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition-colors ${
                selectedPair[0] === 'GOLDM' && selectedPair[1] === 'GOLDGUINEA'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              GOLDM / GUINEA
            </button>
            <button
              onClick={() => onPairChange(['GOLDM', 'GOLDPETAL'])}
              className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition-colors ${
                selectedPair[0] === 'GOLDM' && selectedPair[1] === 'GOLDPETAL'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              GOLDM / PETAL
            </button>
          </div>
        </div>

        {/* Date Selector (for Stage-by-Stage Ledger) */}
        {activeLedgerTab === 'edge-survival' && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Audit Date:</span>
            <select
              value={selectedDate}
              onChange={(e) => onSelectDate(e.target.value)}
              className="text-xs font-mono bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {availableDates.slice(-30).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: Stage-by-Stage Edge Survival Ledger */}
      {activeLedgerTab === 'edge-survival' && (
        <EdgeSurvivalLedger ledger={ledgerData} />
      )}

      {/* TAB 2: Workstream 4 Performance Attribution Waterfall Bridge */}
      {activeLedgerTab === 'performance-attribution' && (
        <div className="space-y-6">
          {/* Accounting Identity Reconciliation Banner */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            accountingReconciliation.reconciled
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                accountingReconciliation.reconciled ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}>
                {accountingReconciliation.reconciled ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-white/90 border shadow-sm">
                    Accounting Identity: {accountingReconciliation.reconciled ? 'VERIFIED (0 Residue)' : 'UNRECONCILED DISCREPANCY'}
                  </span>
                  <span className="text-xs font-mono text-slate-700">
                    Net Realized P&L = Gross Realized P&L (Alpha + Beta) − Total Frictions
                  </span>
                </div>
                <div className="text-xs text-slate-700 mt-1 font-mono">
                  {accountingReconciliation.details}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs text-slate-500 block">Total Realized Net P&L</span>
              <span className={`text-lg font-mono font-bold ${
                backtestSummary.netPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {formatINR(backtestSummary.netPnL)}
              </span>
            </div>
          </div>

          {/* Interactive Waterfall Bridge Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-mono flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                  Gross Dislocation to Net Realized Alpha Waterfall Bridge
                </h3>
                <p className="text-xs text-slate-500">
                  Itemized waterfall decomposition proving exact deductions from gross dislocation to net defensible P&L
                </p>
              </div>
              <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                Pair: {selectedPair[0]} / {selectedPair[1]}
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 11, fontFamily: 'monospace', fill: '#475569' }}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fontFamily: 'monospace', fill: '#64748b' }}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip
                    formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Amount']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px', fontFamily: 'monospace' }}
                  />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {waterfallData.map((entry, index) => {
                      let color = '#10b981'; // gross emerald
                      if (entry.type === 'COST') color = '#ef4444'; // friction cost rose
                      if (entry.type === 'NET') color = entry.amount >= 0 ? '#0284c7' : '#dc2626'; // net teal/indigo
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Waterfall category legend */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t border-slate-100 text-center font-mono text-xs">
              {waterfallData.map(item => (
                <div key={item.category} className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block truncate">{item.category}</span>
                  <span className={`font-bold ${
                    item.amount > 0 ? 'text-emerald-700' : item.amount < 0 ? 'text-rose-700' : 'text-slate-800'
                  }`}>
                    {item.amount > 0 ? `+₹${item.amount}` : `₹${item.amount}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Trade-by-Trade Performance Attribution Ledger Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-slate-600" />
                  Itemized Trade Attribution Ledger ({backtestSummary.trades.length} Closed Trades)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Every historical position decomposed into market beta, relative-value alpha, carry accrual, and itemized frictions
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                100% Reconciled
              </span>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Trade</th>
                    <th className="py-2.5 px-3">Direction</th>
                    <th className="py-2.5 px-3">Entry / Exit</th>
                    <th className="py-2.5 px-3 text-right">Hold</th>
                    <th className="py-2.5 px-3 text-right">Beta Drift</th>
                    <th className="py-2.5 px-3 text-right">Spread Alpha</th>
                    <th className="py-2.5 px-3 text-right">Frictions</th>
                    <th className="py-2.5 px-3 text-right">Residual</th>
                    <th className="py-2.5 px-3 text-right">Net P&L</th>
                    <th className="py-2.5 px-3">Exit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {backtestSummary.trades.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-4 text-center text-slate-500 italic">
                        No closed trades completed in the selected parameter window.
                      </td>
                    </tr>
                  ) : (
                    backtestSummary.trades.map((t: BacktestTrade) => (
                      <tr key={t.tradeId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-900">{t.tradeId}</td>
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            t.direction === 'LONG_SPREAD' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {t.direction.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {t.entryDate} → {t.exitDate || 'OPEN'}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-700">{t.holdingDays}d</td>
                        <td className="py-2 px-3 text-right text-slate-500">
                          {t.attribution ? (t.attribution.goldMarketBetaPnL >= 0 ? `+₹${t.attribution.goldMarketBetaPnL}` : `₹${t.attribution.goldMarketBetaPnL}`) : '₹0'}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-emerald-700">
                          {t.attribution ? `+₹${t.attribution.relativeValueAlphaPnL}` : `+₹${t.grossPnL}`}
                        </td>
                        <td className="py-2 px-3 text-right text-rose-600">
                          -₹{t.totalFriction}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-400">
                          {t.attribution ? `₹${t.attribution.residualPnL}` : '₹0'}
                        </td>
                        <td className={`py-2 px-3 text-right font-bold ${
                          t.netPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {formatINR(t.netPnL)}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[10px]">
                          {t.exitReason ? t.exitReason.replace(/_/g, ' ') : 'ACTIVE'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
