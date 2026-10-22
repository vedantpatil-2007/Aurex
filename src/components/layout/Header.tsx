import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Menu,
  Bell,
  Check,
  CheckCheck,
  Trash2,
  X,
  Info
} from 'lucide-react';
import {
  ContractSymbol,
  DecisionResult,
  DatasetMetadata,
  PlatformAlert,
  DataMode
} from '../../types/market';
import { alertManager } from '../../engines/alertEngine';

interface HeaderProps {
  currentDate: string;
  selectedPair: [ContractSymbol, ContractSymbol];
  decision?: DecisionResult;
  metadata?: DatasetMetadata;
  onToggleMobileMenu?: () => void;
  availableDates?: string[];
  onSelectDate?: (date: string) => void;
  latestAvailableDate?: string;
  dataMode?: DataMode;
  onSelectDataMode?: (mode: DataMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentDate,
  selectedPair,
  decision,
  metadata,
  onToggleMobileMenu,
  availableDates,
  onSelectDate,
  latestAvailableDate,
  dataMode,
  onSelectDataMode
}) => {
  const [isAlertDrawerOpen, setIsAlertDrawerOpen] = useState(false);
  const [alerts, setAlerts] = useState<PlatformAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Evaluate alerts whenever decision or metadata changes
  useEffect(() => {
    if (decision && metadata) {
      alertManager.evaluateSystemAlerts(decision, metadata);
    }
    setAlerts(alertManager.getAlerts());
    setUnreadCount(alertManager.getUnreadCount());
  }, [decision, metadata, currentDate]);

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    alertManager.markAsRead(id);
    setAlerts(alertManager.getAlerts());
    setUnreadCount(alertManager.getUnreadCount());
  };

  const handleMarkAllAsRead = () => {
    alertManager.markAllAsRead();
    setAlerts(alertManager.getAlerts());
    setUnreadCount(alertManager.getUnreadCount());
  };

  const handleClearAlerts = () => {
    alertManager.clearAlerts();
    setAlerts([]);
    setUnreadCount(0);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-xs relative z-40">
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

      {/* Right-side status, pair indicator & notification bell */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Authoritative Data Mode Selector */}
        {dataMode && onSelectDataMode && (
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => onSelectDataMode('ALL')}
              className={`px-2 py-1 rounded font-mono font-bold text-[10px] sm:text-[11px] transition-colors ${
                dataMode === 'ALL'
                  ? 'bg-slate-900 text-amber-400 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="ALL mode: Access prototype simulation and imported observations with isolated provenance"
            >
              ALL
            </button>
            <button
              onClick={() => onSelectDataMode('PROTOTYPE_ONLY')}
              className={`px-2 py-1 rounded font-mono font-bold text-[10px] sm:text-[11px] transition-colors ${
                dataMode === 'PROTOTYPE_ONLY'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="PROTOTYPE ONLY: Calibrated simulation for demonstrations and architectural testing"
            >
              PROTOTYPE
            </button>
            <button
              onClick={() => onSelectDataMode('IMPORTED_ONLY')}
              className={`px-2 py-1 rounded font-mono font-bold text-[10px] sm:text-[11px] transition-colors ${
                dataMode === 'IMPORTED_ONLY'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="IMPORTED ONLY: Authentic user-imported MCX Bhavcopy market observations only"
            >
              IMPORTED
            </button>
          </div>
        )}

        {/* Active pair quick pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-xs text-slate-700">
          <span className="text-slate-400 font-medium text-[11px]">Active Pair:</span>
          <span className="font-mono font-bold text-slate-900">
            {selectedPair[0]} / {selectedPair[1]}
          </span>
        </div>

        {/* Observation As-Of date selector */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          {availableDates && onSelectDate && availableDates.length > 1 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium text-[10px] hidden sm:inline">As-Of:</span>
              <select
                value={currentDate}
                onChange={e => onSelectDate(e.target.value)}
                className="bg-transparent font-mono font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
                title="Select historical As-Of valuation date"
              >
                {availableDates.map(d => (
                  <option key={d} value={d}>
                    {d} {d === latestAvailableDate ? '(Latest)' : ''}
                  </option>
                ))}
              </select>
              {latestAvailableDate && currentDate !== latestAvailableDate && (
                <button
                  onClick={() => onSelectDate(latestAvailableDate)}
                  className="px-1.5 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono font-bold text-[10px] transition-colors shadow-xs ml-1"
                  title="Jump to latest available market observation"
                >
                  Jump to Latest
                </button>
              )}
            </div>
          ) : (
            <span className="font-mono font-medium text-slate-700">{currentDate}</span>
          )}
        </div>

        {/* Workstream 6: Notification Bell & Alert Center */}
        <div className="relative">
          <button
            onClick={() => setIsAlertDrawerOpen(prev => !prev)}
            className={`p-2 rounded-lg border transition-colors relative flex items-center justify-center ${
              unreadCount > 0
                ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title="Platform Alerts & Signal Center"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-rose-600 text-white font-mono font-bold text-[10px] rounded-full shadow-xs animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Alert Dropdown Drawer */}
          {isAlertDrawerOpen && (
            <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 flex flex-col max-h-[480px]">
              {/* Header */}
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-slate-700" />
                  <span className="text-xs font-mono font-bold text-slate-900 uppercase">
                    Alert Center ({alerts.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {alerts.length > 0 && (
                    <>
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-[10px] text-slate-600 hover:text-slate-900 flex items-center gap-1 font-mono"
                        title="Mark all as read"
                      >
                        <CheckCheck className="w-3 h-3" />
                        <span>Read All</span>
                      </button>
                      <button
                        onClick={handleClearAlerts}
                        className="text-[10px] text-rose-600 hover:text-rose-800 flex items-center gap-1 font-mono"
                        title="Clear all alerts"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setIsAlertDrawerOpen(false)}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Alert List */}
              <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
                {alerts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 font-mono space-y-1">
                    <Info className="w-5 h-5 mx-auto text-slate-400" />
                    <p>No active platform alerts.</p>
                    <p className="text-[10px] text-slate-400">System conditions nominal.</p>
                  </div>
                ) : (
                  alerts.map(alt => {
                    let badgeBg = 'bg-slate-100 text-slate-700';
                    if (alt.severity === 'ACTION_REQUIRED') badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                    if (alt.severity === 'WARNING') badgeBg = 'bg-amber-100 text-amber-800 border-amber-200';
                    if (alt.severity === 'CRITICAL') badgeBg = 'bg-rose-100 text-rose-800 border-rose-200';

                    return (
                      <div
                        key={alt.id}
                        className={`p-3 text-xs space-y-1.5 transition-colors ${
                          alt.isRead ? 'bg-white opacity-70' : 'bg-amber-50/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${badgeBg}`}>
                              {alt.severity.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {alt.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {!alt.isRead && (
                              <button
                                onClick={(e) => handleMarkAsRead(alt.id, e)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-emerald-700"
                                title="Mark as read"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="font-semibold text-slate-900 leading-tight">
                          {alt.title}
                        </div>

                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {alt.message}
                        </p>

                        {alt.triggerRule && (
                          <div className="text-[10px] font-mono text-amber-800 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200/60 inline-block">
                            Trigger: {alt.triggerRule}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
