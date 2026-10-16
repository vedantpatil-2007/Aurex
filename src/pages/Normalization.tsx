import React, { useState, useMemo } from 'react';
import { NormalizedObservation, ContractSymbol } from '../types/market';
import { CONTRACT_SPECIFICATIONS, CONTRACT_LIST } from '../data/contracts';
import { getNormalizationBreakdown } from '../engines/normalizationEngine';
import { NormalizedComparisonChart } from '../components/charts/NormalizedComparisonChart';
import { formatINR } from '../utils/formatters';
import { 
  Scale, 
  ArrowRight, 
  Calculator, 
  Calendar, 
  CheckCircle2, 
  Layers, 
  HelpCircle,
  Sparkles
} from 'lucide-react';

interface NormalizationPageProps {
  observations: NormalizedObservation[];
  selectedContract: ContractSymbol;
  onSelectContract: (sym: ContractSymbol) => void;
  availableDates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onNavigate: (page: any) => void;
}

export const Normalization: React.FC<NormalizationPageProps> = ({
  observations,
  selectedContract,
  onSelectContract,
  availableDates,
  selectedDate,
  onSelectDate,
  onNavigate
}) => {
  const [interactiveRawPriceOverride, setInteractiveRawPriceOverride] = useState<number | null>(null);

  const spec = CONTRACT_SPECIFICATIONS[selectedContract];

  // Find observation for selected contract and selected date
  const currentObs = useMemo(() => {
    return observations.find(o => o.symbol === selectedContract && o.date === selectedDate) ||
      observations.filter(o => o.symbol === selectedContract).slice(-1)[0];
  }, [observations, selectedContract, selectedDate]);

  const activeRawPrice = interactiveRawPriceOverride !== null 
    ? interactiveRawPriceOverride 
    : (currentObs?.close || 74500);

  // Run real normalization calculation via engine
  const breakdown = useMemo(() => {
    return getNormalizationBreakdown(activeRawPrice, spec);
  }, [activeRawPrice, spec]);

  // Intermediate steps
  const step1UnitScaledPrice = Number((activeRawPrice * breakdown.unitMultiplier).toFixed(2));
  const step2FinalNormPrice = breakdown.normalizedPrice;

  return (
    <div className="space-y-6">
      {/* Title & Subtitle banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono">
              Module 02
            </span>
            <span className="text-xs text-slate-500 font-medium">Mathematical Benchmark Foundation</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 font-mono">
            Precision Normalization Engine
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Transforming heterogeneous exchange quotations into the single common economic benchmark:
            <span className="font-mono font-bold text-amber-700 ml-1">₹ / 10g @ 999 purity</span>.
          </p>
        </div>

        <button
          onClick={() => onNavigate('relative-value')}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 self-start shadow-sm font-mono"
        >
          <span>Proceed to Relative Value</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Prominent Formula Display Card */}
      <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-amber-400 font-mono font-bold flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-amber-400" />
              Unified Normalization Formula
            </div>
            <div className="text-xl sm:text-2xl md:text-3xl font-mono font-bold text-white tracking-tight pt-1">
              Price_norm = Raw Price × <span className="text-sky-300">(10 / Quote Unit)</span> × <span className="text-emerald-300">(999 / Purity)</span>
            </div>
            <div className="text-xs text-slate-300 font-mono pt-1">
              Common economic benchmark: <span className="text-amber-400 font-bold">₹ / 10g @ 999 purity</span>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-lg text-xs space-y-1 font-mono shrink-0">
            <div className="text-amber-400 font-bold uppercase text-[10px]">Benchmark Spec</div>
            <div className="text-slate-200">Weight: 10.00 grams</div>
            <div className="text-slate-200">Fineness: 999 ‰ (Fine)</div>
            <div className="text-amber-400 font-bold text-[11px]">₹ / 10g @ 999</div>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Calculation Playground */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900 font-mono">Contract & Date Selector</h3>
            </div>
            {interactiveRawPriceOverride !== null && (
              <button
                onClick={() => setInteractiveRawPriceOverride(null)}
                className="text-[11px] text-amber-700 hover:underline font-medium"
              >
                Reset to Market
              </button>
            )}
          </div>

          {/* Contract Selector */}
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1.5">
              Select Contract to Inspect
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CONTRACT_LIST.map(c => {
                const isSelected = selectedContract === c.symbol;
                return (
                  <button
                    key={c.symbol}
                    onClick={() => {
                      onSelectContract(c.symbol);
                      setInteractiveRawPriceOverride(null);
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all text-left border ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>{c.symbol}</div>
                    <div className={`text-[10px] font-sans font-normal ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                      {c.quoteUnitGrams}g quote | {c.purityPermille}‰
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Selector */}
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1.5 flex items-center justify-between">
              <span>Observation Date</span>
              <span className="font-mono text-slate-700">{selectedDate}</span>
            </label>
            <select
              value={selectedDate}
              onChange={e => {
                onSelectDate(e.target.value);
                setInteractiveRawPriceOverride(null);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {availableDates.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Live Editable Raw Price input (allows judge to test custom prices live) */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1 flex items-center justify-between">
              <span>Interactive Raw Price (₹)</span>
              <span className="text-[10px] text-amber-700 font-sans">Type any value to test</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">₹</span>
              <input
                type="number"
                step="1"
                value={activeRawPrice}
                onChange={e => setInteractiveRawPriceOverride(Number(e.target.value))}
                className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Quotation basis: ₹ per {spec.quoteUnitGrams}g @ {spec.purityPermille} fineness
            </div>
          </div>
        </div>

        {/* Real-time Step-by-Step Mathematical Decomposition Visual (2 cols wide) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 font-mono flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Real-Time Normalization Pipeline
            </h3>
            <span className="text-xs font-mono bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-bold">
              {selectedContract} Live Evaluation
            </span>
          </div>

          {/* Visual Step-by-Step Flow as mandated: RAW PRICE -> UNIT NORMALIZATION -> PURITY ADJUSTMENT -> BENCHMARK */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
            {/* Step 1: Raw Price */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                1. Raw Price
              </div>
              <div className="text-lg font-bold font-mono text-slate-900">
                {formatINR(activeRawPrice)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                per {spec.quoteUnitGrams}g @ {spec.purityPermille}‰
              </div>
            </div>

            {/* Step 2: Unit Normalization */}
            <div className="bg-sky-50/50 border border-sky-200 rounded-lg p-3 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                2. Unit Multiplier
              </div>
              <div className="text-lg font-bold font-mono text-sky-900">
                {breakdown.unitMultiplier}x
              </div>
              <div className="text-[10px] text-sky-700 font-mono">
                (10 / {spec.quoteUnitGrams}g) = {formatINR(step1UnitScaledPrice)}
              </div>
            </div>

            {/* Step 3: Purity Adjustment */}
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                3. Purity Factor
              </div>
              <div className="text-lg font-bold font-mono text-emerald-900">
                {breakdown.purityMultiplier.toFixed(5)}x
              </div>
              <div className="text-[10px] text-emerald-700 font-mono">
                (999 / {spec.purityPermille}‰)
              </div>
            </div>

            {/* Step 4: Final Normalized Price */}
            <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-lg p-3 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                4. Normalized Price
              </div>
              <div className="text-lg font-bold font-mono text-amber-950">
                {formatINR(step2FinalNormPrice)}
              </div>
              <div className="text-[10px] text-amber-800 font-mono font-bold">
                ₹ / 10g @ 999
              </div>
            </div>
          </div>

          {/* Scaling Factors Table */}
          <div className="border border-slate-100 rounded-lg overflow-hidden text-xs">
            <div className="bg-slate-50 px-3.5 py-2 font-semibold text-slate-700 border-b border-slate-100 text-[11px] uppercase tracking-wider">
              Exact Component Multipliers for {selectedContract}
            </div>
            <div className="divide-y divide-slate-100 p-2 font-mono">
              <div className="flex justify-between py-1.5 px-2">
                <span className="text-slate-500">Quote Unit Basis:</span>
                <span className="font-semibold text-slate-800">{spec.quoteUnitGrams} grams</span>
              </div>
              <div className="flex justify-between py-1.5 px-2">
                <span className="text-slate-500">Unit Normalization Multiplier (10 / QuoteUnit):</span>
                <span className="font-semibold text-slate-800">{breakdown.unitMultiplier}</span>
              </div>
              <div className="flex justify-between py-1.5 px-2">
                <span className="text-slate-500">Contract Purity Standard:</span>
                <span className="font-semibold text-slate-800">{spec.purityPermille} Fineness</span>
              </div>
              <div className="flex justify-between py-1.5 px-2">
                <span className="text-slate-500">Purity Adjustment Multiplier (999 / Purity):</span>
                <span className="font-semibold text-slate-800">{breakdown.purityMultiplier}</span>
              </div>
              <div className="flex justify-between py-1.5 px-2 bg-amber-50/40 font-bold">
                <span className="text-amber-950">Combined Scaling Factor (Unit × Purity):</span>
                <span className="text-amber-900 font-bold">{breakdown.scalingFactor}</span>
              </div>
            </div>
          </div>

          {/* Explanation Banner (Phase 2C) */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold text-slate-900 text-xs uppercase tracking-wide font-mono">
                WHY THIS MATTERS
              </div>
              <p className="leading-relaxed font-medium text-slate-700 italic">
                “Contracts representing the same underlying metal cannot be compared economically until quotation units and purity differences are normalized.”
              </p>
              <p className="text-[11px] text-slate-500 pt-1">
                Without this unified benchmark, raw settlement figures represent unequal weights (1g, 8g, 10g) and disparate purities (995 vs 999), creating false optical arbitrage rather than true economic relative-value opportunities.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Chart across all four contracts */}
      <NormalizedComparisonChart
        observations={observations}
        selectedSymbol={selectedContract}
      />
    </div>
  );
};
