import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { RelativeValueSpreadPoint, ContractSymbol } from '../../types/market';
import { formatINR } from '../../utils/formatters';

interface SpreadTimeSeriesChartProps {
  spreadSeries: RelativeValueSpreadPoint[];
  pair: [ContractSymbol, ContractSymbol];
  meanSpread: number;
  isCalculable?: boolean;
}

export const SpreadTimeSeriesChart: React.FC<SpreadTimeSeriesChartProps> = ({
  spreadSeries,
  pair,
  meanSpread,
  isCalculable = true
}) => {
  const isMeanValid = isCalculable !== false && spreadSeries.length >= 5;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight font-mono">
            Normalized Spread Series: {pair[0]} − {pair[1]}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Formula: S_t(i,j) = Price_norm,t({pair[0]}) − Price_norm,t({pair[1]})
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-3 h-0.5 bg-amber-600 inline-block" />
            <span>Spread (₹/10g)</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-3 h-0.5 bg-slate-400 stroke-dashed inline-block" />
            <span>Mean: {isMeanValid ? `₹${meanSpread.toFixed(1)}` : 'N/A'}</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full pt-4">
        {spreadSeries.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            No historical data available for this contract pair.
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
                tickLine={false}
                tickFormatter={(v: number) => `₹${Math.round(v)}`}
                width={65}
              />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1.5} />
              {isMeanValid && (
                <ReferenceLine
                  y={meanSpread}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{ value: `Mean: ₹${meanSpread.toFixed(1)}`, position: 'right', fill: '#64748b', fontSize: 10 }}
                />
              )}
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
                            <span className="text-slate-400">{pair[0]} Norm:</span>
                            <span className="font-bold">{formatINR(data.priceA)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">{pair[1]} Norm:</span>
                            <span className="font-bold">{formatINR(data.priceB)}</span>
                          </div>
                          <div className="flex justify-between gap-4 pt-1 border-t border-slate-800 text-amber-400 font-bold">
                            <span>Spread (S_t):</span>
                            <span>{formatINR(data.spread)} ({data.spreadPercentage > 0 ? '+' : ''}{data.spreadPercentage}%)</span>
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
                dataKey="spread"
                stroke="#d97706"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: '#b45309' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
