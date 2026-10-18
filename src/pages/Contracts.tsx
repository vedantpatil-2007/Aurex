import React, { useMemo } from 'react';
import { NormalizedObservation, ContractSymbol } from '../types/market';
import { ContractUniverseTable } from '../components/tables/ContractUniverseTable';
import { ExpiryTimelineVisual } from '../components/contracts/ExpiryTimelineVisual';
import { NormalizedComparisonChart } from '../components/charts/NormalizedComparisonChart';
import { ContractComparabilityCard } from '../components/contracts/ContractComparabilityCard';
import { ArrowRight } from 'lucide-react';

interface ContractsPageProps {
  observations: NormalizedObservation[];
  selectedSymbol: ContractSymbol;
  onSelectContract: (symbol: ContractSymbol) => void;
  onNavigate: (page: any) => void;
}

export const Contracts: React.FC<ContractsPageProps> = ({
  observations,
  selectedSymbol,
  onSelectContract,
  onNavigate
}) => {
  // Extract latest observation map by symbol
  const latestBySymbol = useMemo(() => {
    const map: Partial<Record<ContractSymbol, NormalizedObservation>> = {};
    for (const obs of observations) {
      map[obs.symbol] = obs;
    }
    return map as Record<ContractSymbol, NormalizedObservation>;
  }, [observations]);

  return (
    <div className="space-y-6">
      {/* Page Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono">
              Module 01
            </span>
            <span className="text-xs text-slate-500 font-medium">MCX Derivative Specifications</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 font-mono">
            Contract Universe
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Inspect structural heterogeneity across MCX gold contracts. Each contract has distinct lot sizes, quotation units, purity standards (995 vs 999), and discrete expiry schedules.
          </p>
        </div>

        <button
          onClick={() => onNavigate('normalization')}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 self-start shadow-sm font-mono"
        >
          <span>Proceed to Normalization</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Phase 2B: Visual Expiry Timeline & Lifecycle Horizons */}
      <ExpiryTimelineVisual
        observations={latestBySymbol}
        selectedSymbol={selectedSymbol}
        onSelectContract={onSelectContract}
      />

      {/* Contract Universe Table with Search, Sort, Filter & Expandable Details */}
      <ContractUniverseTable
        observations={observations}
        selectedSymbol={selectedSymbol}
        onSelectContract={onSelectContract}
      />

      {/* Contract Comparability Engine Analysis */}
      <ContractComparabilityCard
        obsA={latestBySymbol.GOLDM}
        obsB={latestBySymbol[selectedSymbol] || latestBySymbol.GOLDTEN}
        pair={['GOLDM', selectedSymbol === 'GOLDM' ? 'GOLDTEN' : selectedSymbol]}
      />

      {/* Normalized Contract Prices Chart highlighting selected contract */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Comparative Time Series
          </div>
          <div className="text-xs text-slate-500">
            Clicking any row above highlights its time-series curve below.
          </div>
        </div>
        <NormalizedComparisonChart
          observations={observations}
          selectedSymbol={selectedSymbol}
        />
      </div>
    </div>
  );
};
