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
import { StartHereGuide } from '../components/guide/StartHereGuide';
import { 
  Layers, 
  Scale, 
  SlidersHorizontal, 
  Cpu, 
  ArrowRight,
  Compass,
  AlertTriangle
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
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider font-mono">
            Commodity Derivatives Intelligence
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 font-mono">
            AUREX <span className="font-sans font-normal text-slate-500 text-lg">| Cost-Aware Cross-Contract Intelligence</span>
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            A specialized quantitative engine solving the cross-contract basis problem across MCX gold futures: transforming disparate contract units and purities into a normalized economic benchmark and filtering through execution friction.
          </p>
        </div>

        {/* Quick Pair Switcher */}
        <div className="bg-white border border-slate-200 p-2 rounded-lg shadow-sm flex items-center gap-2 self-start flex-wrap">
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

      {/* Alert when 0 records in active dataset */}
      {dataHealth.totalRecords === 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-amber-950 font-mono">
                No Market Observations in Active Dataset Mode
              </h4>
              <p className="text-xs text-amber-900 leading-relaxed">
                The active mode has 0 observations in browser storage. Ingest MCX Bhavcopy CSV files or load the authentic 60-session historical dataset in Data Lab.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('data-lab')}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-mono font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
          >
            <span>Open Data Lab</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Beginner & Judge "Start Here" Explanation Guide */}
      <StartHereGuide onNavigate={onNavigate} />

      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Contracts Monitored"
          value="4"
          icon={<Layers className="w-4 h-4" />}
          subtitle="GOLDM, GOLDTEN, GOLDGUINEA, GOLDPETAL"
          badge={
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
              MCX Gold
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
          value={dataHealth.totalRecords > 0 ? `${dataHealth.totalRecords} Records` : '0 Records'}
          icon={<Cpu className="w-4 h-4" />}
          subtitle={
            dataHealth.provenanceBreakdown &&
            dataHealth.provenanceBreakdown.prototypeSimulationCount > 0 &&
            dataHealth.provenanceBreakdown.userImportedCount > 0
              ? `${dataHealth.provenanceBreakdown.prototypeSimulationCount} Sim + ${dataHealth.provenanceBreakdown.userImportedCount} Imported`
              : (dataHealth.provenanceBreakdown?.userImportedCount || 0) > 0
              ? `${dataHealth.provenanceBreakdown?.userImportedCount} Imported Records`
              : 'Discrete expiries without continuous stitching'
          }
          badge={
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
              {dataHealth.provenanceBreakdown &&
              dataHealth.provenanceBreakdown.prototypeSimulationCount > 0 &&
              dataHealth.provenanceBreakdown.userImportedCount > 0
                ? 'Hybrid'
                : (dataHealth.provenanceBreakdown?.userImportedCount || 0) > 0
                ? 'Imported'
                : 'Simulation'}
            </span>
          }
        />
      </div>

      {/* Phase 2J: How AUREX Works - 7-Stage Pipeline */}
      <ProductArchitectureFlow />

      {/* Central AUREX Decision Card */}
      <CentralDecisionCard
        decisionResult={decisionResult}
        onOpenDecisionEngine={() => onNavigate('decision')}
        onOpenLedger={() => onNavigate('ledger')}
      />

      {/* Data Health & Provenance Panel */}
      <DataHealthPanel 
        health={dataHealth} 
        onOpenDataLab={() => onNavigate('data-lab')}
      />

      {/* Contract Snapshot Table */}
      <ContractSnapshotTable
        latestData={latestData}
        selectedSymbol={selectedContract}
        onSelectContract={onSelectContract}
      />

      {/* Guided demonstration flow banner */}
      <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs uppercase font-bold tracking-wider text-amber-400 font-mono flex items-center gap-2">
            <Compass className="w-4 h-4 text-amber-400" />
            Interactive Pipeline Walkthrough
          </div>
          <div className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Follow the analytical pipeline step-by-step: Contracts Universe → Precision Normalization → Statistical Spread → Cost Waterfall → Walk-Forward Validation → Final Verdict.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onStartJudgeDemo && (
            <button
              onClick={onStartJudgeDemo}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm font-mono"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Launch Walkthrough</span>
            </button>
          )}
          <button
            onClick={() => onNavigate('contracts')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 border border-slate-700 font-mono"
          >
            <span>Explore Contracts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
