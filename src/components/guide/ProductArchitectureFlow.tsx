import React from 'react';
import { 
  Database, 
  Scale, 
  GitCompare, 
  Activity, 
  DollarSign, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight 
} from 'lucide-react';

export const ProductArchitectureFlow: React.FC = () => {
  const pipelineSteps = [
    {
      label: 'MCX Data',
      sub: 'Discrete Expiries',
      icon: <Database className="w-3.5 h-3.5 text-amber-600" />
    },
    {
      label: 'Normalize',
      sub: '₹/10g @ 999 Fineness',
      icon: <Scale className="w-3.5 h-3.5 text-sky-600" />
    },
    {
      label: 'Relative Value',
      sub: 'Dynamic Basis S_t',
      icon: <GitCompare className="w-3.5 h-3.5 text-indigo-600" />
    },
    {
      label: 'Liquidity',
      sub: 'Thinner Leg Depth',
      icon: <Activity className="w-3.5 h-3.5 text-blue-600" />
    },
    {
      label: 'Cost Friction',
      sub: 'Slippage + Taxes',
      icon: <DollarSign className="w-3.5 h-3.5 text-rose-600" />
    },
    {
      label: 'Validate',
      sub: 'Out-of-Sample',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
    },
    {
      label: 'Decide',
      sub: 'Actionable / Watch / No Trade',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
    }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
            How AUREX Works
          </span>
          <span className="text-[11px] text-slate-400 font-sans">
            End-to-End Quantitative Processing Pipeline
          </span>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
          7-Stage Pipeline
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {pipelineSteps.map((step, idx) => (
          <div
            key={idx}
            className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-center flex flex-col items-center justify-between hover:bg-amber-50/40 transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-1.5 shadow-2xs">
              {step.icon}
            </div>
            <div className="font-mono font-bold text-xs text-slate-900 leading-tight">
              {step.label}
            </div>
            <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
              {step.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
