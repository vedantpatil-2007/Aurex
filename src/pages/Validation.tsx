import React, { useMemo } from 'react';
import {
  NormalizedObservation,
  ContractSymbol,
  FrictionAssumptions
} from '../types/market';
import { buildPairSpreadSeries } from '../engines/relativeValueEngine';
import { generateWalkForwardWindows } from '../engines/validationEngine';
import { WalkForwardTimelineChart } from '../components/charts/WalkForwardTimelineChart';
import { BacktestDashboard } from '../components/backtest/BacktestDashboard';
import { MetricCard } from '../components/cards/MetricCard';
import { formatINR } from '../utils/formatters';
import {
  ArrowRight,
  History
} from 'lucide-react';

import { marketDataService } from '../services/marketDataService';

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
  const provenance = marketDataService.getProvenance();

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
            Walk-Forward Validation & Backtesting
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Strict chronological out-of-sample testing for pair <span className="font-mono font-bold text-slate-900">{selectedPair[0]} / {selectedPair[1]}</span>. Re-calibrates parameters in-sample and evaluates performance strictly on unseen future test windows under cost friction without look-ahead bias.
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

      {/* Visual Walk-Forward Methodology Flow */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
            Walk-Forward Testing Protocol
          </h3>
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded font-mono ${
            provenance === 'OFFICIAL MCX DATA — SOURCE VERIFIED'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : provenance === 'USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED'
              ? 'bg-teal-100 text-teal-800 border border-teal-300'
              : provenance === 'USER-IMPORTED DATA — SOURCE UNVERIFIED'
              ? 'bg-sky-100 text-sky-800 border border-sky-300'
              : provenance === 'PROTOTYPE SAMPLE — UNVERIFIED SOURCING'
              ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
              : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}>
            {provenance}
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
              Zero look-ahead evaluation on strictly future data point
            </div>
          </div>

          {/* Stage 4 */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center space-y-1">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center font-mono font-bold text-xs">
              4
            </div>
            <div className="font-mono font-bold text-xs text-slate-900">Net Edge Realization</div>
            <div className="text-[10px] text-emerald-800 font-mono">Gross − Friction</div>
            <div className="text-[10px] text-slate-400 leading-tight pt-1">
              Evaluate edge survival against realistic transaction costs
            </div>
          </div>
        </div>
      </div>

      {/* Workstream 3: Interactive Walk-Forward Backtesting Simulator & Trade Ledger */}
      <BacktestDashboard
        observations={observations}
        selectedPair={selectedPair}
        defaultFriction={friction}
      />

      {/* Distinction & Reconciliation Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-1.5">
        <div className="font-bold font-mono text-slate-900 uppercase text-[11px] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Analytical Methodology Reconciliation: Discrete Trade Simulation vs Rolling Statistical Windows
        </div>
        <div className="text-slate-600 leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="bg-white p-2.5 rounded border border-slate-200/80">
            <span className="font-bold text-slate-900 block font-mono mb-1">1. Discrete Trade Simulator (Above):</span>
            Models exact round-trip order execution with double friction (entry + exit = 2× hurdle), lot sizing, and tender window forced exit. When candidate signals do not exceed the 2× friction hurdle, 0 trades are executed — achieving 100% capital preservation with ₹0 drawdown.
          </div>
          <div className="bg-white p-2.5 rounded border border-slate-200/80">
            <span className="font-bold text-slate-900 block font-mono mb-1">2. Rolling Window Breakdown (Below):</span>
            Measures raw one-way statistical spread magnitude across sequential out-of-sample slices. Identifies underlying market dispersion before discrete transaction and round-trip execution constraints are applied.
          </div>
        </div>
      </div>

      {/* Aggregate Performance Summary Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900 font-mono">
              Rolling Window Statistical Edge Summary
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
