import React from 'react';
import { DecisionResult } from '../../types/market';
import { formatINR } from '../../utils/formatters';
import { DecisionBadge } from '../cards/DecisionBadge';
import { ArrowRight, Check, X, AlertTriangle, ShieldCheck, Scale, DollarSign, Activity } from 'lucide-react';

interface DecisionPipelineVisualProps {
  decisionResult: DecisionResult;
}

export const DecisionPipelineVisual: React.FC<DecisionPipelineVisualProps> = ({ decisionResult }) => {
  const { expectedEdge, totalFriction, netEdge, liquidityScore, liquidityGrade, decision } = decisionResult;

  const isLiquidityPass = liquidityGrade === 'PASS';
  const isLiquidityBorderline = liquidityGrade === 'BORDERLINE';
  const isCostSurviving = netEdge > 0;
  const isGate0Blocked = decision === 'NO TRADE' && (
    decisionResult.dataSufficiency?.canFormActionableVerdict === false ||
    decisionResult.rationale.includes('cannot be validated') ||
    decisionResult.rationale.includes('Insufficient') ||
    decisionResult.rationale.includes('unavailable')
  );
  const isSpreadMissing = decisionResult.rationale.includes('unavailable') || decisionResult.rationale.includes('Spread series is empty');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight font-mono">
            AUREX Decision Pipeline
          </h3>
          <p className="text-xs text-slate-500">
            Sequential risk filtration: dislocations must satisfy liquidity depth and execution friction
          </p>
        </div>
        <div className="text-xs font-mono font-bold">
          <DecisionBadge decision={decision} size="sm" />
        </div>
      </div>

      {/* 4-Stage Horizontal Pipeline Flow */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
        {/* Stage 1: Relative-Value Edge */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>1. Relative Edge</span>
            <Scale className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="my-2">
            <div className="text-xl font-bold font-mono text-slate-900">
              {isSpreadMissing ? 'N/A' : formatINR(expectedEdge)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {isSpreadMissing ? 'No Basis Data' : isGate0Blocked ? 'Instantaneous Basis (Uncalibrated)' : 'Gross Normalized Basis'}
            </div>
          </div>
          {isSpreadMissing ? (
            <div className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Data Unavailable</span>
            </div>
          ) : isGate0Blocked ? (
            <div className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Uncalibrated (Gate 0 Active)</span>
            </div>
          ) : (
            <div className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>Dislocation Detected</span>
            </div>
          )}
        </div>

        {/* Stage 2: Liquidity Check */}
        <div className={`border rounded-lg p-3.5 flex flex-col justify-between ${
          isLiquidityPass 
            ? 'bg-slate-50 border-slate-200' 
            : isLiquidityBorderline 
            ? 'bg-amber-50/50 border-amber-200' 
            : 'bg-rose-50/50 border-rose-200'
        }`}>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>2. Liquidity Check</span>
            <Activity className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="my-2">
            <div className="text-xl font-bold font-mono text-slate-900">
              {liquidityScore}<span className="text-xs text-slate-400 font-normal">/100</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Thinnest Leg Depth
            </div>
          </div>
          <div>
            {isLiquidityPass ? (
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>Grade: PASS</span>
              </span>
            ) : isLiquidityBorderline ? (
              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Grade: BORDERLINE</span>
              </span>
            ) : (
              <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-semibold flex items-center gap-1">
                <X className="w-3 h-3" />
                <span>Grade: FAIL (Rejected)</span>
              </span>
            )}
          </div>
        </div>

        {/* Stage 3: Execution Cost Check */}
        <div className={`border rounded-lg p-3.5 flex flex-col justify-between ${
          isCostSurviving 
            ? 'bg-slate-50 border-slate-200' 
            : 'bg-rose-50/50 border-rose-200'
        }`}>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>3. Cost Friction Check</span>
            <DollarSign className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="my-2">
            <div className="text-xl font-bold font-mono text-rose-600">
              {formatINR(totalFriction)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Slippage + Fees + Buffer
            </div>
          </div>
          <div>
            {isSpreadMissing ? (
              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>Basis Required: {formatINR(totalFriction)} Hurdle</span>
              </span>
            ) : isCostSurviving ? (
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>Survives: Net +{formatINR(netEdge)}</span>
              </span>
            ) : (
              <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-semibold flex items-center gap-1">
                <X className="w-3 h-3" />
                <span>Deficit: {formatINR(netEdge)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Stage 4: Synthesized Decision */}
        <div className="bg-slate-900 text-white rounded-lg p-3.5 flex flex-col justify-between border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>4. Final Decision</span>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="my-2">
            <div className="text-lg font-bold font-mono tracking-tight text-white">
              {decision}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
              Net Edge: {isSpreadMissing ? 'N/A (No Basis Data)' : formatINR(netEdge)}
            </div>
          </div>
          <div className="text-[10px] text-slate-300">
            {decision === 'ACTIONABLE' && 'Ready for capital allocation'}
            {decision === 'WATCH' && 'Stage order, await depth'}
            {decision === 'NO TRADE' && (isGate0Blocked ? 'Gate 0: Insufficient History Block' : 'Reject: Fails hurdle tests')}
          </div>
        </div>
      </div>
    </div>
  );
};
