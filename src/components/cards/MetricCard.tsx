import React from 'react';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtitle,
  badge,
  icon
}) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-lg p-5 shadow-sm hover:border-slate-300 transition-colors min-w-0">
      <div className="flex items-center justify-between text-xs font-medium text-slate-500 uppercase tracking-wider gap-2">
        <span className="truncate">{label}</span>
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
      </div>

      <div className="mt-2.5 flex items-baseline justify-between gap-2 flex-wrap">
        <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 truncate">
          {value}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {subtitle && (
        <div className="mt-2 text-xs text-slate-500 leading-snug break-words">
          {subtitle}
        </div>
      )}
    </div>
  );
};
