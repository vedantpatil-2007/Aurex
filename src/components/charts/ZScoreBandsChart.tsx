import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { RelativeValueSpreadPoint, ContractSymbol } from '../../types/market';

interface ZScoreBandsChartProps {
  spreadSeries: RelativeValueSpreadPoint[];
  pair: [ContractSymbol, ContractSymbol];
  currentZScore: number;
  isCalculable?: boolean;
  incalculableReason?: string;
}

export const ZScoreBandsChart: React.FC<ZScoreBandsChartProps> = ({
  spreadSeries,
  pair,
  currentZScore,
  isCalculable = true,
  incalculableReason
}) => {
  const isZScoreValid = isCalculable !== false && spreadSeries.length >= 5;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight font-mono">
            Statistical Spread Dislocation (Rolling 20-Day Z-Score)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Z = (Spread − μ) / σ. Dislocation thresholds at ±1.5σ and ±2.0σ
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-500 font-sans">Current Z-Score:</span>
          {isZScoreValid ? (
            <span className={`px-2 py-0.5 rounded font-bold ${
              Math.abs(currentZScore) >= 1.5
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-slate-100 text-slate-800'
            }`}>
              {currentZScore > 0 ? '+' : ''}{currentZScore.toFixed(2)} σ
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300">
              N/A
            </span>
          )}
        </div>
      </div>

      <div className="h-60 w-full pt-4">
        {!isZScoreValid ? (
          <div className="h-full flex flex-col items-center justify-center text-xs text-slate-600 bg-slate-50 border border-dashed border-slate-200 rounded-lg p-6 text-center space-y-1.5">
            <div className="font-mono font-bold text-amber-900">
              {incalculableReason || 'Insufficient observations to calculate rolling Z-score'}
            </div>
            <p className="max-w-md text-slate-500 text-[11px] leading-relaxed">
              Rolling Z-score dispersion bands require at least 5 single-provenance trading sessions ({spreadSeries.length} session available; shortfall: {Math.max(0, 5 - spreadSeries.length)} session{Math.max(0, 5 - spreadSeries.length) === 1 ? '' : 's'}). Single-day observations cannot establish a statistical distribution.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spreadSeries} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                tickFormatter={(str: string) => str.slice(5)}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                domain={[-3, 3]}
                ticks={[-2, -1.5, 0, 1.5, 2]}
                tickLine={false}
                tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}σ`}
                width={50}
              />
              {/* Threshold lines */}
              <ReferenceLine y={2.0} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: '+2.0σ Threshold', position: 'right', fill: '#f43f5e', fontSize: 10 }} />
              <ReferenceLine y={1.5} stroke="#f59e0b" strokeDasharray="2 2" />
              <ReferenceLine y={0.0} stroke="#94a3b8" strokeWidth={1} />
              <ReferenceLine y={-1.5} stroke="#f59e0b" strokeDasharray="2 2" />
              <ReferenceLine y={-2.0} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: '−2.0σ Threshold', position: 'right', fill: '#f43f5e', fontSize: 10 }} />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as RelativeValueSpreadPoint;
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs border border-slate-800 font-mono">
                        <div className="font-bold text-amber-400 border-b border-slate-800 pb-1 mb-1.5">
                          {label}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Spread:</span>
                            <span className="font-bold">₹{data.spread}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Rolling Mean (μ):</span>
                            <span>₹{data.meanSpread}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Rolling Vol (σ):</span>
                            <span>₹{data.stdDevSpread}</span>
                          </div>
                          <div className="flex justify-between gap-4 pt-1 border-t border-slate-800 font-bold text-amber-400">
                            <span>Z-Score:</span>
                            <span>{data.zScore !== undefined && data.zScore > 0 ? '+' : ''}{data.zScore} σ</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="zScore"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: '#1d4ed8' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
