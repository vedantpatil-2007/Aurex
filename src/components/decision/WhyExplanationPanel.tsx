import React from 'react';
import { DecisionResult } from '../../types/market';
import { formatINR } from '../../utils/formatters';
import { HelpCircle, CheckCircle, AlertCircle, FileText } from 'lucide-react';

interface WhyExplanationPanelProps {
  decisionResult: DecisionResult;
}

export const WhyExplanationPanel: React.FC<WhyExplanationPanelProps> = ({ decisionResult }) => {
  const { decision, expectedEdge, totalFriction, netEdge, liquidityGrade, liquidityScore, rationale, triggerRules } = decisionResult;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <HelpCircle className="w-4 h-4 text-amber-600" />
        <h3 className="text-sm font-bold text-slate-900 tracking-tight font-mono">
          Decision Audit: Why {decision}?
        </h3>
      </div>

      {/* Structured "Why?" Breakdown as specified in problem statement */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-xs space-y-2">
        <div className="font-bold text-slate-900 text-sm pb-1 border-b border-slate-200 flex items-center justify-between">
          <span>DECISION: {decision}</span>
          <span className="text-[11px] font-normal text-slate-500 font-sans">
            AUREX Deterministic Rule Evaluation
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-slate-700">
          <div>
            <span className="text-slate-400">Expected Edge: </span>
            <span className="font-bold text-slate-900">{formatINR(expectedEdge)}</span>
          </div>
          <div>
            <span className="text-slate-400">Estimated Friction: </span>
            <span className="font-bold text-rose-600">{formatINR(totalFriction)}</span>
          </div>
          <div>
            <span className="text-slate-400">Liquidity Grade: </span>
            <span className="font-bold text-slate-900">{liquidityGrade} ({liquidityScore}/100)</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200 text-slate-800">
          <div className="text-slate-500 uppercase text-[10px] font-sans font-semibold">
            Synthesis Conclusion:
          </div>
          <div className="font-sans text-xs font-medium text-slate-800 mt-1 leading-relaxed">
            {rationale}
          </div>
        </div>
      </div>

      {/* Explicit Rules Triggered */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          <span>Triggered Engine Logic</span>
        </div>
        <div className="space-y-1.5">
          {triggerRules.map((rule, idx) => (
            <div
              key={idx}
              className="text-xs bg-slate-50 border border-slate-200/80 px-3 py-2 rounded text-slate-700 flex items-start gap-2"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
              <div className="font-mono text-[11px]">{rule}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
