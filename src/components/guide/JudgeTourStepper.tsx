import React from 'react';
import { JudgeWalkthroughStep, ContractSymbol } from '../../types/market';
import { NavigationPage } from '../layout/Sidebar';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  CheckCircle2, 
  Info,
  Compass
} from 'lucide-react';

interface JudgeTourStepperProps {
  currentStepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onJumpToStep: (index: number) => void;
  currentStep: JudgeWalkthroughStep;
}

export const JUDGE_STEPS: JudgeWalkthroughStep[] = [
  {
    stepNumber: 1,
    title: 'Select GOLDM (Mini)',
    targetPage: 'contracts',
    instruction: 'Inspect the primary benchmark contract.',
    detail: 'GOLDM features a 100g contract size, 10g quotation unit, and 995 fineness. Notice its deep liquidity and discrete expiry on the 3rd–5th of the delivery month.',
    focusContract: 'GOLDM',
    focusPair: ['GOLDM', 'GOLDTEN']
  },
  {
    stepNumber: 2,
    title: 'Select GOLDTEN',
    targetPage: 'contracts',
    instruction: 'Inspect the second contract leg.',
    detail: 'GOLDTEN has a 10g contract size with a 1g quotation unit and 995 fineness. Comparing its ₹7,400 raw quote directly to GOLDM’s ₹74,000 raw quote would be an economic error.',
    focusContract: 'GOLDTEN',
    focusPair: ['GOLDM', 'GOLDTEN']
  },
  {
    stepNumber: 3,
    title: 'Precision Normalization',
    targetPage: 'normalization',
    instruction: 'Convert both contracts to ₹ / 10g @ 999 purity.',
    detail: 'AUREX applies Price_norm = Raw × (10 / QuoteUnit) × (999 / Purity). This mathematically aligns both contracts to identical physical and economic ground.',
    focusContract: 'GOLDM'
  },
  {
    stepNumber: 4,
    title: 'Compare Relative Value',
    targetPage: 'relative-value',
    instruction: 'Track the statistical basis spread S_t(i,j).',
    detail: 'Observe the normalized spread series and the rolling 20-day Z-Score bands (±1.5σ and ±2.0σ). Dislocation reflects carry, fabrication, or temporary liquidity pricing anomalies.',
    focusPair: ['GOLDM', 'GOLDTEN']
  },
  {
    stepNumber: 5,
    title: 'Apply Liquidity & Cost Filter',
    targetPage: 'decision',
    instruction: 'Filter the theoretical edge through friction hurdles.',
    detail: 'A theoretical edge is an illusion if it cannot survive slippage, STT, exchange fees, and thinner-leg market impact. Examine the cost decomposition waterfall.',
    focusPair: ['GOLDM', 'GOLDTEN']
  },
  {
    stepNumber: 6,
    title: 'Walk-Forward Validation',
    targetPage: 'validation',
    instruction: 'Enforce out-of-sample discipline.',
    detail: 'Observe how AUREX trains on past windows (t-k → t-1) and tests strictly on unseen periods (t). Zero look-ahead bias ensures results survive scrutiny.',
    focusPair: ['GOLDM', 'GOLDTEN']
  },
  {
    stepNumber: 7,
    title: 'Generate Decision & Audit Rationale',
    targetPage: 'decision',
    instruction: 'Review the final ACTIONABLE / WATCH / NO TRADE verdict.',
    detail: 'Adjust slippage sliders to see the gate flip. Note that NO TRADE is celebrated as a valid capital preservation outcome—protecting traders from false signals.',
    focusPair: ['GOLDM', 'GOLDTEN']
  }
];

export const JudgeTourStepper: React.FC<JudgeTourStepperProps> = ({
  currentStepIndex,
  totalSteps,
  onNext,
  onPrev,
  onClose,
  onJumpToStep,
  currentStep
}) => {
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === totalSteps - 1;

  return (
    <div className="bg-slate-900 text-white border-b border-amber-500/40 p-4 shadow-xl relative z-30 transition-all animate-fadeIn">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Badge & Step Info */}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider shadow-sm">
              <Compass className="w-3.5 h-3.5" />
              Judge Walkthrough
            </span>
            <span className="font-mono text-xs text-amber-400 font-bold">
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
            <span className="text-slate-400 text-xs hidden sm:inline">|</span>
            <span className="text-xs text-slate-300 font-semibold hidden sm:inline">
              {currentStep.title}
            </span>
          </div>

          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-200 leading-relaxed">
              <strong className="text-white">{currentStep.instruction} </strong>
              <span className="text-slate-300">{currentStep.detail}</span>
            </div>
          </div>
        </div>

        {/* Right: Step Dots & Navigation Controls */}
        <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
          {/* Progress dots */}
          <div className="hidden lg:flex items-center gap-1.5 mr-2">
            {JUDGE_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => onJumpToStep(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentStepIndex
                    ? 'w-6 bg-amber-400'
                    : idx < currentStepIndex
                    ? 'bg-emerald-400'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
                title={`Go to Step ${idx + 1}`}
              />
            ))}
          </div>

          {/* Prev button */}
          <button
            onClick={onPrev}
            disabled={isFirst}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
              isFirst
                ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>

          {/* Next / Finish button */}
          <button
            onClick={onNext}
            className="px-3.5 py-1.5 rounded text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1 transition-all shadow-sm"
          >
            <span>{isLast ? 'Complete Tour' : 'Next Step'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Exit Tour button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Exit Guided Walkthrough"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
