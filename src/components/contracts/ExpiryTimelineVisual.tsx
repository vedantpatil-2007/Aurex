import React from 'react';
import { NormalizedObservation, ContractSymbol } from '../../types/market';
import { CONTRACT_SPECIFICATIONS } from '../../data/contracts';
import { calculateLiquidityScore, evaluateLiquidityGrade } from '../../engines/liquidityCostEngine';
import { Clock, AlertTriangle, ShieldCheck, Calendar, ArrowRight } from 'lucide-react';

interface ExpiryTimelineVisualProps {
  observations: Record<ContractSymbol, NormalizedObservation>;
  selectedSymbol: ContractSymbol;
  onSelectContract: (sym: ContractSymbol) => void;
}

export const ExpiryTimelineVisual: React.FC<ExpiryTimelineVisualProps> = ({
  observations,
  selectedSymbol,
  onSelectContract
}) => {
  const symbols: ContractSymbol[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'];

  // Benchmark maximum days to calculate relative progress bar
  const maxDays = 45;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900 font-mono tracking-tight">
              Discrete Contract Lifecycle & Expiry Horizon
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Discrete settlement tracking prevents artificial price jumps from synthetic near-month stitching.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className="text-slate-600">NORMAL (&gt;15d)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span className="text-slate-600">NEAR EXPIRY (6–15d)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span className="text-slate-600">ROLL WINDOW (≤5d)</span>
          </div>
        </div>
      </div>

      {/* Visual Timeline Rows */}
      <div className="space-y-3 pt-1">
        {symbols.map(sym => {
          const obs = observations[sym];
          const spec = CONTRACT_SPECIFICATIONS[sym];
          if (!obs) return null;

          const isSelected = selectedSymbol === sym;
          const days = obs.daysToExpiry;

          // Lifecycle badge
          let stageLabel = 'NORMAL';
          let stageBg = 'bg-emerald-100 text-emerald-800 border-emerald-200';
          let markerColor = 'bg-emerald-500 border-emerald-600';
          let progressBg = 'bg-emerald-500';

          if (days <= 5) {
            stageLabel = 'ROLL WINDOW';
            stageBg = 'bg-rose-100 text-rose-800 border-rose-200';
            markerColor = 'bg-rose-500 border-rose-600';
            progressBg = 'bg-rose-500';
          } else if (days <= 15) {
            stageLabel = 'NEAR EXPIRY';
            stageBg = 'bg-amber-100 text-amber-800 border-amber-200';
            markerColor = 'bg-amber-500 border-amber-600';
            progressBg = 'bg-amber-500';
          }

          // Compute single-contract liquidity proxy score
          const liqScore = calculateLiquidityScore(obs.volume, obs.openInterest, obs.volume, obs.openInterest);
          const liqGrade = evaluateLiquidityGrade(liqScore, 50);

          // Position percent
          const progressPercent = Math.min(100, Math.max(10, Math.round((days / maxDays) * 100)));

          return (
            <div
              key={sym}
              onClick={() => onSelectContract(sym)}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-amber-50/60 border-amber-400 shadow-sm'
                  : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                {/* Contract Meta & Label */}
                <div className="flex items-center gap-3 w-48 shrink-0">
                  <div className="font-mono font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    {sym}
                    {isSelected && (
                      <span className="text-[10px] font-sans font-bold bg-amber-500 text-slate-950 px-1 rounded uppercase">
                        Active
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${stageBg}`}>
                    {stageLabel}
                  </span>
                </div>

                {/* Timeline Bar Visual */}
                <div className="flex-1 mx-2 flex items-center gap-2">
                  <div className="flex-1 relative h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${progressBg} rounded-full transition-all`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="w-24 text-right font-mono text-xs font-bold text-slate-800 shrink-0">
                    {days} days left
                  </div>
                </div>

                {/* Quick Expiry Date & Liquidity */}
                <div className="flex items-center gap-3 shrink-0 text-xs font-mono text-slate-600">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-sans uppercase">Expiry Date</div>
                    <div className="font-semibold text-slate-800">{obs.expiryDate}</div>
                  </div>
                  <div className="text-right border-l border-slate-200 pl-3">
                    <div className="text-[10px] text-slate-400 font-sans uppercase">Liquidity</div>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      liqGrade === 'PASS' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : liqGrade === 'BORDERLINE' 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {liqGrade} ({liqScore})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
