import React from 'react';
import { Calendar, Cpu, Sparkles, Compass, Menu } from 'lucide-react';
import { ContractSymbol } from '../../types/market';

interface HeaderProps {
  currentDate: string;
  selectedPair: [ContractSymbol, ContractSymbol];
  isJudgeDemoActive?: boolean;
  onToggleJudgeDemo?: () => void;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentDate,
  selectedPair,
  isJudgeDemoActive = false,
  onToggleJudgeDemo,
  onToggleMobileMenu
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-sm">
      {/* Title & Track */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 -ml-1 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg"
            title="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-base font-bold text-slate-900 tracking-tight font-mono flex items-center gap-2">
          AUREX
          <span className="hidden sm:inline text-slate-300 font-sans font-light">|</span>
          <span className="hidden sm:inline text-xs font-semibold text-slate-600 font-sans tracking-normal uppercase">
            Track 03 — Commodity Derivatives Intelligence
          </span>
        </h1>
      </div>

      {/* Right-side status, pair indicator & Judge Demo toggle */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* JUDGE DEMO Button as required by Phase 2H */}
        {onToggleJudgeDemo && (
          <button
            onClick={onToggleJudgeDemo}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              isJudgeDemoActive
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/50 scale-102'
                : 'bg-slate-900 text-amber-400 hover:bg-slate-800 border border-slate-700'
            }`}
            title="Toggle interactive 7-step Judge Walkthrough"
          >
            <Compass className={`w-3.5 h-3.5 ${isJudgeDemoActive ? 'text-slate-950' : 'text-amber-400'}`} />
            <span>JUDGE DEMO</span>
            <span className={`text-[10px] px-1 py-0.2 rounded uppercase font-sans ${
              isJudgeDemoActive ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {isJudgeDemoActive ? 'ACTIVE' : 'START'}
            </span>
          </button>
        )}

        {/* Active pair quick pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-xs text-slate-700">
          <span className="text-slate-400 font-medium text-[11px]">Pair:</span>
          <span className="font-mono font-bold text-slate-900">
            {selectedPair[0]} / {selectedPair[1]}
          </span>
        </div>

        {/* Observation date */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono font-medium text-slate-700">{currentDate}</span>
        </div>

        {/* Prototype status badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
          <Cpu className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[11px] font-semibold tracking-wide">Prototype</span>
        </div>
      </div>
    </header>
  );
};
