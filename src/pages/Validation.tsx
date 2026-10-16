import React, { useMemo } from 'react';
import { 
  NormalizedObservation, 
  ContractSymbol, 
  FrictionAssumptions 
} from '../types/market';
import { buildPairSpreadSeries } from '../engines/relativeValueEngine';
import { generateWalkForwardWindows } from '../engines/validationEngine';
import { WalkForwardTimelineChart } from '../components/charts/WalkForwardTimelineChart';
import { MetricCard } from '../components/cards/MetricCard';
import { formatINR } from '../utils/formatters';
import { 
  CheckCircle2, 
  ShieldCheck, 
  EyeOff, 
  DollarSign, 
  ArrowRight,
  History,
  Database,
  Cpu,
  Eye,
  Award
} from 'lucide-react';

interface ValidationPageProps {
  observations: NormalizedObservation[];
  selectedPair: [ContractSymbol, ContractSymbol];
  friction: FrictionAssumptions;
  onNavigate: (page: any) => void;
}

export const Validation: React.FC<ValidationPageProps> = ({
  observations,
  selectedPair,
  friction,
  onNavigate
}) => {
  // Aligned spread series
  const seriesA = useMemo(() => observations.filter(o => o.symbol === selectedPair[0]), [observations, selectedPair]);
  const seriesB = useMemo(() => observations.filter(o => o.symbol === selectedPair[1]), [observations, selectedPair]);
  const spreadSeries = useMemo(() => buildPairSpreadSeries(seriesA, seriesB, selectedPair[0], selectedPair[1]), [seriesA, seriesB, selectedPair]);

  // Generate walk-forward out-of-sample windows
  const windows = useMemo(() => {
    return generateWalkForwardWindows(spreadSeries, friction);
  }, [spreadSeries, friction]);

  // Aggregate prototype metrics across windows
  const avgGrossEdge = windows.length > 0 
    ? Number((windows.reduce((acc, w) => acc + w.outOfSampleObservedEdge, 0) / windows.length).toFixed(2))
    : 0;
  
  const estimatedCost = windows.length > 0 ? windows[0].estimatedFriction : 0;
  const avgNetEdge = Number((avgGrossEdge - estimatedCost).toFixed(2));

  return (
    <div className="space-y-6">
      {/* Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono">
              Module 04
            </span>
            <span className="text-xs text-slate-500 font-medium">Quantitative Validation Discipline</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 font-mono">
            Walk-Forward Validation
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Simulated rolling walk-forward test for pair <span className="font-mono font-bold text-slate-900">{selectedPair[0]} / {selectedPair[1]}</span>. Re-calibrates parameters in-sample and evaluates performance strictly on unseen out-of-sample data under cost friction.
          </p>
        </div>

        <button
          onClick={() => onNavigate('decision')}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 self-start shadow-sm font-mono"
        >
          <span>Open Decision Engine</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Visual Walk-Forward Methodology Flow (Phase 2G) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
            Walk-Forward Testing Protocol
          </h3>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono">
            Prototype Simulation
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
          {/* Stage 1 */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center space-y-1">
            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 mx-auto flex items-center justify-center font-mono font-bold text-xs">
              1
            </div>
            <div className="font-mono font-bold text-xs text-slate-900">Training Data</div>
            <div className="text-[10px] text-slate-500 font-mono">Window t-k → t-1</div>
            <div className="text-[10px] text-slate-400 leading-tight pt-1">
              Historical calibration slice quarantined from future data
            </div>
          </div>

          {/* Stage 2 */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center space-y-1">
            <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-800 mx-auto flex items-center justify-center font-mono font-bold text-xs">
              2
            </div>
            <div className="font-mono font-bold text-xs text-slate-900">Parameter Estimation</div>
            <div className="text-[10px] text-sky-700 font-mono">In-Sample Fit (μ, σ)</div>
            <div className="text-[10px] text-slate-400 leading-tight pt-1">
              Parameters calibrated solely on historical training window
            </div>
          </div>

          {/* Stage 3 */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center space-y-1">
            <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 mx-auto flex items-center justify-center font-mono font-bold text-xs">
              3
            </div>
            <div className="font-mono font-bold text-xs text-slate-900">Unseen Test Window</div>
            <div className="text-[10px] text-amber-800 font-mono">Out-of-Sample (t)</div>
            <div className="text-[10px] text-slate-400 leading-tight pt-1">
              Strictly unseen future observations evaluate performance
            </div>
          </div>

          {/* Stage 4 */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center space-y-1">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center font-mono font-bold text-xs">
              4
            </div>
            <div className="font-mono font-bold text-xs text-slate-900">Validation Result</div>
            <div className="text-[10px] text-emerald-700 font-mono">Cost-Aware Net Edge</div>
            <div className="text-[10px] text-slate-400 leading-tight pt-1">
              Verdict declared only if net edge survives simulated friction
            </div>
          </div>
        </div>
      </div>

      {/* 3 Core Quantitative Validation Principles Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Principle 1: No Look-Ahead */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Principle 1</span>
            <EyeOff className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-sm font-bold text-slate-900 font-mono">NO LOOK-AHEAD BIAS</div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Parameters and rolling statistics are calculated strictly using observations available up to t-1. Information from future settlement sessions is mathematically quarantined.
          </p>
        </div>

        {/* Principle 2: Out-Of-Sample */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Principle 2</span>
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-sm font-bold text-slate-900 font-mono">OUT-OF-SAMPLE EVALUATION</div>
          <p className="text-xs text-slate-600 leading-relaxed">
            The test window (t) remains unseen during parameter calibration. Decisions are tested against fresh market data to eliminate curve-fitting and survivorship artifacts.
          </p>
        </div>

        {/* Principle 3: Cost-Aware */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Principle 3</span>
            <DollarSign className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-sm font-bold text-slate-900 font-mono">COST-AWARE HURDLE</div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Every candidate dislocation is evaluated after deducting bid-ask slippage, STT, turnover fees, and execution safety buffers. Unprofitable gross signals are discarded.
          </p>
        </div>
      </div>

      {/* Prototype Metrics Cards with Strict Simulation Labeling */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900 font-mono">
              Aggregate Out-of-Sample Performance Summary
            </h3>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono">
            Prototype Simulation
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Out-of-Sample Gross Edge"
            value={formatINR(avgGrossEdge)}
            subtitle="Mean gross dislocation across test windows"
            badge={
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                ₹ / 10g
              </span>
            }
          />

          <MetricCard
            label="Estimated Execution Friction"
            value={formatINR(estimatedCost)}
            subtitle="Slippage + Brokerage + Safety Buffer"
            badge={
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700">
                Hurdle
              </span>
            }
          />

          <MetricCard
            label="Realized Net Edge"
            value={formatINR(avgNetEdge)}
            subtitle="Theoretical edge surviving friction"
            badge={
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                avgNetEdge > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
              }`}>
                {avgNetEdge > 0 ? 'Survives Hurdle' : 'Hurdle Fails'}
              </span>
            }
          />
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-500 italic">
          Disclaimer: Figures are simulated quantitative demonstrations based on historical volatility and modeled transaction costs. In compliance with AUREX standards, we do not claim live broker execution or guaranteed historical alpha.
        </div>
      </div>

      {/* Interactive Rolling Walk-Forward Timeline */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 font-mono">
            Sequential Walk-Forward Windows ({windows.length} Evaluated)
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            Pair: {selectedPair[0]} / {selectedPair[1]}
          </span>
        </div>

        <WalkForwardTimelineChart windows={windows} />
      </div>
    </div>
  );
};
