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
    title: '1. Overview Dashboard',
    targetPage: 'overview',
    instruction: 'Review executive system summary and problem framing.',
    detail: 'AUREX solves the cross-contract basis problem: four contracts representing the same physical gold trade under different quotation units, purities, and liquidity profiles.',
    focusContract: 'GOLDM',
    focusPair: ['GOLDM', 'GOLDTEN']
  },
  {
    stepNumber: 2,
    title: '2. Data Health & Provenance',
    targetPage: 'data-lab',
    instruction: 'Verify data source provenance and audit status.',
    detail: 'Transparently inspect data provenance: Verified Official MCX, User-Attested (Unverified), User-Imported (Unverified), Bundled Prototype Sample (Unverified), or Prototype Simulation. Notice explicit tracking of discrete expiries and zero synthetic roll stitching.',
    focusContract: 'GOLDM'
  },
  {
    stepNumber: 3,
    title: '3. Contract Specifications',
    targetPage: 'contracts',
    instruction: 'Inspect GOLDM and GOLDTEN heterogeneous contract specs.',
    detail: 'GOLDM has a 100g lot size with a 10g quotation unit. GOLDTEN has a 10g lot size with a 1g quotation unit. Comparing raw ₹74,500 vs ₹7,450 directly would be an economic error.',
    focusContract: 'GOLDM',
    focusPair: ['GOLDM', 'GOLDTEN']
  },
  {
    stepNumber: 4,
    title: '4. Precision Normalization',
    targetPage: 'normalization',
    instruction: 'Convert all quotes to ₹ / 10g @ 999 purity.',
    detail: 'Formula: Price_norm = Raw Price × (10 / Quote Unit) × (999 / Purity). Observe how unit scaling and purity fineness adjustments bring disparate derivatives into true economic parity.',
    focusContract: 'GOLDM'
  },
  {
    stepNumber: 5,
    title: '5. Select Relative-Value Pair',
    targetPage: 'relative-value',
    instruction: 'Select pair: GOLDM vs GOLDTEN.',
    detail: 'Aligns contemporaneous historical sessions and calculates the normalized spread S_t(i,j) = Price_norm,A,t − Price_norm,B,t without look-ahead bias.',
    focusPair: ['GOLDM', 'GOLDTEN']
  },
  {
    stepNumber: 6,
    title: '6. Spread & Statistics',
    targetPage: 'relative-value',
    instruction: 'Examine spread dispersion, rolling mean, and Z-Score bands.',
    detail: 'Notice the statistical interpretation panel: A high Z-Score is merely a statistical observation, not an automatic guarantee of trade profitability.',
    focusPair: ['GOLDM', 'GOLDTEN']
  },
  {
    stepNumber: 7,
    title: '7. Edge Survival Ledger',
    targetPage: 'ledger',
    instruction: 'Open the 8-stage auditable decision ledger.',
    detail: 'AUREX’s signature feature: traces source evidence, economic normalization, relative spread, maturity alignment, liquidity bottleneck, friction deduction, net edge, and verdict.',
    focusPair: ['GOLDM', 'GOLDTEN']
  },
  {
    stepNumber: 8,
    title: '8. Expiry & Liquidity Screening',
    targetPage: 'contracts',
    instruction: 'Review maturity mismatches and thinner-leg liquidity constraints.',
    detail: 'Examine calendar expiry differences and the liquidity score. Two-leg spread capacity is strictly bounded by the shallower contract leg.',
    focusContract: 'GOLDTEN',
    focusPair: ['GOLDM', 'GOLDTEN']
  },
  {
    stepNumber: 9,
    title: '9. Transaction Friction & Sensitivity',
    targetPage: 'decision',
    instruction: 'Stress-test execution hurdles across friction regimes.',
    detail: 'Explore the Cost & Liquidity Stress Lab (Lower Friction, Base Case, Higher Friction). Watch how estimated slippage, STT, and safety buffers impact defensible net edge.',
    focusPair: ['GOLDM', 'GOLDTEN']
  },
  {
    stepNumber: 10,
    title: '10. Walk-Forward Validation',
    targetPage: 'validation',
    instruction: 'Verify out-of-sample quantitative testing integrity.',
    detail: 'Parameters calibrated strictly in-sample (t-k → t-1) and frozen before testing on unseen periods (t). Zero look-ahead leakage preserves empirical honesty.',
    focusPair: ['GOLDM', 'GOLDTEN']
  },
  {
    stepNumber: 11,
    title: '11. Decision Verdict & Rationale',
    targetPage: 'decision',
    instruction: 'Inspect final ACTIONABLE / WATCH / NO TRADE verdict.',
    detail: 'Review the transparent rule audit trail. NO TRADE is celebrated as a valid capital preservation victory when the market dislocation fails to exceed transaction hurdles.',
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
              Pipeline Walkthrough
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
