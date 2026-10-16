import React from 'react';
import { 
  NormalizedObservation, 
  ContractSymbol, 
  DecisionResult,
  DataHealthSummary
} from '../types/market';
import { MetricCard } from '../components/cards/MetricCard';
import { CentralDecisionCard } from '../components/cards/CentralDecisionCard';
import { ContractSnapshotTable } from '../components/tables/ContractSnapshotTable';
import { DataHealthPanel } from '../components/common/DataHealthPanel';
import { ProductArchitectureFlow } from '../components/guide/ProductArchitectureFlow';
import { 
  Layers, 
  Scale, 
  SlidersHorizontal, 
  Cpu, 
  ArrowRight,
  Compass
} from 'lucide-react';

interface OverviewPageProps {
  latestData: Record<ContractSymbol, NormalizedObservation>;
  selectedPair: [ContractSymbol, ContractSymbol];
  onPairChange: (pair: [ContractSymbol, ContractSymbol]) => void;
  selectedContract: ContractSymbol;
  onSelectContract: (sym: ContractSymbol) => void;
  decisionResult: DecisionResult;
  dataHealth: DataHealthSummary;
  onNavigate: (page: any) => void;
  onStartJudgeDemo?: () => void;
}

export const Overview: React.FC<OverviewPageProps> = ({
  latestData,
  selectedPair,
  onPairChange,
  selectedContract,
  onSelectContract,
  decisionResult,
  dataHealth,
  onNavigate,
  onStartJudgeDemo
}) => {
  return (
    <div className="space-y-6">
      {/* Title & Subtitle banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-900 text-amber-400 font-mono">
              Track 03
            </span>
            <span className="text-xs text-slate-500 font-medium">Commodity Derivatives Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 font-mono">
            AUREX <span className="font-sans font-normal text-slate-500 text-lg">| Cost-Aware Cross-Contract Intelligence</span>
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            A specialized quantitative engine solving the cross-contract basis problem across MCX gold futures: transforming disparate contract units and purities into a normalized economic benchmark and filtering through execution friction.
          </p>
        </div>

        {/* Quick Pair Switcher */}
        <div className="bg-white border border-slate-200 p-2 rounded-lg shadow-sm flex items-center gap-2 self-start">
          <span className="text-[11px] text-slate-500 font-medium font-sans">Active:</span>
          <button
            onClick={() => onPairChange(['GOLDM', 'GOLDTEN'])}
            className={`px-2 py-1 text-xs font-mono font-bold rounded transition-colors ${
              selectedPair[0] === 'GOLDM' && selectedPair[1] === 'GOLDTEN'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            GOLDM / GOLDTEN
          </button>
          <button
            onClick={() => onPairChange(['GOLDM', 'GOLDGUINEA'])}
            className={`px-2 py-1 text-xs font-mono font-bold rounded transition-colors ${
              selectedPair[0] === 'GOLDM' && selectedPair[1] === 'GOLDGUINEA'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            GOLDM / GUINEA
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Contracts Monitored"
          value="4"
          icon={<Layers className="w-4 h-4" />}
          subtitle="GOLDM, GOLDTEN, GOLDGUINEA, GOLDPETAL"
          badge={
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
              MCX PS03
            </span>
          }
        />

        <MetricCard
          label="Benchmark Standard"
          value="₹ / 10g"
          icon={<Scale className="w-4 h-4" />}
          subtitle="@ 999 Fineness (Standard Valuation)"
          badge={
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
              Unified Basis
            </span>
          }
        />

        <MetricCard
          label="Decision States"
          value="3 Gates"
          icon={<SlidersHorizontal className="w-4 h-4" />}
          subtitle="ACTIONABLE / WATCH / NO TRADE"
          badge={
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
              Cost-Gated
            </span>
          }
        />

        <MetricCard
          label="Data Status"
          value="Prototype"
          icon={<Cpu className="w-4 h-4" />}
          subtitle="Discrete expiries without continuous stitching"
          badge={
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
              Simulation
            </span>
          }
        />
      </div>

      {/* Phase 2J: How AUREX Works - 7-Stage Pipeline */}
      <ProductArchitectureFlow />

      {/* Central AUREX Decision Card (Responding dynamically to active pair and cost assumptions) */}
      <CentralDecisionCard
        decisionResult={decisionResult}
        onOpenDecisionEngine={() => onNavigate('decision')}
      />

      {/* Phase 2A: Compact Data Health Panel */}
      <DataHealthPanel health={dataHealth} />

      {/* Contract Snapshot Table */}
      <ContractSnapshotTable
        latestData={latestData}
        selectedSymbol={selectedContract}
        onSelectContract={onSelectContract}
      />

      {/* Guided demonstration flow banner for hackathon judges */}
      <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs uppercase font-bold tracking-wider text-amber-400 font-mono flex items-center gap-2">
            <Compass className="w-4 h-4 text-amber-400" />
            Hackathon Judge Demonstration Flow
          </div>
          <div className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Take a 2-minute interactive tour across the complete analytical pipeline: Contracts Universe → Precision Normalization → Statistical Spread → Cost Waterfall → Walk-Forward Validation → Final Verdict.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onStartJudgeDemo && (
            <button
              onClick={onStartJudgeDemo}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm font-mono"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Launch Guided Tour</span>
            </button>
          )}
          <button
            onClick={() => onNavigate('contracts')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 border border-slate-700 font-mono"
          >
            <span>Manual: Contracts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
