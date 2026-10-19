import React from 'react';
import { Calendar, Menu } from 'lucide-react';
import { ContractSymbol } from '../../types/market';

interface HeaderProps {
  currentDate: string;
  selectedPair: [ContractSymbol, ContractSymbol];
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentDate,
  selectedPair,
  onToggleMobileMenu
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-sm">
      {/* Title & Platform Branding */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-1.5 -ml-1 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg"
            title="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-base font-bold text-slate-900 tracking-tight font-mono flex items-center gap-2">
          AUREX
          <span className="hidden sm:inline text-slate-300 font-sans font-light">|</span>
          <span className="hidden sm:inline text-xs font-medium text-slate-600 font-sans tracking-normal">
            MCX Gold Intelligence
          </span>
        </h1>
      </div>

      {/* Right-side status and pair indicator */}
      <div className="flex items-center gap-3">
        {/* Active pair quick pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-xs text-slate-700">
          <span className="text-slate-400 font-medium text-[11px]">Active Pair:</span>
          <span className="font-mono font-bold text-slate-900">
            {selectedPair[0]} / {selectedPair[1]}
          </span>
        </div>

        {/* Observation date */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono font-medium text-slate-700">{currentDate}</span>
        </div>
      </div>
    </header>
  );
};
