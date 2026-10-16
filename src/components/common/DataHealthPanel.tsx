import React from 'react';
import { DataHealthSummary } from '../../types/market';
import { ShieldCheck, Database, Calendar, Layers, Activity } from 'lucide-react';

interface DataHealthPanelProps {
  health?: DataHealthSummary;
  compact?: boolean;
}

export const DataHealthPanel: React.FC<DataHealthPanelProps> = ({ health, compact = false }) => {
  const safeHealth = health || {
    source: 'Historical MCX / Prototype Simulation',
    totalRecords: 240,
    contractsCount: 4,
    lastAvailableDate: '2026-10-08',
    qualityStatus: 'PASS' as const,
    contractCoverage: '4 / 4 Monitored'
  };

  if (compact) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs shadow-sm font-mono">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Database className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[11px] font-sans text-slate-500">Source:</span>
          <span className="font-semibold text-slate-800">{safeHealth.source}</span>
        </div>
        <span className="text-slate-300">|</span>
        <div className="text-slate-600">
          <span className="text-[11px] font-sans text-slate-500">Records:</span>{' '}
          <span className="font-bold text-slate-800">{safeHealth.totalRecords}</span>
        </div>
        <span className="text-slate-300">|</span>
        <div className="text-slate-600">
          <span className="text-[11px] font-sans text-slate-500">Contracts:</span>{' '}
          <span className="font-bold text-slate-800">{safeHealth.contractsCount} / 4</span>
        </div>
        <span className="text-slate-300">|</span>
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-sans text-slate-500">Quality:</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
            safeHealth.qualityStatus === 'PASS' 
              ? 'bg-emerald-100 text-emerald-800' 
              : 'bg-amber-100 text-amber-800'
          }`}>
            {safeHealth.qualityStatus}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
            Data Health & Integrity Status
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            AUDIT: {safeHealth.qualityStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs font-mono">
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <div className="text-[10px] font-sans uppercase font-medium text-slate-400">Data Source</div>
          <div className="font-bold text-slate-900 mt-0.5 truncate" title={safeHealth.source}>
            {safeHealth.source}
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <div className="text-[10px] font-sans uppercase font-medium text-slate-400">Total Observations</div>
          <div className="font-bold text-slate-900 mt-0.5">
            {safeHealth.totalRecords} Rows
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <div className="text-[10px] font-sans uppercase font-medium text-slate-400">Contract Universe</div>
          <div className="font-bold text-slate-900 mt-0.5">
            {safeHealth.contractsCount} / 4 Contracts
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <div className="text-[10px] font-sans uppercase font-medium text-slate-400">Last Observation</div>
          <div className="font-bold text-slate-900 mt-0.5">
            {safeHealth.lastAvailableDate}
          </div>
        </div>
      </div>
    </div>
  );
};
