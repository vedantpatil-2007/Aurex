import React, { useMemo } from 'react';
import { 
  ContractSymbol, 
  FrictionAssumptions, 
  DecisionResult,
  SensitivityScenario
} from '../../types/market';
import { evaluateDecision } from '../../engines/decisionEngine';
import { calculateTotalFriction } from '../../engines/liquidityCostEngine';
import { 
  Sliders, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ShieldCheck, 
  Activity,
  Layers,
  ArrowRight
} from 'lucide-react';

interface StressLabSensitivityGridProps {
  pair: [ContractSymbol, ContractSymbol];
  observedSpread: number;
  manualExpectedEdge?: number;
  volA: number;
  oiA: number;
  volB: number;
  oiB: number;
  baseFriction: FrictionAssumptions;
  onApplyAssumptions: (f: FrictionAssumptions) => void;
}

export const StressLabSensitivityGrid: React.FC<StressLabSensitivityGridProps> = ({
  pair,
  observedSpread,
  manualExpectedEdge,
  volA,
  oiA,
  volB,
  oiB,
  baseFriction,
  onApplyAssumptions
}) => {
  // Construct 3 standard scenarios: LOWER FRICTION, BASE CASE, HIGHER FRICTION
  const scenarios: SensitivityScenario[] = useMemo(() => {
    // 1. Lower Friction (Institutional direct DMA execution, large participant volume)
    const lowerFriction: FrictionAssumptions = {
      slippagePer10g: Math.max(5, Math.round(baseFriction.slippagePer10g * 0.6)),
      brokerageTaxesPer10g: Math.max(15, Math.round(baseFriction.brokerageTaxesPer10g * 0.7)),
      liquidityHaircutPer10g: Math.max(5, Math.round(baseFriction.liquidityHaircutPer10g * 0.5)),
      costBufferPer10g: Math.max(5, Math.round(baseFriction.costBufferPer10g * 0.5)),
      liquidityThresholdScore: Math.max(25, baseFriction.liquidityThresholdScore - 15)
    };
    const lowerResult = evaluateDecision({
      pair,
      observedSpread,
      manualExpectedEdge,
      volA,
      oiA,
      volB,
      oiB,
      friction: lowerFriction
    });

    // 2. Base Case (Current configured parameters)
    const baseResult = evaluateDecision({
      pair,
      observedSpread,
      manualExpectedEdge,
      volA,
      oiA,
      volB,
      oiB,
      friction: baseFriction
    });

    // 3. Higher Friction (Stressed market conditions, wider bid-ask spreads, higher market impact)
    const higherFriction: FrictionAssumptions = {
      slippagePer10g: Math.round(baseFriction.slippagePer10g * 1.6),
      brokerageTaxesPer10g: Math.round(baseFriction.brokerageTaxesPer10g * 1.3),
      liquidityHaircutPer10g: Math.round(baseFriction.liquidityHaircutPer10g * 1.8),
      costBufferPer10g: Math.round(baseFriction.costBufferPer10g * 1.6),
      liquidityThresholdScore: Math.min(85, baseFriction.liquidityThresholdScore + 15)
    };
    const higherResult = evaluateDecision({
      pair,
      observedSpread,
      manualExpectedEdge,
      volA,
      oiA,
      volB,
      oiB,
      friction: higherFriction
    });

    return [
      {
        id: 'lower',
        name: 'LOWER FRICTION',
        description: 'Optimistic execution: tight crossing spread, low impact.',
        assumptions: lowerFriction,
        decisionResult: lowerResult,
        survivesEdge: lowerResult.netEdge > 0
      },
      {
        id: 'base',
        name: 'BASE CASE',
        description: 'Standard retail/HNI execution with conservative buffer.',
        assumptions: baseFriction,
        decisionResult: baseResult,
        survivesEdge: baseResult.netEdge > 0
      },
      {
        id: 'higher',
        name: 'HIGHER FRICTION',
        description: 'Stressed conditions: wider spreads, severe market impact.',
        assumptions: higherFriction,
        decisionResult: higherResult,
        survivesEdge: higherResult.netEdge > 0
      }
    ];
  }, [pair, observedSpread, manualExpectedEdge, volA, oiA, volB, oiB, baseFriction]);

  const getDecisionTag = (decision: string) => {
    switch (decision) {
      case 'ACTIONABLE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-600 text-white flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            ACTIONABLE
          </span>
        );
      case 'WATCH':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500 text-slate-950 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            WATCH
          </span>
        );
      case 'NO TRADE':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-600 text-white flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            NO TRADE
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 text-amber-400">
              Priority Six
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Cost & Liquidity Stress Lab
            </span>
          </div>
          <h3 className="text-base font-bold font-mono text-slate-900 mt-0.5">
            Sensitivity Analysis Across Market Regimes
          </h3>
          <p className="text-xs text-slate-500">
            Tests whether the relative-value edge survives under varying execution friction assumptions. (Values represent proxy estimates).
          </p>
        </div>
      </div>

      {/* 3-Column Scenario Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((sc) => {
          const totalCost = calculateTotalFriction(sc.assumptions);
          const isBase = sc.id === 'base';

          return (
            <div 
              key={sc.id}
              className={`rounded-xl border p-4 transition-all flex flex-col justify-between ${
                isBase 
                  ? 'border-amber-400 bg-amber-50/20 shadow-sm' 
                  : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <div className="space-y-3">
                {/* Scenario Header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
                    {sc.name} {isBase && <span className="text-amber-600 text-[10px]">(Active)</span>}
                  </span>
                  {getDecisionTag(sc.decisionResult.decision)}
                </div>

                <div className="text-[11px] text-slate-600 leading-snug">
                  {sc.description}
                </div>

                {/* Metrics Breakdown */}
                <div className="bg-white rounded-lg p-2.5 border border-slate-200/80 font-mono text-xs space-y-1">
                  <div className="flex justify-between text-slate-500">
                    <span>Slippage Proxy:</span>
                    <span className="text-slate-800 font-semibold">₹{sc.assumptions.slippagePer10g}/10g</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Brokerage & Taxes:</span>
                    <span className="text-slate-800 font-semibold">₹{sc.assumptions.brokerageTaxesPer10g}/10g</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Haircut & Buffer:</span>
                    <span className="text-slate-800 font-semibold">
                      ₹{sc.assumptions.liquidityHaircutPer10g + sc.assumptions.costBufferPer10g}/10g
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-100">
                    <span>Total Hurdle:</span>
                    <span className="text-slate-900">₹{totalCost.toFixed(2)}/10g</span>
                  </div>
                </div>

                {/* Net Edge Outcome */}
                <div className="p-2 rounded bg-white border border-slate-200 text-xs font-mono flex items-center justify-between">
                  <span className="text-slate-500">Net Defensible Edge:</span>
                  <span className={`font-bold ${sc.decisionResult.netEdge > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {sc.decisionResult.netEdge > 0 ? '+' : ''}₹{sc.decisionResult.netEdge.toFixed(2)}/10g
                  </span>
                </div>
              </div>

              {/* Apply Button */}
              {!isBase && (
                <button
                  onClick={() => onApplyAssumptions(sc.assumptions)}
                  className="mt-3 w-full py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 rounded text-xs font-mono font-medium text-slate-700 transition-colors"
                >
                  Apply {sc.name} Settings
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
