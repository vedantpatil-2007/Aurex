import React from 'react';
import { 
  ContractSymbol, 
  FrictionAssumptions, 
  DecisionResult,
  NormalizedObservation,
  DataMode,
  DataProvenance,
  DatasetMetadata
} from '../types/market';
import { formatINR } from '../utils/formatters';
import { FrictionSliders } from '../components/decision/FrictionSliders';
import { DecisionPipelineVisual } from '../components/decision/DecisionPipelineVisual';
import { CostWaterfallChart } from '../components/decision/CostWaterfallChart';
import { WhyExplanationPanel } from '../components/decision/WhyExplanationPanel';
import { DecisionBadge } from '../components/cards/DecisionBadge';
import { StressLabSensitivityGrid } from '../components/decision/StressLabSensitivityGrid';
import { 
  ArrowRight, 
  Zap,
  FileSpreadsheet,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  CheckCircle2
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
  latestData?: Record<ContractSymbol, NormalizedObservation>;
  onNavigate: (page: any) => void;
  dataMode?: DataMode;
  onSelectDataMode?: (mode: DataMode) => void;
  selectedDate?: string;
  availableDates?: string[];
  latestAvailableDate?: string;
  onSelectDate?: (date: string) => void;
  provenance?: DataProvenance;
  metadata?: DatasetMetadata;
  hasSpreadData?: boolean;
  missingSpreadReason?: string;
  spreadSeriesLength?: number;
  priceA?: number;
  priceB?: number;
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
  latestData,
  onNavigate,
  dataMode,
  onSelectDataMode,
  selectedDate,
  availableDates,
  latestAvailableDate,
  onSelectDate,
  provenance,
  metadata,
  hasSpreadData,
  missingSpreadReason,
  spreadSeriesLength,
  priceA,
  priceB
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

      {/* Active Valuation Context & Date Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Left: Mode, Provenance & Source */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Dataset Mode:
            </span>
            {onSelectDataMode ? (
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  onClick={() => onSelectDataMode('ALL')}
                  className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] sm:text-[11px] transition-colors ${
                    dataMode === 'ALL'
                      ? 'bg-slate-900 text-amber-400 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="ALL mode: Access prototype simulation and imported observations"
                >
                  ALL
                </button>
                <button
                  onClick={() => onSelectDataMode('PROTOTYPE_ONLY')}
                  className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] sm:text-[11px] transition-colors ${
                    dataMode === 'PROTOTYPE_ONLY'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="PROTOTYPE ONLY: Calibrated simulation for demonstrations"
                >
                  PROTOTYPE
                </button>
                <button
                  onClick={() => onSelectDataMode('IMPORTED_ONLY')}
                  className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] sm:text-[11px] transition-colors ${
                    dataMode === 'IMPORTED_ONLY'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="IMPORTED ONLY: Authentic user-imported MCX Bhavcopy market observations only"
                >
                  IMPORTED
                </button>
              </div>
            ) : (
              <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                dataMode === 'IMPORTED_ONLY' ? 'bg-sky-100 text-sky-800 border border-sky-300' :
                dataMode === 'PROTOTYPE_ONLY' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                'bg-slate-100 text-slate-800 border border-slate-300'
              }`}>
                {dataMode || 'ALL'}
              </span>
            )}
          </div>

          <span className="hidden sm:inline text-slate-300">•</span>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Provenance:
            </span>
            <span className={`px-2 py-0.5 rounded font-mono font-semibold text-[10px] ${
              provenance === 'OFFICIAL MCX DATA — SOURCE VERIFIED'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : provenance === 'PROTOTYPE SIMULATION'
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-sky-50 text-sky-800 border border-sky-300'
            }`}>
              {provenance || 'ACTIVE DATASET'}
            </span>
          </div>

          {metadata?.filename && (
            <>
              <span className="hidden lg:inline text-slate-300">•</span>
              <div className="hidden lg:block text-[11px] font-mono text-slate-500 truncate max-w-[260px]" title={metadata.filename}>
                Source: {metadata.filename}
              </div>
            </>
          )}
        </div>

        {/* Right: Valuation Date Selector with Quick Jump */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-semibold text-[11px] font-mono">Valuation As-Of:</span>
            {availableDates && onSelectDate && availableDates.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedDate}
                  onChange={e => onSelectDate(e.target.value)}
                  className="bg-transparent font-mono font-bold text-slate-900 text-xs focus:outline-none cursor-pointer"
                  title="Select As-Of valuation date"
                >
                  {availableDates.map(d => (
                    <option key={d} value={d}>
                      {d} {d === latestAvailableDate ? '(Latest)' : ''}
                    </option>
                  ))}
                </select>
                {latestAvailableDate && selectedDate !== latestAvailableDate && (
                  <button
                    onClick={() => onSelectDate(latestAvailableDate)}
                    className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono font-bold text-[10px] transition-colors shadow-xs ml-1"
                    title="Jump to latest available market observation"
                  >
                    Jump to Latest ({latestAvailableDate})
                  </button>
                )}
              </div>
            ) : (
              <span className="font-mono font-bold text-slate-900">{selectedDate || 'N/A'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Contemporaneous Pair Basis Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Evaluated Pair:
            </span>
            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
              {selectedPair[0]} / {selectedPair[1]}
              {spreadSeriesLength !== undefined && spreadSeriesLength > 0 && (
                <span className="ml-1 text-[10px] text-slate-500 font-normal">({spreadSeriesLength} sessions)</span>
              )}
            </span>
          </div>

          <span className="hidden sm:inline text-slate-300">•</span>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 font-mono">
              Leg A ({selectedPair[0]}):
            </span>
            <span className="font-mono font-bold text-slate-900">
              {priceA !== undefined ? `${formatINR(priceA)}/10g` : 'N/A'}
            </span>
          </div>

          <span className="hidden sm:inline text-slate-300">•</span>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 font-mono">
              Leg B ({selectedPair[1]}):
            </span>
            <span className="font-mono font-bold text-slate-900">
              {priceB !== undefined ? `${formatINR(priceB)}/10g` : 'N/A'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 font-mono uppercase tracking-wider">
              Observed Basis:
            </span>
            <span className={`font-mono font-bold ${hasSpreadData ? 'text-amber-600' : 'text-slate-400'}`}>
              {hasSpreadData ? `${formatINR(calculatedSpread)}/10g` : 'N/A'}
            </span>
          </div>

          <span className={`px-2 py-0.5 rounded font-mono font-semibold text-[10px] flex items-center gap-1 ${
            hasSpreadData
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}>
            {hasSpreadData ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                <span>Contemporaneous</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 text-amber-700" />
                <span>Uncontemporaneous</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Explicit Missing Contemporaneous Pair Data Warning */}
      {hasSpreadData === false && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-950 font-mono">
                No Contemporaneous Observations for Pair {selectedPair[0]} / {selectedPair[1]}
              </h4>
              <p className="text-xs text-amber-900 leading-relaxed">
                In <strong className="font-mono">{dataMode || 'active'}</strong> mode as of valuation date <strong className="font-mono">{selectedDate}</strong>, there are no aligned trade observations for both legs of this pair. {missingSpreadReason ? `${missingSpreadReason} ` : ''}To prevent cross-provenance contamination and look-ahead bias, AUREX requires contemporaneous settlement prices from the same provenance family on or before the valuation date.
              </p>
              <p className="text-xs text-amber-800 leading-relaxed italic">
                AUREX enforces capital preservation: <strong className="font-mono">NO TRADE</strong> is the mathematically honest institutional outcome when market basis observations are absent.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-amber-200 flex-wrap">
            {latestAvailableDate && selectedDate !== latestAvailableDate && onSelectDate && (
              <button
                onClick={() => onSelectDate(latestAvailableDate)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-mono font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Jump to Latest Session ({latestAvailableDate})</span>
              </button>
            )}
            <button
              onClick={() => onPairChange(['GOLDM', 'GOLDTEN'])}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-mono font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span>Switch to Active Benchmark (GOLDM / GOLDTEN)</span>
            </button>
            <button
              onClick={() => onNavigate('data-lab')}
              className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-mono font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span>Inspect Coverage in Data Lab</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

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
        volA={latestData?.[selectedPair[0]]?.volume ?? 0}
        oiA={latestData?.[selectedPair[0]]?.openInterest ?? 0}
        volB={latestData?.[selectedPair[1]]?.volume ?? 0}
        oiB={latestData?.[selectedPair[1]]?.openInterest ?? 0}
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
