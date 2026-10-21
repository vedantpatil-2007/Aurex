import React, { useState, useMemo } from 'react';
import {
  ContractSymbol,
  NormalizedObservation
} from '../../types/market';
import {
  buildFuturesCurve,
  interpolateConstantMaturity,
  decomposeRollDownAndCurveShift
} from '../../engines/termStructureEngine';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  Clock,
  ArrowRight,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  Activity
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface FuturesCurveCardProps {
  observations: NormalizedObservation[];
  availableDates: string[];
  selectedDate: string;
  onDateChange?: (date: string) => void;
}

export const FuturesCurveCard: React.FC<FuturesCurveCardProps> = ({
  observations,
  availableDates,
  selectedDate,
  onDateChange
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<ContractSymbol>('GOLDM');
  const [targetTenor, setTargetTenor] = useState<number>(30);

  // Build curve for selected date
  const curve = useMemo(() => {
    return buildFuturesCurve(observations, selectedDate, selectedSymbol);
  }, [observations, selectedDate, selectedSymbol]);

  // Previous date curve for roll-down decomposition
  const previousDate = useMemo(() => {
    const idx = availableDates.indexOf(selectedDate);
    return idx > 0 ? availableDates[idx - 1] : undefined;
  }, [availableDates, selectedDate]);

  const curvePrev = useMemo(() => {
    if (!previousDate) return null;
    return buildFuturesCurve(observations, previousDate, selectedSymbol);
  }, [observations, previousDate, selectedSymbol]);

  // Constant maturity interpolation
  const constantMaturity7 = useMemo(() => interpolateConstantMaturity(curve, 7), [curve]);
  const constantMaturity14 = useMemo(() => interpolateConstantMaturity(curve, 14), [curve]);
  const constantMaturity30 = useMemo(() => interpolateConstantMaturity(curve, 30), [curve]);
  const constantMaturity60 = useMemo(() => interpolateConstantMaturity(curve, 60), [curve]);

  // Roll-down decomposition
  const rollDownDecomp = useMemo(() => {
    if (!curvePrev) return null;
    return decomposeRollDownAndCurveShift(curve, curvePrev, targetTenor, 1);
  }, [curve, curvePrev, targetTenor]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return curve.points.map(p => ({
      expiryDate: p.expiryDate,
      daysToExpiry: p.daysToExpiry,
      label: `${p.daysToExpiry}d (${p.expiryDate})`,
      normalizedPrice: p.normalizedPrice,
      rawPrice: p.rawPrice,
      volume: p.volume,
      openInterest: p.openInterest
    }));
  }, [curve]);

  const symbols: ContractSymbol[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-900 border border-amber-500/30">
              Workstream 2
            </span>
            <span className="text-xs text-slate-500 font-mono">MCX Bullion Term Structure</span>
          </div>
          <h3 className="text-base font-bold font-mono text-slate-900 mt-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            Futures Curve & Implied Carry Lab
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Analyzes verified discrete contract expiries for the same underlying metal on date {selectedDate}.
          </p>
        </div>

        {/* Contract & Date Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Symbol Pills */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            {symbols.map(sym => (
              <button
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded-md transition-all ${
                  selectedSymbol === sym
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>

          {/* Date Picker */}
          {onDateChange && availableDates.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedDate}
                onChange={e => onDateChange(e.target.value)}
                className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
              >
                {availableDates.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Term Structure Visual & Metrics */}
      {curve.points.length === 0 ? (
        <div className="bg-slate-50 rounded-lg p-8 text-center text-xs text-slate-500 border border-slate-200">
          <Info className="w-6 h-6 text-slate-400 mx-auto mb-2" />
          No discrete expiry observations recorded for {selectedSymbol} on {selectedDate}.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Implied Carry Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Observed Curve Expiries</div>
              <div className="text-lg font-bold font-mono text-slate-900">
                {curve.points.length} Expir{curve.points.length === 1 ? 'y' : 'ies'}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                Near: {curve.nearPoint?.expiryDate} ({curve.nearPoint?.daysToExpiry}d)
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Near / Far Spread</div>
              <div className="text-lg font-bold font-mono text-amber-800">
                {curve.spreadNearFar !== undefined ? `+₹${curve.spreadNearFar}/10g` : 'N/A (Single Expiry)'}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                {curve.spreadNearFarPct !== undefined ? `+${curve.spreadNearFarPct}% over ${curve.daysBetweenExpiries} days` : 'Need 2+ expiries'}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Annualized Simple Carry</div>
              <div className="text-lg font-bold font-mono text-emerald-800">
                {curve.annualizedSimpleCarry !== undefined ? `${curve.annualizedSimpleCarry}% p.a.` : 'N/A'}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                Basis: 100 × (Far/Near - 1) × (365/ΔD)
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Continuously Compounded Carry</div>
              <div className="text-lg font-bold font-mono text-emerald-900">
                {curve.annualizedCompoundedCarry !== undefined ? `${curve.annualizedCompoundedCarry}% p.a.` : 'N/A'}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                Basis: 100 × ln(Far/Near) × (365/ΔD)
              </div>
            </div>
          </div>

          {/* Futures Curve Chart */}
          <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200/60">
              <span className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-amber-600" />
                {selectedSymbol} Normalized Futures Curve (₹ / 10g @ 999 Fineness)
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                X-Axis: Days to Expiry (DTE)
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickFormatter={(v) => `₹${Math.round(v).toLocaleString('en-IN')}`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Normalized Price']}
                    labelFormatter={(label) => `Contract Expiry: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="normalizedPrice"
                    stroke="#d97706"
                    strokeWidth={2.5}
                    dot={{ fill: '#d97706', r: 5, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7 }}
                    name="Normalized Price"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Expiry Breakdown Table & Constant Maturity References */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Table of observed discrete points */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3.5 py-2 font-mono font-bold text-xs text-slate-700 border-b border-slate-200 flex items-center justify-between">
                <span>Discrete Observed Expiries</span>
                <span className="text-[11px] text-slate-500 font-sans">{selectedDate}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Expiry</th>
                      <th className="py-2 px-3 text-right">DTE</th>
                      <th className="py-2 px-3 text-right">Raw Price</th>
                      <th className="py-2 px-3 text-right">Normalized</th>
                      <th className="py-2 px-3 text-right">Adj Spread</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {curve.points.map((p, idx) => (
                      <tr key={p.expiryDate} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 font-bold text-slate-900">{p.expiryDate}</td>
                        <td className="py-2 px-3 text-right text-slate-600">{p.daysToExpiry}d</td>
                        <td className="py-2 px-3 text-right text-slate-700">{formatINR(p.rawPrice)}</td>
                        <td className="py-2 px-3 text-right font-bold text-amber-900">{formatINR(p.normalizedPrice)}</td>
                        <td className="py-2 px-3 text-right text-slate-600">
                          {p.adjacentSpread !== undefined ? `+${formatINR(p.adjacentSpread)}` : '— (Near)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Constant Maturity Interpolations & Roll-Down */}
            <div className="border border-slate-200 rounded-lg overflow-hidden space-y-3 p-3.5 bg-slate-50/40">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-mono font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  Constant-Maturity References (Linear Interpolation)
                </span>
                <span className="text-[10px] text-slate-400 font-sans">Zero Extrapolation</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                <div className="bg-white border border-slate-200 rounded p-2">
                  <div className="text-[10px] text-slate-500">7-Day Tenor</div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">
                    {constantMaturity7.status === 'VALID' ? formatINR(constantMaturity7.interpolatedPrice) : 'Out of range'}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded p-2">
                  <div className="text-[10px] text-slate-500">14-Day Tenor</div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">
                    {constantMaturity14.status === 'VALID' ? formatINR(constantMaturity14.interpolatedPrice) : 'Out of range'}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded p-2">
                  <div className="text-[10px] text-slate-500">30-Day Tenor</div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">
                    {constantMaturity30.status === 'VALID' ? formatINR(constantMaturity30.interpolatedPrice) : 'Out of range'}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded p-2">
                  <div className="text-[10px] text-slate-500">60-Day Tenor</div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">
                    {constantMaturity60.status === 'VALID' ? formatINR(constantMaturity60.interpolatedPrice) : 'Out of range'}
                  </div>
                </div>
              </div>

              {/* Roll-Down vs Curve Movement Decomposition */}
              {rollDownDecomp && (
                <div className="bg-white border border-amber-200 rounded-lg p-3 text-xs space-y-2 mt-2">
                  <div className="font-mono font-bold text-slate-900 flex items-center justify-between">
                    <span className="text-amber-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Roll-Down Decomposition ({targetTenor}D Constant Tenor)
                    </span>
                    <span className="text-[10px] text-slate-500">{rollDownDecomp.datePrevious} â†’ {rollDownDecomp.dateCurrent}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center font-mono pt-1">
                    <div className="bg-slate-50 p-1.5 rounded">
                      <div className="text-[10px] text-slate-400">Total Change</div>
                      <div className="text-xs font-bold text-slate-800">{formatINR(rollDownDecomp.totalChange)}</div>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded">
                      <div className="text-[10px] text-slate-400">Mechanical Roll</div>
                      <div className="text-xs font-bold text-sky-800">{formatINR(rollDownDecomp.mechanicalRollDown)}</div>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded">
                      <div className="text-[10px] text-slate-400">Curve Repricing</div>
                      <div className="text-xs font-bold text-amber-800">{formatINR(rollDownDecomp.curveShift)}</div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 italic leading-relaxed pt-1 border-t border-slate-100">
                    {rollDownDecomp.explanation}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quantitative Carry Honesty Disclosure */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold font-mono text-[11px] uppercase tracking-wider text-amber-900">
                Quantitative Honesty Principle: Implied Carry vs Investment Return
              </div>
              <p className="leading-relaxed text-slate-700">
                The calculated carry represents the <strong>annualized implied futures basis</strong> between discrete expiries.
                It incorporates financing interest rates, warehouse storage, insurance, and convenience yield. It does NOT guarantee
                arbitrage returns without accounting for physical delivery logistics and exchange margin financing.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
