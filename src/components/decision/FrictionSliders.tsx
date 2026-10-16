import React from 'react';
import { FrictionAssumptions, ContractSymbol } from '../../types/market';
import { formatINR } from '../../utils/formatters';
import { RotateCcw, Sliders, Zap } from 'lucide-react';

interface FrictionSlidersProps {
  pair: [ContractSymbol, ContractSymbol];
  onPairChange: (pair: [ContractSymbol, ContractSymbol]) => void;
  friction: FrictionAssumptions;
  onFrictionChange: (updated: FrictionAssumptions) => void;
  manualEdge: number | undefined;
  onManualEdgeChange: (val: number | undefined) => void;
  calculatedSpread: number;
}

export const FrictionSliders: React.FC<FrictionSlidersProps> = ({
  pair,
  onPairChange,
  friction,
  onFrictionChange,
  manualEdge,
  onManualEdgeChange,
  calculatedSpread
}) => {
  const allSymbols: ContractSymbol[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'];

  const handleResetDefaults = () => {
    onFrictionChange({
      slippagePer10g: 25,
      brokerageTaxesPer10g: 35,
      liquidityHaircutPer10g: 15,
      costBufferPer10g: 20,
      liquidityThresholdScore: 50
    });
    onManualEdgeChange(undefined);
  };

  // Phase 2I: Three Official Demo Scenario Presets
  const applyPreset1Actionable = () => {
    onPairChange(['GOLDM', 'GOLDTEN']);
    onManualEdgeChange(175);
    onFrictionChange({
      slippagePer10g: 20,
      brokerageTaxesPer10g: 30,
      liquidityHaircutPer10g: 10,
      costBufferPer10g: 15,
      liquidityThresholdScore: 45
    });
  };

  const applyPreset2Watch = () => {
    onPairChange(['GOLDM', 'GOLDGUINEA']);
    onManualEdgeChange(135);
    onFrictionChange({
      slippagePer10g: 22,
      brokerageTaxesPer10g: 30,
      liquidityHaircutPer10g: 15,
      costBufferPer10g: 15,
      liquidityThresholdScore: 40 // Triggers borderline liquidity grade
    });
  };

  const applyPreset3NoTrade = () => {
    onPairChange(['GOLDM', 'GOLDTEN']);
    onManualEdgeChange(50);
    onFrictionChange({
      slippagePer10g: 35,
      brokerageTaxesPer10g: 35,
      liquidityHaircutPer10g: 20,
      costBufferPer10g: 25,
      liquidityThresholdScore: 50
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
      {/* Header & Reset */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight font-mono">
            Configurable Execution Parameters
          </h3>
        </div>
        <button
          onClick={handleResetDefaults}
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors font-medium"
          title="Reset to default institutional assumptions"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Preset Scenarios as mandated by Phase 2I */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 font-mono">
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>Demonstration Scenarios</span>
          </div>
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-mono">
            Prototype Scenario
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={applyPreset1Actionable}
            className="px-2.5 py-1.5 text-xs font-semibold rounded bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors text-left font-mono"
          >
            <div className="font-bold">1. Actionable</div>
            <div className="text-[10px] text-emerald-700 font-sans">Edge survives all costs</div>
          </button>
          <button
            onClick={applyPreset2Watch}
            className="px-2.5 py-1.5 text-xs font-semibold rounded bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors text-left font-mono"
          >
            <div className="font-bold">2. Watch</div>
            <div className="text-[10px] text-amber-700 font-sans">Borderline liquidity</div>
          </button>
          <button
            onClick={applyPreset3NoTrade}
            className="px-2.5 py-1.5 text-xs font-semibold rounded bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200 transition-colors text-left font-mono"
          >
            <div className="font-bold">3. No Trade</div>
            <div className="text-[10px] text-slate-600 font-sans">Costs exceed edge</div>
          </button>
        </div>
      </div>

      {/* Contract Pair Selector */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1.5">
            Contract Leg A
          </label>
          <select
            value={pair[0]}
            onChange={e => onPairChange([e.target.value as ContractSymbol, pair[1]])}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {allSymbols.map(s => (
              <option key={s} value={s} disabled={s === pair[1]}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1.5">
            Contract Leg B
          </label>
          <select
            value={pair[1]}
            onChange={e => onPairChange([pair[0], e.target.value as ContractSymbol])}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {allSymbols.map(s => (
              <option key={s} value={s} disabled={s === pair[0]}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expected Relative Edge override / slider */}
      <div className="space-y-1.5 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">Theoretical Relative Edge (₹ / 10g):</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-amber-700">
              {manualEdge !== undefined ? formatINR(manualEdge) : `${formatINR(Math.abs(calculatedSpread))} (Observed)`}
            </span>
            {manualEdge !== undefined && (
              <button
                onClick={() => onManualEdgeChange(undefined)}
                className="text-[10px] text-slate-400 hover:text-slate-600 underline"
              >
                Use Real
              </button>
            )}
          </div>
        </div>
        <input
          type="range"
          min="0"
          max="300"
          step="5"
          value={manualEdge !== undefined ? manualEdge : Math.abs(calculatedSpread)}
          onChange={e => onManualEdgeChange(Number(e.target.value))}
          className="w-full accent-amber-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>₹0</span>
          <span>₹150</span>
          <span>₹300</span>
        </div>
      </div>

      {/* Friction 1: Slippage */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">Estimated Bid-Ask Slippage:</span>
          <span className="font-mono font-bold text-slate-900">
            {formatINR(friction.slippagePer10g)} / 10g
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="2"
          value={friction.slippagePer10g}
          onChange={e =>
            onFrictionChange({ ...friction, slippagePer10g: Number(e.target.value) })
          }
          className="w-full accent-amber-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
        />
      </div>

      {/* Friction 2: Brokerage & Regulatory Taxes */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">Brokerage, STT, Exchange Fees & GST:</span>
          <span className="font-mono font-bold text-slate-900">
            {formatINR(friction.brokerageTaxesPer10g)} / 10g
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="2"
          value={friction.brokerageTaxesPer10g}
          onChange={e =>
            onFrictionChange({ ...friction, brokerageTaxesPer10g: Number(e.target.value) })
          }
          className="w-full accent-amber-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
        />
      </div>

      {/* Friction 3: Liquidity Haircut */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">Liquidity Haircut (Thinner Leg Impact):</span>
          <span className="font-mono font-bold text-slate-900">
            {formatINR(friction.liquidityHaircutPer10g || 0)} / 10g
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="60"
          step="2"
          value={friction.liquidityHaircutPer10g || 0}
          onChange={e =>
            onFrictionChange({ ...friction, liquidityHaircutPer10g: Number(e.target.value) })
          }
          className="w-full accent-amber-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
        />
      </div>

      {/* Friction 4: Safety Buffer */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">Execution Safety Buffer:</span>
          <span className="font-mono font-bold text-slate-900">
            {formatINR(friction.costBufferPer10g)} / 10g
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="2"
          value={friction.costBufferPer10g}
          onChange={e =>
            onFrictionChange({ ...friction, costBufferPer10g: Number(e.target.value) })
          }
          className="w-full accent-amber-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
        />
      </div>

      {/* Liquidity Threshold */}
      <div className="space-y-1.5 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">Liquidity Score Threshold:</span>
          <span className="font-mono font-bold text-slate-900">
            {friction.liquidityThresholdScore} / 100
          </span>
        </div>
        <input
          type="range"
          min="20"
          max="80"
          step="5"
          value={friction.liquidityThresholdScore}
          onChange={e =>
            onFrictionChange({ ...friction, liquidityThresholdScore: Number(e.target.value) })
          }
          className="w-full accent-slate-700 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>20 (Permissive)</span>
          <span>50 (Standard)</span>
          <span>80 (Strict)</span>
        </div>
      </div>
    </div>
  );
};
