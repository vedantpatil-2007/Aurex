import React, { useState } from 'react';
import { EdgeSurvivalLedgerData } from '../../types/market';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Scale, 
  TrendingUp, 
  Calendar, 
  Activity, 
  DollarSign, 
  ArrowRight,
  FileSpreadsheet
} from 'lucide-react';

interface EdgeSurvivalLedgerProps {
  ledger: EdgeSurvivalLedgerData;
}

export const EdgeSurvivalLedger: React.FC<EdgeSurvivalLedgerProps> = ({ ledger }) => {
  const [expandedStages, setExpandedStages] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    6: true,
    7: true,
    8: true
  });

  const toggleStage = (stageNum: number) => {
    setExpandedStages(prev => ({
      ...prev,
      [stageNum]: !prev[stageNum]
    }));
  };

  const expandAll = () => {
    const all: Record<number, boolean> = {};
    ledger.stages.forEach(s => { all[s.stageNumber] = true; });
    setExpandedStages(all);
  };

  const collapseAll = () => {
    setExpandedStages({});
  };

  const downloadAuditReport = () => {
    const jsonStr = JSON.stringify(ledger, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AUREX_Ledger_Audit_${ledger.pair[0]}_${ledger.pair[1]}_${ledger.tradeDate}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: 'PASS' | 'WARN' | 'FAIL' | 'INFO') => {
    switch (status) {
      case 'PASS':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'WARN':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'FAIL':
        return <XCircle className="w-4 h-4 text-rose-500" />;
      case 'INFO':
      default:
        return <Info className="w-4 h-4 text-sky-500" />;
    }
  };

  const getStatusBadge = (status: 'PASS' | 'WARN' | 'FAIL' | 'INFO') => {
    switch (status) {
      case 'PASS':
        return <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">PASS</span>;
      case 'WARN':
        return <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">WARN</span>;
      case 'FAIL':
        return <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">FAIL</span>;
      case 'INFO':
      default:
        return <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">INFO</span>;
    }
  };

  const getDecisionBadge = (decision: string) => {
    if (decision === 'ACTIONABLE') {
      return (
        <span className="px-3 py-1 rounded-md text-xs font-mono font-bold bg-emerald-600 text-white shadow-sm flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          ACTIONABLE
        </span>
      );
    }
    if (decision === 'WATCH') {
      return (
        <span className="px-3 py-1 rounded-md text-xs font-mono font-bold bg-amber-500 text-slate-950 shadow-sm flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          WATCH
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-md text-xs font-mono font-bold bg-rose-600 text-white shadow-sm flex items-center gap-1.5">
        <XCircle className="w-3.5 h-3.5" />
        NO TRADE (CAPITAL PRESERVED)
      </span>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Ledger Header */}
      <div className="p-5 bg-slate-900 text-white border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Signature Quantitative Feature
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Audit ID: {ledger.id}
            </span>
          </div>
          <h2 className="text-xl font-bold font-mono tracking-tight text-white mt-1 flex items-center gap-2">
            Edge Survival Ledger
            <span className="text-slate-400 font-sans font-normal text-sm">
              | {ledger.pair[0]} vs {ledger.pair[1]} ({ledger.tradeDate})
            </span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Eight-stage auditable decomposition proving whether theoretical relative-value survives data integrity, maturity alignment, liquidity constraints, and execution friction.
          </p>
        </div>

        {/* Verdict & Export Action */}
        <div className="flex flex-wrap items-center gap-3">
          {getDecisionBadge(ledger.decision)}
          <button
            onClick={downloadAuditReport}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-md border border-slate-700 transition-colors flex items-center gap-1.5"
            title="Download full JSON audit record"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export Audit Trail</span>
          </button>
        </div>
      </div>

      {/* Quick controls bar */}
      <div className="bg-slate-50 px-5 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <span>
            Dataset: <strong className="font-mono text-slate-900">{ledger.provenance}</strong>
          </span>
          <span>
            Net Edge: <strong className={`font-mono ${ledger.netEdge > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {ledger.netEdge > 0 ? '+' : ''}₹{ledger.netEdge.toFixed(2)}/10g
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={expandAll}
            className="text-[11px] text-slate-500 hover:text-slate-900 font-medium"
          >
            Expand All
          </button>
          <span className="text-slate-300">|</span>
          <button 
            onClick={collapseAll}
            className="text-[11px] text-slate-500 hover:text-slate-900 font-medium"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* 8-Stage Sequential Ledger Trail */}
      <div className="divide-y divide-slate-100">
        {ledger.stages.map((stage) => {
          const isExpanded = expandedStages[stage.stageNumber];
          return (
            <div key={stage.stageNumber} className="transition-colors hover:bg-slate-50/50">
              {/* Stage Header Summary Row */}
              <div 
                onClick={() => toggleStage(stage.stageNumber)}
                className="p-4 sm:px-6 flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-mono font-bold text-xs text-slate-700 shrink-0">
                    {stage.stageNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold tracking-wider text-slate-500 uppercase">
                        Stage {stage.stageNumber}: {stage.stageName}
                      </span>
                      {getStatusBadge(stage.status)}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 font-mono mt-0.5">
                      {stage.headline}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-slate-400">
                  {getStatusIcon(stage.status)}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </div>

              {/* Collapsible Stage Details */}
              {isExpanded && (
                <div className="px-4 pb-4 sm:px-6 sm:pb-5 space-y-3 pt-1">
                  {/* Metrics Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {stage.metrics.map((m, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5">
                        <div className="text-[11px] text-slate-500 font-medium">{m.label}</div>
                        <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 mt-0.5 break-all">
                          {m.value}
                        </div>
                        {m.note && (
                          <div className="text-[10px] text-slate-500 mt-0.5">{m.note}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Plain Language Quantitative Rationale */}
                  <div className="text-xs text-slate-700 bg-amber-50/40 border border-amber-200/60 rounded-lg p-3 leading-relaxed">
                    <strong className="text-amber-900 font-semibold mr-1">Analytical Note:</strong>
                    {stage.explanation}
                  </div>

                  {/* Audit Trail List */}
                  {stage.auditTrail.length > 0 && (
                    <div className="bg-slate-900 text-slate-200 rounded-lg p-3 font-mono text-[11px] space-y-1">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider pb-1 border-b border-slate-800">
                        Mathematical & System Audit Trail
                      </div>
                      {stage.auditTrail.map((item, aIdx) => (
                        <div key={aIdx} className="flex items-start gap-1.5 text-slate-300">
                          <span className="text-amber-400">›</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
