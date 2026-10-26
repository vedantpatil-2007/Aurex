import React from 'react';
import { DecisionResult } from '../../types/market';
import { DecisionBadge, LiquidityBadge } from './DecisionBadge';
import { formatINR } from '../../utils/formatters';
import { ShieldCheck, ArrowRight, Info, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';

interface CentralDecisionCardProps {
  decisionResult: DecisionResult;
  onOpenDecisionEngine?: () => void;
  onOpenLedger?: () => void;
}

export const CentralDecisionCard: React.FC<CentralDecisionCardProps> = ({
  decisionResult,
  onOpenDecisionEngine,
  onOpenLedger
}) => {
  const {
    pair,
    observedSpread,
    expectedEdge,
    totalFriction,
    netEdge,
    liquidityGrade,
    liquidityScore,
    decision,
    rationale
  } = decisionResult;

  const isNetEdgePositive = netEdge > 0;

  // Standardized Phase 2F Official State Explanations
  const decisionDescriptions = {
    ACTIONABLE: 'Observed relative-value edge survives liquidity and estimated execution friction.',
    WATCH: 'Relative-value anomaly detected, but liquidity is near the configured threshold.',
    'NO TRADE': 'Theoretical opportunity does not survive estimated execution friction.'
  };

  return (
    <div className="bg-white border-2 border-slate-200/90 rounded-xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
      {/* Decorative subtle header line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-slate-900" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase font-bold tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-mono">
              AUREX Core Gate
            </span>
            <span className="text-xs text-slate-400 font-mono">Cost-Aware Decision Gate</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2 font-mono flex-wrap">
            Pair Intelligence: {pair[0]} <span className="text-slate-400 font-sans font-light">vs</span> {pair[1]}
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-xl font-medium">
            {rationale || decisionDescriptions[decision]}
          </p>
        </div>

        {/* Big Decision Badge & Action buttons */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200/80 shrink-0">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              System Verdict
            </div>
            <div className="mt-1">
              <DecisionBadge decision={decision} size="lg" />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {onOpenLedger && (
              <button
                onClick={onOpenLedger}
                className="px-3 py-2 text-xs font-semibold rounded bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors flex items-center gap-1 shadow-sm font-mono cursor-pointer"
                title="Inspect 8-stage auditable ledger"
              >
                <span>Audit Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onOpenDecisionEngine && (
              <button
                onClick={onOpenDecisionEngine}
                className="px-3 py-2 text-xs font-semibold rounded bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center gap-1 shadow-sm font-mono cursor-pointer"
                title="Tune friction parameters in Decision Engine"
              >
                <span>Tune Gates</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid of live calculated values */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 pt-5">
        {/* Normalized Spread */}
        <div className="bg-slate-50/70 border border-slate-200/60 rounded-lg p-3 min-w-0">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider truncate" title="Normalized Spread">
            Normalized Spread
          </div>
          <div className="text-lg font-bold font-mono text-slate-900 mt-1 truncate">
            {formatINR(observedSpread)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            Basis: ₹ / 10g @ 999
          </div>
        </div>

        {/* Expected Edge */}
        <div className="bg-slate-50/70 border border-slate-200/60 rounded-lg p-3 min-w-0">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider truncate" title="Expected Edge">
            Expected Edge
          </div>
          <div className="text-lg font-bold font-mono text-amber-700 mt-1 truncate">
            {formatINR(expectedEdge)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            Gross dislocation
          </div>
        </div>

        {/* Estimated Friction */}
        <div className="bg-slate-50/70 border border-slate-200/60 rounded-lg p-3 min-w-0">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider truncate" title="Total Friction">
            Total Friction
          </div>
          <div className="text-lg font-bold font-mono text-rose-600 mt-1 truncate">
            {formatINR(totalFriction)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            Slippage + STT + buffer
          </div>
        </div>

        {/* Net Realizable Edge */}
        <div className="bg-slate-50/70 border border-slate-200/60 rounded-lg p-3 min-w-0">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider truncate" title="Net Defensible Edge">
            Net Defensible Edge
          </div>
          <div className={`text-lg font-bold font-mono mt-1 truncate ${isNetEdgePositive ? 'text-emerald-600' : 'text-slate-700'}`}>
            {isNetEdgePositive ? `+${formatINR(netEdge)}` : formatINR(netEdge)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            Survives costs test
          </div>
        </div>

        {/* Liquidity Check */}
        <div className="bg-slate-50/70 border border-slate-200/60 rounded-lg p-3 min-w-0 col-span-2 sm:col-span-1">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center justify-between gap-1">
            <span className="truncate">Liquidity Depth</span>
            <span className="font-mono text-[10px] font-semibold text-slate-600 shrink-0">{liquidityScore}/100</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <LiquidityBadge grade={liquidityGrade} />
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            Thinnest leg constraint
          </div>
        </div>
      </div>

      {/* Rationale explanation strip with dignity for NO TRADE */}
      <div className={`mt-4 pt-3.5 border-t border-slate-100 flex items-start gap-2.5 text-xs p-3 rounded-lg ${
        decision === 'ACTIONABLE'
          ? 'bg-emerald-50/50 text-emerald-900 border border-emerald-100'
          : decision === 'WATCH'
          ? 'bg-amber-50/50 text-amber-900 border border-amber-100'
          : 'bg-slate-50 text-slate-700 border border-slate-200'
      }`}>
        {decision === 'ACTIONABLE' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        ) : decision === 'WATCH' ? (
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        ) : (
          <Shield className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0 break-words">
          <span className="font-semibold text-slate-900">
            {decision === 'NO TRADE' ? 'Capital Preservation Activated: ' : 'Engine Rationale: '}
          </span>
          <span>{rationale}</span>
        </div>
      </div>

      {/* Institutional Methodology Distinction Note */}
      <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-1.5 font-sans">
        <div className="leading-relaxed">
          <span className="font-semibold text-slate-700">Instantaneous Valuation Basis:</span> Reflects single-session observed market dislocation minus estimated transaction friction. The imported dataset contains same-date records for both contracts (not independent exchange verification). A positive instantaneous edge does not guarantee mechanical strategy profitability.
        </div>
        {onOpenDecisionEngine && (
          <button
            onClick={onOpenDecisionEngine}
            className="text-amber-800 hover:text-amber-950 font-mono font-medium underline flex items-center gap-0.5 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <span>Stress Test Friction</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
