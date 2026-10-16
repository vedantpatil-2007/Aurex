import React from 'react';
import { 
  LayoutDashboard, 
  Layers, 
  Scale, 
  GitCompare, 
  CheckCircle2, 
  SlidersHorizontal,
  TrendingUp,
  User,
  Shield
} from 'lucide-react';

export type NavigationPage = 
  | 'overview' 
  | 'contracts' 
  | 'normalization' 
  | 'relative-value' 
  | 'validation' 
  | 'decision';

interface SidebarProps {
  activePage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  const navItems: { id: NavigationPage; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
      desc: 'System summary & pulse'
    },
    {
      id: 'contracts',
      label: 'Contracts',
      icon: <Layers className="w-4 h-4" />,
      desc: 'MCX gold contract universe'
    },
    {
      id: 'normalization',
      label: 'Normalization',
      icon: <Scale className="w-4 h-4" />,
      desc: '₹/10g @ 999 precision basis'
    },
    {
      id: 'relative-value',
      label: 'Relative Value',
      icon: <GitCompare className="w-4 h-4" />,
      desc: 'Cross-contract basis & spread'
    },
    {
      id: 'validation',
      label: 'Validation',
      icon: <CheckCircle2 className="w-4 h-4" />,
      desc: 'Walk-forward out-of-sample'
    },
    {
      id: 'decision',
      label: 'Decision Engine',
      icon: <SlidersHorizontal className="w-4 h-4" />,
      desc: 'Cost-aware execution gate'
    }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col justify-between border-r border-slate-800 shrink-0 min-h-screen">
      {/* Top Branding */}
      <div>
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-900/30 border border-amber-400/40">
              <TrendingUp className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5 font-mono">
                AUREX
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  v1.0
                </span>
              </div>
              <div className="text-[11px] font-medium tracking-wide text-slate-400">
                MCX Gold Intelligence
              </div>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 leading-relaxed italic border-l-2 border-amber-500/40 pl-2">
            “Compare correctly. Validate honestly. Act only when the evidence survives costs.”
          </div>
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-slate-400">
            Analytics Modules
          </div>
          {navItems.map(item => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm shadow-amber-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span className={`${isActive ? 'text-slate-950' : 'text-slate-400'}`}>
                  {item.icon}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium leading-tight">{item.label}</div>
                  <div className={`text-[10px] leading-tight ${isActive ? 'text-slate-900/80' : 'text-slate-400'}`}>
                    {item.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Identity & Metadata */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Team Identity</span>
            <span className="font-mono font-bold text-amber-400 text-xs tracking-wider">LONEBYTE</span>
          </div>

          <div className="flex items-center gap-2 pt-1 text-xs text-slate-300">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <div className="text-[12px] font-medium text-slate-200">Vedant Patil</div>
          </div>

          <div className="text-[10px] text-slate-400 leading-tight">
            Solo Quantitative Systems Builder & Full-Stack Engineer
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-slate-400" />
              Hack in Hills ’26
            </span>
            <span className="font-mono text-slate-400">PS 03</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
