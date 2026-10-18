import React, { useMemo } from 'react';
import { 
  ContractSymbol, 
  NormalizedObservation, 
  FrictionAssumptions, 
  DataProvenance,
  RelativeValueSpreadPoint 
} from '../types/market';
import { EdgeSurvivalLedger } from '../components/ledger/EdgeSurvivalLedger';
import { buildEdgeSurvivalLedger } from '../engines/ledgerEngine';
import { calculateZScore } from '../engines/relativeValueEngine';
import { 
  ShieldCheck, 
  ArrowRight, 
  Calendar, 
  Layers, 
  Download, 
  Cpu, 
  SlidersHorizontal 
} from 'lucide-react';

interface LedgerPageProps {
  latestData: Record<ContractSymbol, NormalizedObservation>;
  allObservations: NormalizedObservation[];
  selectedPair: [ContractSymbol, ContractSymbol];
  onPairChange: (pair: [ContractSymbol, ContractSymbol]) => void;
  friction: FrictionAssumptions;
  manualEdge?: number;
  provenance: DataProvenance;
  availableDates: string[];
  selectedDate: string;
  onSelectDate: (d: string) => void;
  spreadSeries: RelativeValueSpreadPoint[];
  onNavigate: (page: any) => void;
}

export const Ledger: React.FC<LedgerPageProps> = ({
  latestData,
  allObservations,
  selectedPair,
  onPairChange,
  friction,
  manualEdge,
  provenance,
  availableDates,
  selectedDate,
  onSelectDate,
  spreadSeries,
  onNavigate
}) => {
  // Find observations for selected pair on the chosen date
  const obsA = useMemo(() => {
    return allObservations.find(o => o.symbol === selectedPair[0] && o.date === selectedDate) ||
      latestData[selectedPair[0]];
  }, [allObservations, selectedPair, selectedDate, latestData]);

  const obsB = useMemo(() => {
    return allObservations.find(o => o.symbol === selectedPair[1] && o.date === selectedDate) ||
      latestData[selectedPair[1]];
  }, [allObservations, selectedPair, selectedDate, latestData]);

  // Compute statistical metrics for active pair
  const zScoreAnalysis = useMemo(() => {
    return calculateZScore(spreadSeries, 20);
  }, [spreadSeries]);

  // Build the 8-stage ledger
  const ledgerData = useMemo(() => {
    return buildEdgeSurvivalLedger({
      pair: selectedPair,
      obsA,
      obsB,
      provenance,
      friction,
      historicalMean: zScoreAnalysis.mean,
      historicalStdDev: zScoreAnalysis.standardDeviation,
      zScore: zScoreAnalysis.currentZScore,
      manualEdgeOverride: manualEdge
    });
  }, [selectedPair, obsA, obsB, provenance, friction, zScoreAnalysis, manualEdge]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-900 text-amber-400 font-mono">
              Signature Feature
            </span>
            <span className="text-xs text-slate-500 font-medium">Auditable Decision Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 font-mono">
            Edge Survival Ledger
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            A comprehensive, transparent decision ledger proving whether a theoretical relative-value dislocation survives economic normalization, maturity alignment, liquidity screening, and execution friction.
          </p>
        </div>

        <button
          onClick={() => onNavigate('decision')}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 self-start shadow-sm font-mono"
        >
          <span>Modify Friction Parameters</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Control Bar: Pair selector and Date picker */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Pair selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Contract Pair:</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPairChange(['GOLDM', 'GOLDTEN'])}
              className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition-colors ${
                selectedPair[0] === 'GOLDM' && selectedPair[1] === 'GOLDTEN'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              GOLDM / GOLDTEN
            </button>
            <button
              onClick={() => onPairChange(['GOLDM', 'GOLDGUINEA'])}
              className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition-colors ${
                selectedPair[0] === 'GOLDM' && selectedPair[1] === 'GOLDGUINEA'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              GOLDM / GUINEA
            </button>
            <button
              onClick={() => onPairChange(['GOLDM', 'GOLDPETAL'])}
              className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition-colors ${
                selectedPair[0] === 'GOLDM' && selectedPair[1] === 'GOLDPETAL'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              GOLDM / PETAL
            </button>
          </div>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700">Audit Date:</span>
          <select
            value={selectedDate}
            onChange={(e) => onSelectDate(e.target.value)}
            className="text-xs font-mono bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {availableDates.slice(-30).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Render the Complete 8-Stage Edge Survival Ledger Component */}
      <EdgeSurvivalLedger ledger={ledgerData} />
    </div>
  );
};
