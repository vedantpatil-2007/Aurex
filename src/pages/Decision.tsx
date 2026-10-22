import React from 'react';
import { 
  ContractSymbol, 
  FrictionAssumptions, 
  DecisionResult 
} from '../types/market';
import { FrictionSliders } from '../components/decision/FrictionSliders';
import { DecisionPipelineVisual } from '../components/decision/DecisionPipelineVisual';
import { CostWaterfallChart } from '../components/decision/CostWaterfallChart';
import { WhyExplanationPanel } from '../components/decision/WhyExplanationPanel';
import { DecisionBadge } from '../components/cards/DecisionBadge';
import { StressLabSensitivityGrid } from '../components/decision/StressLabSensitivityGrid';
import { marketDataService } from '../services/marketDataService';
import { 
  ShieldCheck, 
  ArrowRight, 
  Zap,
  FileSpreadsheet
} from 'lucide-react';

interface DecisionPageProps {
  decisionResult: DecisionResult;
  selectedPair: [ContractSymbol, ContractSymbol];
  onPairChange: (pair: [ContractSymbol, ContractSymbol]) => void;
  friction: FrictionAssumptions;
  onFrictionChange: (updated: FrictionAssumptions) => void;
  manualEdge: number | undefined;
  onManualEdgeChange: (val: number | undefined) => void;
  calculatedSpread: number;
  onNavigate: (page: any) => void;
}

export const Decision: React.FC<DecisionPageProps> = ({
  decisionResult,
  selectedPair,
  onPairChange,
  friction,
  onFrictionChange,
  manualEdge,
  onManualEdgeChange,
  calculatedSpread,
  onNavigate
}) => {
  // Preset scenarios to help judge test different decision states instantly!
  const loadScenarioActionable = () => {
    onPairChange(['GOLDM', 'GOLDTEN']);
    onManualEdgeChange(175); // Strong edge
    onFrictionChange({
      slippagePer10g: 20,
      brokerageTaxesPer10g: 30,
      liquidityHaircutPer10g: 10,
      costBufferPer10g: 15,
      liquidityThresholdScore: 45
    });
  };

  const loadScenarioNoTradeCost = () => {
    onPairChange(['GOLDM', 'GOLDTEN']);
    onManualEdgeChange(50); // Small edge
    onFrictionChange({
      slippagePer10g: 35,
      brokerageTaxesPer10g: 35,
      liquidityHaircutPer10g: 20,
      costBufferPer10g: 25,
      liquidityThresholdScore: 50
    });
  };

  const loadScenarioWatch = () => {
    onPairChange(['GOLDM', 'GOLDGUINEA']);
    onManualEdgeChange(135); // Edge exists
    onFrictionChange({
      slippagePer10g: 22,
      brokerageTaxesPer10g: 30,
      liquidityHaircutPer10g: 15,
      costBufferPer10g: 15,
      liquidityThresholdScore: 40 // Borderline liquidity threshold for GUINEA
    });
  };

  const resetToLiveMarket = () => {
    onManualEdgeChange(undefined);
    onFrictionChange({
      slippagePer10g: 25,
      brokerageTaxesPer10g: 35,
      liquidityHaircutPer10g: 15,
      costBufferPer10g: 20,
      liquidityThresholdScore: 50
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono">
              Module 05
            </span>
            <span className="text-xs text-slate-500 font-medium">Cost-Aware Execution Gate</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 font-mono">
            AUREX Decision Engine
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            The final institutional gatekeeper. Converts raw relative-value observations into an actionable verdict:
            <span className="font-mono font-bold text-slate-900 ml-1">ACTIONABLE</span>,
            <span className="font-mono font-bold text-amber-600 ml-1">WATCH</span>, or
            <span className="font-mono font-bold text-slate-800 ml-1">NO TRADE</span> (Capital Preserved).
          </p>
        </div>

        {/* Big live decision badge & Ledger Shortcut */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('ledger')}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm font-mono"
            title="Inspect full 8-stage auditable breakdown"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Open Edge Survival Ledger</span>
          </button>
          <DecisionBadge decision={decisionResult.decision} size="lg" />
        </div>
      </div>

      {/* Quick Interactive Judge Scenarios Banner (Phase 2I) */}
      <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider">
            Judge Scenario Presets:
          </span>
          <span className="text-xs text-slate-300 hidden md:inline">
            Click to test how changes in friction immediately flip the decision gate:
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadScenarioActionable}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors font-mono"
          >
            Preset 1: Actionable
          </button>
          <button
            onClick={loadScenarioWatch}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-600 hover:bg-amber-500 text-white transition-colors font-mono"
          >
            Preset 2: Watch (Borderline Liq)
          </button>
          <button
            onClick={loadScenarioNoTradeCost}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 transition-colors font-mono"
          >
            Preset 3: No Trade (Hurdle Fails)
          </button>
          <button
            onClick={resetToLiveMarket}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors font-mono font-bold"
            title="Reset manual overrides and evaluate live market spread"
          >
            Reset to Live Market
          </button>
        </div>
      </div>

      {/* Sandbox Notice Banner */}
      {manualEdge !== undefined && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px]">
              What-If Sandbox Active
            </span>
            <span>Manual Expected Edge override of ₹{manualEdge.toFixed(2)}/10g is active. Live market spread is ₹{calculatedSpread.toFixed(2)}/10g.</span>
          </div>
          <button
            onClick={resetToLiveMarket}
            className="font-mono font-bold underline text-amber-900 hover:text-amber-950 text-xs ml-auto"
          >
            Clear Override & Restore Live Spread
          </button>
        </div>
      )}

      {/* Visual Pipeline Flow */}
      <DecisionPipelineVisual decisionResult={decisionResult} />

      {/* Cost Waterfall Chart (Phase 2E) */}
      <CostWaterfallChart waterfall={decisionResult.waterfall} />

      {/* Priority Six: Cost & Liquidity Stress Lab (Sensitivity Analysis) */}
      <StressLabSensitivityGrid
        pair={selectedPair}
        observedSpread={calculatedSpread}
        manualExpectedEdge={manualEdge}
        volA={marketDataService.getLatestObservations()[selectedPair[0]]?.volume || 10000}
        oiA={marketDataService.getLatestObservations()[selectedPair[0]]?.openInterest || 15000}
        volB={marketDataService.getLatestObservations()[selectedPair[1]]?.volume || 8000}
        oiB={marketDataService.getLatestObservations()[selectedPair[1]]?.openInterest || 11000}
        baseFriction={friction}
        onApplyAssumptions={onFrictionChange}
      />

      {/* 2-Column Layout: Controls on Left, Transparent Why? Panel on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Interactive Sliders & Inputs */}
        <FrictionSliders
          pair={selectedPair}
          onPairChange={onPairChange}
          friction={friction}
          onFrictionChange={onFrictionChange}
          manualEdge={manualEdge}
          onManualEdgeChange={onManualEdgeChange}
          calculatedSpread={calculatedSpread}
        />

        {/* Right Column: Transparent Explanation & Why? Panel */}
        <div className="space-y-4">
          <WhyExplanationPanel decisionResult={decisionResult} />

          {/* Core Philosophy Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Core Principle: Rigor Before Signals
            </div>
            <p className="text-xs text-slate-600 leading-relaxed italic border-l-2 border-amber-500 pl-3">
              “Compare correctly. Validate honestly. Act only when the evidence survives costs.”
            </p>
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              In institutional commodities trading, gross spread signals are abundant, but true alpha is scarce because friction consumes naive basis trades. AUREX prevents capital destruction by demanding that an edge prove itself after every realistic market friction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
