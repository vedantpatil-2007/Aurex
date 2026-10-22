import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import { NormalizedObservation, ContractSymbol } from '../../types/market';
import { selectActiveObservation } from '../../engines/relativeValueEngine';
import { formatINR } from '../../utils/formatters';
import { Info } from 'lucide-react';

interface NormalizedComparisonChartProps {
  observations: NormalizedObservation[];
  selectedSymbol?: ContractSymbol;
}

export const NormalizedComparisonChart: React.FC<NormalizedComparisonChartProps> = ({
  observations,
  selectedSymbol
}) => {
  // Transform observations into aligned time series with active near-month contract selection
  const chartData = useMemo(() => {
    const dateSymbolMap = new Map<string, Map<ContractSymbol, NormalizedObservation[]>>();

    for (const obs of observations) {
      if (!dateSymbolMap.has(obs.date)) {
        dateSymbolMap.set(obs.date, new Map());
      }
      const symMap = dateSymbolMap.get(obs.date)!;
      const list = symMap.get(obs.symbol) || [];
      list.push(obs);
      symMap.set(obs.symbol, list);
    }

    const arr: any[] = [];
    for (const [date, symMap] of dateSymbolMap.entries()) {
      const entry: any = { date, _provenance: 'PROTOTYPE SIMULATION', _expiries: {} };
      for (const [sym, obsList] of symMap.entries()) {
        const activeObs = selectActiveObservation(obsList);
        if (activeObs) {
          entry[sym] = activeObs.normalizedPrice;
          entry._expiries[sym] = activeObs.expiryDate;
          if (activeObs.provenance) {
            entry._provenance = activeObs.provenance;
          }
        }
      }
      arr.push(entry);
    }

    arr.sort((a, b) => a.date.localeCompare(b.date));
    return arr;
  }, [observations]);

  // Detect data-source boundary between prototype simulation and user-imported observations
  const boundaryDate = useMemo(() => {
    let lastSimDate = '';
    for (const d of chartData) {
      if (d._provenance === 'PROTOTYPE SIMULATION' || d.date <= '2026-10-08') {
        lastSimDate = d.date;
      } else if (lastSimDate && (d._provenance !== 'PROTOTYPE SIMULATION' || d.date > '2026-10-08')) {
        return d.date;
      }
    }
    return null;
  }, [chartData]);

  // Color mappings
  const contractColors: Record<ContractSymbol, string> = {
    GOLDM: '#d97706',      // Primary Gold / Amber
    GOLDTEN: '#0284c7',    // Sky blue
    GOLDGUINEA: '#10b981', // Emerald green
    GOLDPETAL: '#8b5cf6'   // Purple
  };

  // Find min and max for sensible y-axis domain
  const yDomain = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const d of chartData) {
      for (const sym of ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL']) {
        if (d[sym]) {
          if (d[sym] < min) min = d[sym];
          if (d[sym] > max) max = d[sym];
        }
      }
    }
    if (min === Infinity) return [70000, 80000];
    return [Math.floor(min - 200), Math.ceil(max + 200)];
  }, [chartData]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight font-mono">
            Normalized Contract Prices (₹ / 10g @ 999 Fineness)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Unified analytical benchmark: eliminates quote-unit scale and fineness discrepancy
          </p>
        </div>
        <div className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
          {chartData.length} Trading Sessions
        </div>
      </div>

      <div className="h-72 w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              tickFormatter={(str: string) => str.slice(5)} // MM-DD
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              domain={yDomain}
              tickLine={false}
              tickFormatter={(v: number) => `₹${Math.round(v)}`}
              width={75}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs border border-slate-800 font-mono">
                      <div className="font-bold text-amber-400 mb-1.5 border-b border-slate-800 pb-1">
                        Date: {label}
                      </div>
                      <div className="space-y-1">
                        {payload.map((entry: any) => (
                          <div key={entry.name} className="flex items-center justify-between gap-4">
                            <span style={{ color: entry.color }} className="font-semibold">
                              {entry.name}:
                            </span>
                            <span className="text-slate-100 font-bold">
                              {formatINR(entry.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
              formatter={(value: string) => {
                const isSel = selectedSymbol === value;
                return (
                  <span className={`font-mono ${isSel ? 'font-bold text-amber-900 underline' : 'text-slate-600'}`}>
                    {value} {isSel ? '(Selected)' : ''}
                  </span>
                );
              }}
            />
            {boundaryDate && (
              <ReferenceLine
                x={boundaryDate}
                stroke="#d97706"
                strokeDasharray="4 4"
                label={{
                  value: 'Data-Source Boundary (Sim → Imported)',
                  fill: '#b45309',
                  fontSize: 10,
                  position: 'insideTopLeft'
                }}
              />
            )}
            {(['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'] as ContractSymbol[]).map(sym => {
              const isSelected = selectedSymbol === sym;
              return (
                <Line
                  key={sym}
                  type="monotone"
                  dataKey={sym}
                  stroke={contractColors[sym]}
                  strokeWidth={isSelected ? 3 : 1.5}
                  strokeOpacity={selectedSymbol && !isSelected ? 0.6 : 1}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {boundaryDate && (
        <div className="mt-3 p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-amber-900 font-mono">Data-source boundary:</span> Prototype simulation observations transition to user-imported observations dated {boundaryDate}. The imported source has not been independently verified, and price continuity between the datasets has not been established. Active near-month expiries are selected for consistent cross-contract comparison.
          </div>
        </div>
      )}
    </div>
  );
};
