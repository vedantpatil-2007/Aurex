import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface PrototypeBannerProps {
  dataQualityStatus?: 'PASS' | 'WARN';
}

export const PrototypeBanner: React.FC<PrototypeBannerProps> = ({ dataQualityStatus = 'PASS' }) => {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-900 font-medium">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 font-bold tracking-wider text-[10px] uppercase">
          <AlertTriangle className="w-3 h-3 text-amber-700" />
          Prototype Simulation
        </span>
        <span className="text-slate-600">
          Simulated demonstration data calibrated to official MCX PS03 contract parameters. Discrete expiry series without synthetic stitching.
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-slate-700">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Data Quality Audit:</span>
          <span className={`font-mono font-semibold px-1.5 py-0.2 rounded text-[11px] ${
            dataQualityStatus === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {dataQualityStatus}
          </span>
        </div>
      </div>
    </div>
  );
};
