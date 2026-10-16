import React from 'react';
import { DecisionState, LiquidityGrade } from '../../types/market';
import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface DecisionBadgeProps {
  decision: DecisionState;
  size?: 'sm' | 'md' | 'lg';
}

export const DecisionBadge: React.FC<DecisionBadgeProps> = ({ decision, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base font-bold'
  };

  if (decision === 'ACTIONABLE') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-md font-mono font-bold tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-sm ${sizeClasses[size]}`}>
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ACTIONABLE
      </span>
    );
  }

  if (decision === 'WATCH') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-md font-mono font-bold tracking-wider bg-amber-50 text-amber-700 border border-amber-300 shadow-sm ${sizeClasses[size]}`}>
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        WATCH
      </span>
    );
  }

  // Phase 2F: Make NO TRADE look like a VALID SYSTEM OUTCOME (capital preservation), not an error!
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md font-mono font-bold tracking-wider bg-slate-900 text-slate-100 border border-slate-700 shadow-sm ${sizeClasses[size]}`}>
      <ShieldCheck className="w-4 h-4 text-amber-400" />
      NO TRADE
    </span>
  );
};

export const LiquidityBadge: React.FC<{ grade: LiquidityGrade }> = ({ grade }) => {
  if (grade === 'PASS') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
        PASS
      </span>
    );
  }
  if (grade === 'BORDERLINE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        BORDERLINE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-300">
      FAIL
    </span>
  );
};
