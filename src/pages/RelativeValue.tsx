import React, { useState, useMemo } from 'react';
import { 
  NormalizedObservation, 
  ContractSymbol, 
  RelativeValueSpreadPoint 
} from '../types/market';
import { CONTRACT_SPECIFICATIONS } from '../data/contracts';
import { buildPairSpreadSeries, calculateZScore } from '../engines/relativeValueEngine';
import { SpreadTimeSeriesChart } from '../components/charts/SpreadTimeSeriesChart';
import { ZScoreBandsChart } from '../components/charts/ZScoreBandsChart';
import { MetricCard } from '../components/cards/MetricCard';
import { formatINR } from '../utils/formatters';
import { 
  GitCompare, 
  ArrowRight, 
  AlertTriangle, 
  Layers, 
  Info,
  Calendar,
  Sliders
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface RelativeValuePageProps {
  observations: NormalizedObservation[];
  selectedPair: [ContractSymbol, ContractSymbol];
  onPairChange: (pair: [ContractSymbol, ContractSymbol]) => void;
  onNavigate: (page: any) => void;
}

export const RelativeValue: React.FC<RelativeValuePageProps> = ({
  observations,
  selectedPair,
  onPairChange,
  onNavigate
}) => {
  const allSymbols: ContractSymbol[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'];

  // Rolling window state (Phase 2D: 10d, 20d, 30d)
  const [rollingWindow, setRollingWindow] = useState<number>(20);

  // Filter series for Leg A and Leg B
  const seriesA = useMemo(() => {
    return observations.filter(o => o.symbol === selectedPair[0]);
  }, [observations, selectedPair]);

  const seriesB = useMemo(() => {
    return observations.filter(o => o.symbol === selectedPair[1]);
  }, [observations, selectedPair]);

  // Build aligned spread series dynamically
  const spreadSeries = useMemo(() => {
    return buildPairSpreadSeries(seriesA, seriesB, selectedPair[0], selectedPair[1]);
  }, [seriesA, seriesB, selectedPair]);

  // Compute statistical metrics (Mean, Volatility, Z-Score) with selectable window
  const zScoreAnalysis = useMemo(() => {
    return calculateZScore(spreadSeries, rollingWindow);
  }, [spreadSeries, rollingWindow]);

  const latestSpreadPoint = spreadSeries.length > 0 ? spreadSeries[spreadSeries.length - 1] : null;
  const currentSpread = latestSpreadPoint ? latestSpreadPoint.spread : 0;
  const priceA = latestSpreadPoint ? latestSpreadPoint.priceA : 0;
  const priceB = latestSpreadPoint ? latestSpreadPoint.priceB : 0;
  const currentZScore = zScoreAnalysis.currentZScore;
  const meanSpread = zScoreAnalysis.mean;
  const spreadVolatility = zScoreAnalysis.standardDeviation;

  // Chart data for dual line comparison
  const pairPriceChartData = useMemo(() => {
    return spreadSeries.map(p => ({
      date: p.date,
      [selectedPair[0]]: p.priceA,
      [selectedPair[1]]: p.priceB
    }));
  }, [spreadSeries, selectedPair]);

  return (
    <div className="space-y-6">
      {/* Page Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono">
              Module 03
            </span>
            <span className="text-xs text-slate-500 font-medium">Cross-Contract Basis Analytics</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 font-mono">
            Cross-Contract Relative Value
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Dynamic relative pricing spread:
            <span className="font-mono font-bold text-slate-800 ml-1">
              S_t(i,j) = Price_norm,t(i) − Price_norm,t(j)
            </span>.
            Identifies statistical dislocations between economically identical derivatives.
          </p>
        </div>

        <button
          onClick={() => onNavigate('validation')}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 self-start shadow-sm font-mono"
        >
          <span>Proceed to Validation</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Contract Pair Selectors & Rolling Window Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Legs selector */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">Leg A:</span>
            <select
              value={selectedPair[0]}
              onChange={e => onPairChange([e.target.value as ContractSymbol, selectedPair[1]])}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {allSymbols.map(sym => (
                <option key={sym} value={sym} disabled={sym === selectedPair[1]}>
                  {sym} ({CONTRACT_SPECIFICATIONS[sym].quoteUnitGrams}g quote)
                </option>
              ))}
            </select>
          </div>

          <div className="text-slate-400 font-bold font-mono text-sm">vs</div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">Leg B:</span>
            <select
              value={selectedPair[1]}
              onChange={e => onPairChange([selectedPair[0], e.target.value as ContractSymbol])}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {allSymbols.map(sym => (
                <option key={sym} value={sym} disabled={sym === selectedPair[0]}>
                  {sym} ({CONTRACT_SPECIFICATIONS[sym].quoteUnitGrams}g quote)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Rolling Window selector (10d, 20d, 30d) */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-500 font-sans">Rolling Window:</span>
          {[10, 20, 30].map(w => (
            <button
              key={w}
              onClick={() => setRollingWindow(w)}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${
                rollingWindow === w
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {w}D
            </button>
          ))}
        </div>
      </div>

      {/* 6 Key Metrics Cards as specified in Phase 2D */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <div className="text-[10px] font-mono uppercase text-slate-400">{selectedPair[0]} Norm</div>
          <div className="text-base font-bold font-mono text-slate-900 mt-1">{formatINR(priceA)}</div>
          <div className="text-[10px] text-slate-400">₹ / 10g @ 999</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <div className="text-[10px] font-mono uppercase text-slate-400">{selectedPair[1]} Norm</div>
          <div className="text-base font-bold font-mono text-slate-900 mt-1">{formatINR(priceB)}</div>
          <div className="text-[10px] text-slate-400">₹ / 10g @ 999</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <div className="text-[10px] font-mono uppercase text-slate-400">Current Spread</div>
          <div className="text-base font-bold font-mono text-amber-700 mt-1">{formatINR(currentSpread)}</div>
          <div className="text-[10px] text-slate-400">S_t(i,j)</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <div className="text-[10px] font-mono uppercase text-slate-400">Mean Spread (μ)</div>
          <div className="text-base font-bold font-mono text-slate-700 mt-1">{formatINR(meanSpread)}</div>
          <div className="text-[10px] text-slate-400">{rollingWindow}D Rolling Mean</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <div className="text-[10px] font-mono uppercase text-slate-400">Volatility (σ)</div>
          <div className="text-base font-bold font-mono text-slate-700 mt-1">₹{spreadVolatility.toFixed(2)}</div>
          <div className="text-[10px] text-slate-400">Spread Dispersion</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <div className="text-[10px] font-mono uppercase text-slate-400">Z-Score</div>
          <div className="text-base font-bold font-mono text-slate-900 mt-1">
            {currentZScore > 0 ? '+' : ''}{currentZScore.toFixed(2)} σ
          </div>
          <div className={`text-[10px] font-bold ${Math.abs(currentZScore) >= 1.5 ? 'text-amber-600' : 'text-slate-400'}`}>
            {Math.abs(currentZScore) >= 1.5 ? 'RELATIVE-VALUE ANOMALY' : 'Normal Range'}
          </div>
        </div>
      </div>

      {/* Chart 1: Normalized Price Comparison for Pair */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-mono tracking-tight">
              1. Normalized Price Comparison: {selectedPair[0]} vs {selectedPair[1]}
            </h3>
            <p className="text-xs text-slate-500">
              Both contracts evaluated on ₹ / 10g @ 999 standard benchmark
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">{spreadSeries.length} Sessions</span>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pairPriceChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={s => s.slice(5)} />
              <YAxis stroke="#94a3b8" fontSize={11} domain={['auto', 'auto']} tickLine={false} tickFormatter={v => `₹${Math.round(v)}`} width={70} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs font-mono shadow-xl border border-slate-800">
                        <div className="text-amber-400 font-bold border-b border-slate-800 pb-1 mb-1">{label}</div>
                        {payload.map((p: any) => (
                          <div key={p.name} className="flex justify-between gap-4">
                            <span style={{ color: p.color }}>{p.name}:</span>
                            <span className="font-bold">{formatINR(p.value)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey={selectedPair[0]} stroke="#d97706" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey={selectedPair[1]} stroke="#0284c7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Relative Spread */}
      <SpreadTimeSeriesChart
        spreadSeries={spreadSeries}
        pair={selectedPair}
        meanSpread={meanSpread}
      />

      {/* Chart 3: Rolling Z-Score with Threshold Markers (+2σ, +1.5σ, 0, -1.5σ, -2σ) */}
      <ZScoreBandsChart
        spreadSeries={spreadSeries}
        pair={selectedPair}
        currentZScore={currentZScore}
      />

      {/* Important Quantitative Honesty Callout as mandated by Phase 2D */}
      <div className="bg-amber-50/60 border border-amber-300 rounded-xl p-4.5 text-xs text-amber-950 space-y-1.5">
        <div className="flex items-center gap-2 font-bold font-mono uppercase text-amber-900 tracking-wider">
          <AlertTriangle className="w-4 h-4 text-amber-700" />
          Quantitative Positioning: Relative-Value Anomaly (Not Guaranteed Arbitrage)
        </div>
        <p className="leading-relaxed text-amber-900 font-medium italic">
          “An observed spread is not actionable until liquidity and execution costs are considered.”
        </p>
        <p className="leading-relaxed text-slate-700 pt-0.5">
          A statistical spread dislocation between {selectedPair[0]} and {selectedPair[1]} indicates a relative pricing discrepancy. However, physical delivery parameters, carry financing differentials, and market friction (slippage, STT, and order-book depth) can easily consume this edge. AUREX only classifies an anomaly as ACTIONABLE when it survives the subsequent cost and liquidity filters.
        </p>
      </div>
    </div>
  );
};
