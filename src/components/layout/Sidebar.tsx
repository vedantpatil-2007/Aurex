import React from 'react';
import { 
  LayoutDashboard, 
  Database,
  Layers, 
  Scale, 
  GitCompare, 
  FileSpreadsheet,
  CheckCircle2, 
  SlidersHorizontal,
  TrendingUp,
  Users,
  Shield,
  X
} from 'lucide-react';

export type NavigationPage = 
  | 'overview' 
  | 'data-lab'
  | 'contracts' 
  | 'normalization' 
  | 'relative-value' 
  | 'ledger'
  | 'validation' 
  | 'decision';

interface SidebarProps {
  activePage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activePage, 
  onNavigate,
  isOpen = false,
  onClose
}) => {
  const navItems: { id: NavigationPage; label: string; icon: React.ReactNode; desc: string; badge?: string }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
      desc: 'System summary & pulse'
    },
    {
      id: 'data-lab',
      label: 'Data Lab',
      icon: <Database className="w-4 h-4" />,
      desc: 'MCX Bhavcopy & provenance',
      badge: 'NEW'
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
      id: 'ledger',
      label: 'Edge Survival Ledger',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      desc: '8-stage auditable trail',
      badge: 'CORE'
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

  const handleItemClick = (page: NavigationPage) => {
    onNavigate(page);
    if (onClose) onClose();
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full">
      {/* Top Branding & Navigation */}
      <div>
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-900/30 border border-amber-400/40">
              <TrendingUp className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5 font-mono">
                AUREX
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  v2.0
                </span>
              </div>
              <div className="text-[11px] font-medium tracking-wide text-slate-400">
                MCX Gold Intelligence
              </div>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-5 py-2.5 text-[11px] text-slate-400 leading-relaxed italic border-l-2 border-amber-500/40 ml-3 my-2">
          “Compare correctly. Validate honestly. Act only when the evidence survives costs.”
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-1 text-[10px] font-semibold tracking-wider uppercase text-slate-400 font-mono">
            Analytical Modules
          </div>
          {navItems.map(item => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm shadow-amber-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span className={`${isActive ? 'text-slate-950' : 'text-slate-400'}`}>
                  {item.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium leading-tight flex items-center justify-between">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded uppercase ${
                        isActive ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-amber-300'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <div className={`text-[10px] leading-tight truncate ${isActive ? 'text-slate-900/80' : 'text-slate-400'}`}>
                    {item.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Identity & Metadata */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold font-mono">Team Identity</span>
          <span className="font-mono font-bold text-amber-400 text-xs tracking-wider">LONEBYTE</span>
        </div>

        {/* Team Members List */}
        <div className="space-y-1.5 pt-1 text-[11px] border-t border-slate-800/60">
          <div className="flex items-center gap-1.5 text-slate-200 font-medium">
            <Users className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Vedant Patil <span className="text-[10px] text-slate-400">(Quant Systems)</span></span>
          </div>
          <div className="text-slate-400 pl-5 text-[10px]">
            Dhanashree Vaze • Vedashree Mhatre
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-slate-400" />
            Hack in Hills ’26
          </span>
          <span className="text-amber-400 font-bold">PS 03</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop / Tablet Static Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-100 flex-col justify-between border-r border-slate-800 shrink-0 min-h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            onClick={onClose} 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity" 
          />
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 text-slate-100 flex flex-col justify-between border-r border-slate-800 z-10 shadow-2xl h-full overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
