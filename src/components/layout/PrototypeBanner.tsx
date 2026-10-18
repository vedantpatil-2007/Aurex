import React from 'react';
import { AlertTriangle, ShieldCheck, Database, ArrowRight, CheckCircle2 } from 'lucide-react';
import { DataProvenance } from '../../types/market';

interface PrototypeBannerProps {
  provenance: DataProvenance;
  filename?: string;
  dataQualityStatus?: 'PASS' | 'WARN';
  onNavigateToDataLab?: () => void;
}

export const PrototypeBanner: React.FC<PrototypeBannerProps> = ({ 
  provenance,
  filename,
  dataQualityStatus = 'PASS',
  onNavigateToDataLab
}) => {
  const isOfficial = provenance === 'OFFICIAL MCX DATA';
  const isUserImported = provenance === 'USER-IMPORTED MCX DATA';

  const badgeColor = isOfficial
    ? 'bg-emerald-600 text-white'
    : isUserImported
    ? 'bg-sky-600 text-white'
    : 'bg-amber-600 text-white';

  const containerBg = isOfficial
    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
    : isUserImported
    ? 'bg-sky-50/70 border-sky-200 text-sky-950'
    : 'bg-amber-50/70 border-amber-200 text-amber-950';

  return (
    <div className={`border-b px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-medium transition-colors ${containerBg}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold tracking-wider text-[10px] uppercase shadow-xs ${badgeColor}`}>
          <Database className="w-3 h-3" />
          {provenance}
        </span>
        <span className="text-slate-700">
          {isOfficial ? (
            <span>Verified historical MCX Daily Bhavcopy settlement dataset with discrete contracts.</span>
          ) : isUserImported ? (
            <span>User-provided file: <strong className="font-mono">{filename || 'custom_bhavcopy.csv'}</strong>. Discrete contract expiries verified.</span>
          ) : (
            <span>Calibrated prototype simulation based on official MCX PS03 contract parameters.</span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 text-slate-700">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Data Quality:</span>
          <span className={`font-mono font-bold px-1.5 py-0.2 rounded text-[11px] ${
            dataQualityStatus === 'PASS' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}>
            {dataQualityStatus}
          </span>
        </div>

        {onNavigateToDataLab && (
          <button
            onClick={onNavigateToDataLab}
            className="text-[11px] font-mono text-slate-800 hover:text-amber-800 underline flex items-center gap-0.5 ml-1"
          >
            <span>Data Lab</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
