import React from 'react';
import { CostWaterfallBreakdown } from '../../types/market';
import { formatINR } from '../../utils/formatters';
import { ArrowDown, DollarSign, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';

interface CostWaterfallChartProps {
  waterfall: CostWaterfallBreakdown;
}

export const CostWaterfallChart: React.FC<CostWaterfallChartProps> = ({ waterfall }) => {
  const {
    theoreticalEdge,
    slippage,
    brokerageTaxes,
    liquidityHaircut,
    safetyBuffer,
    totalFriction,
    netDefensibleEdge
  } = waterfall;

  const isNetEdgePositive = netDefensibleEdge > 0;

  // Max value to scale bar widths proportionally
  const maxBarValue = Math.max(theoreticalEdge, totalFriction, 100);

  const steps = [
    {
      label: 'Theoretical Gross Edge',
      value: theoreticalEdge,
      sign: '+',
      type: 'edge',
      color: 'bg-amber-500',
      textColor: 'text-amber-950',
      desc: 'Raw cross-contract normalized basis deviation'
    },
    {
      label: 'Bid-Ask Slippage',
      value: slippage,
      sign: '−',
      type: 'friction',
      color: 'bg-rose-400',
      textColor: 'text-rose-700',
      desc: 'Estimated price impact on pair market orders'
    },
    {
      label: 'Brokerage & Regulatory Taxes',
      value: brokerageTaxes,
      sign: '−',
      type: 'friction',
      color: 'bg-rose-400',
      textColor: 'text-rose-700',
      desc: 'Exchange turnover fee, STT, SEBI fees & GST'
    },
    {
      label: 'Liquidity Haircut',
      value: liquidityHaircut,
      sign: '−',
      type: 'friction',
      color: 'bg-rose-500',
      textColor: 'text-rose-700',
      desc: 'Penalty for execution across thinner-leg order books'
    },
    {
      label: 'Safety Buffer',
      value: safetyBuffer,
      sign: '−',
      type: 'friction',
      color: 'bg-rose-600',
      textColor: 'text-rose-700',
      desc: 'Quantitative margin of error hurdle'
    },
    {
      label: 'Net Defensible Edge',
      value: netDefensibleEdge,
      sign: isNetEdgePositive ? '+' : '',
      type: 'result',
      color: isNetEdgePositive ? 'bg-emerald-600' : 'bg-rose-600',
      textColor: isNetEdgePositive ? 'text-emerald-700' : 'text-rose-700',
      desc: isNetEdgePositive ? 'Edge that survives all friction costs' : 'Friction exceeds theoretical edge'
    }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 font-mono tracking-tight flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-600" />
            Cost-Friction Decomposition Waterfall
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Sequential subtraction of friction hurdles from the theoretical relative-value edge
          </p>
        </div>
        <div className="text-right font-mono">
          <div className="text-[10px] text-slate-400 uppercase">Total Friction</div>
          <div className="text-xs font-bold text-rose-600">{formatINR(totalFriction)} / 10g</div>
        </div>
      </div>

      {/* Waterfall Visual Bars */}
      <div className="space-y-2.5 pt-1">
        {steps.map((step, idx) => {
          const barWidthPercent = Math.min(100, Math.max(8, Math.round((Math.abs(step.value) / maxBarValue) * 100)));
          const isResult = step.type === 'result';

          return (
            <div
              key={idx}
              className={`p-2.5 rounded-lg border transition-all ${
                isResult
                  ? isNetEdgePositive
                    ? 'bg-emerald-50/60 border-emerald-300'
                    : 'bg-rose-50/60 border-rose-300'
                  : 'bg-slate-50/60 border-slate-200/70'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2 sm:w-64 shrink-0">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${step.color}`}>
                    {step.sign}
                  </span>
                  <div>
                    <span className={`text-xs font-semibold ${isResult ? 'font-mono text-slate-900 font-bold' : 'text-slate-700'}`}>
                      {step.label}
                    </span>
                    <div className="text-[10px] text-slate-400 leading-tight">
                      {step.desc}
                    </div>
                  </div>
                </div>

                {/* Progress bar visual */}
                <div className="flex-1 mx-3 hidden md:flex items-center">
                  <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${step.color} rounded-full transition-all duration-300`}
                      style={{ width: `${barWidthPercent}%` }}
                    />
                  </div>
                </div>

                {/* Numeric value */}
                <div className="text-right font-mono shrink-0">
                  <span className={`text-sm font-bold ${step.textColor}`}>
                    {step.sign}{formatINR(Math.abs(step.value))}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">/ 10g</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Synthesis footer strip */}
      <div className={`p-3 rounded-lg border flex items-center justify-between text-xs font-mono ${
        isNetEdgePositive ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-900 border-slate-800 text-slate-200'
      }`}>
        <div className="flex items-center gap-2">
          {isNetEdgePositive ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>
            {isNetEdgePositive 
              ? `Defensible Edge Confirmed: +${formatINR(netDefensibleEdge)} survives all friction hurdles.`
              : `Capital Preservation Engaged: Hurdle exceeds edge by ${formatINR(Math.abs(netDefensibleEdge))}. NO TRADE verdict.`
            }
          </span>
        </div>
        <span className="font-bold text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/20">
          {isNetEdgePositive ? 'Hurdle Cleared' : 'Shield Active'}
        </span>
      </div>
    </div>
  );
};
