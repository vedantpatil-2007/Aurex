import React, { useMemo } from 'react';
import { 
  ContractSymbol, 
  NormalizedObservation, 
  PairComparabilityReport 
} from '../../types/market';
import { evaluateContractComparability } from '../../engines/comparabilityEngine';
import { 
  Scale, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  Layers, 
  ArrowRight,
  ShieldAlert,
  Clock
} from 'lucide-react';

interface ContractComparabilityCardProps {
  obsA?: NormalizedObservation;
  obsB?: NormalizedObservation;
  pair: [ContractSymbol, ContractSymbol];
  onPairChange?: (pair: [ContractSymbol, ContractSymbol]) => void;
}

export const ContractComparabilityCard: React.FC<ContractComparabilityCardProps> = ({
  obsA,
  obsB,
  pair,
  onPairChange
}) => {
  const report: PairComparabilityReport = useMemo(() => {
    return evaluateContractComparability(obsA, obsB, pair);
  }, [obsA, obsB, pair]);

  const getClassificationBadge = (classification: string) => {
    if (classification === 'COMPARABLE') {
      return (
        <span className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          COMPARABLE
        </span>
      );
    }
    if (classification === 'COMPARABLE WITH MATURITY DIFFERENCE') {
      return (
        <span className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          COMPARABLE WITH MATURITY DIFFERENCE
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5">
        <XCircle className="w-3.5 h-3.5 text-rose-600" />
        INSUFFICIENT DATA
      </span>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              Contract Comparability Engine
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Date: {report.date}
            </span>
          </div>
          <h3 className="text-lg font-bold font-mono text-slate-900 mt-0.5">
            Maturity & Lifecycle Comparability: {report.symbolA} vs {report.symbolB}
          </h3>
        </div>

        <div>
          {getClassificationBadge(report.classification)}
        </div>
      </div>

      {/* Grid of 4 key comparison cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Leg A */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
          <div className="text-[11px] font-semibold text-slate-500">{report.symbolA} Expiry & DTE</div>
          <div className="text-sm font-bold font-mono text-slate-900">
            {report.expiryA}
          </div>
          <div className="text-xs text-slate-600 font-mono flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{report.daysToExpiryA} calendar days left</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 font-mono">
            Vol: {report.volA.toLocaleString('en-IN')} | OI: {report.oiA.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Leg B */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
          <div className="text-[11px] font-semibold text-slate-500">{report.symbolB} Expiry & DTE</div>
          <div className="text-sm font-bold font-mono text-slate-900">
            {report.expiryB}
          </div>
          <div className="text-xs text-slate-600 font-mono flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{report.daysToExpiryB} calendar days left</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 font-mono">
            Vol: {report.volB.toLocaleString('en-IN')} | OI: {report.oiB.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Expiry Difference */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
          <div className="text-[11px] font-semibold text-slate-500">Maturity Mismatch</div>
          <div className={`text-sm font-bold font-mono ${report.expiryDifferenceDays > 7 ? 'text-amber-700' : 'text-slate-900'}`}>
            {report.expiryDifferenceDays} Calendar Days
          </div>
          <div className="text-xs text-slate-600">
            {report.expiryDifferenceDays <= 7 ? 'Near-synchronous maturity' : 'Includes term-structure carry'}
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
            Date Alignment: {report.dataDateAlignment ? 'PASS (Synchronous)' : 'FAIL'}
          </div>
        </div>

        {/* Normalized Spread */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
          <div className="text-[11px] font-semibold text-slate-500">Economic Spread (S_t)</div>
          <div className="text-sm font-bold font-mono text-slate-900">
            ₹{report.spread.toFixed(2)}/10g
          </div>
          <div className="text-xs text-slate-600 font-mono">
            ₹{report.normalizedPriceA.toFixed(0)} − ₹{report.normalizedPriceB.toFixed(0)}
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 font-mono">
            Basis: ₹/10g @ 999
          </div>
        </div>
      </div>

      {/* Term structure explanation & warnings */}
      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs space-y-2">
        <div className="text-slate-700 leading-relaxed">
          <strong className="text-slate-900 font-semibold mr-1">Term Structure Analysis:</strong>
          {report.termStructureNote}
        </div>

        {report.warnings.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-slate-200">
            <span className="font-semibold text-amber-800 text-[11px] uppercase tracking-wider block">
              Comparability Restrictions & Warnings:
            </span>
            {report.warnings.map((w, wIdx) => (
              <div key={wIdx} className="flex items-start gap-1.5 text-amber-900 text-[11px]">
                <span className="text-amber-600">⚠</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
