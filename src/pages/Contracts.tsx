import React, { useState, useEffect, useMemo } from 'react';
import { NormalizedObservation, ContractSymbol } from '../types/market';
import { ContractUniverseTable } from '../components/tables/ContractUniverseTable';
import { ExpiryTimelineVisual } from '../components/contracts/ExpiryTimelineVisual';
import { NormalizedComparisonChart } from '../components/charts/NormalizedComparisonChart';
import { ContractComparabilityCard } from '../components/contracts/ContractComparabilityCard';
import { FuturesCurveCard } from '../components/termStructure/FuturesCurveCard';
import { CONTRACT_DELIVERY_RULES } from '../data/contracts';
import {
  ArrowRight,
  ShieldAlert,
  FileText,
  AlertTriangle
} from 'lucide-react';

interface ContractsPageProps {
  observations: NormalizedObservation[];
  selectedSymbol: ContractSymbol;
  onSelectContract: (symbol: ContractSymbol) => void;
  onNavigate: (page: any) => void;
}

export const Contracts: React.FC<ContractsPageProps> = ({
  observations,
  selectedSymbol,
  onSelectContract,
  onNavigate
}) => {
  // Extract latest observation map by symbol
  const latestBySymbol = useMemo(() => {
    const map: Partial<Record<ContractSymbol, NormalizedObservation>> = {};
    for (const obs of observations) {
      map[obs.symbol] = obs;
    }
    return map as Record<ContractSymbol, NormalizedObservation>;
  }, [observations]);

  // Available dates for term structure
  const availableDates = useMemo(() => {
    return Array.from(new Set(observations.map(o => o.date))).sort();
  }, [observations]);

  const [selectedCurveDate, setSelectedCurveDate] = useState<string>(() => {
    return availableDates.slice(-1)[0] || '2026-10-08';
  });

  useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(selectedCurveDate)) {
      setSelectedCurveDate(availableDates[availableDates.length - 1]);
    }
  }, [availableDates, selectedCurveDate]);

  return (
    <div className="space-y-6">
      {/* Page Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono">
              Module 01
            </span>
            <span className="text-xs text-slate-500 font-medium">MCX Derivative Specifications & Term Structure</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 font-mono">
            Contract Universe & Term Structure
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Inspect structural heterogeneity across MCX gold contracts. Each contract has distinct lot sizes, quotation units, purity standards (995 vs 999), discrete expiry horizons, and strict compulsory physical delivery tender windows.
          </p>
        </div>

        <button
          onClick={() => onNavigate('normalization')}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 self-start shadow-sm font-mono"
        >
          <span>Proceed to Normalization</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Visual Expiry Timeline & Lifecycle Horizons */}
      <ExpiryTimelineVisual
        observations={latestBySymbol}
        selectedSymbol={selectedSymbol}
        onSelectContract={onSelectContract}
      />

      {/* Contract Universe Table with Search, Sort, Filter & Expandable Details */}
      <ContractUniverseTable
        observations={observations}
        selectedSymbol={selectedSymbol}
        onSelectContract={onSelectContract}
      />

      {/* Workstream 2: Futures Curve & Implied Carry Analytics */}
      <FuturesCurveCard
        observations={observations}
        availableDates={availableDates}
        selectedDate={selectedCurveDate}
        onDateChange={setSelectedCurveDate}
      />

      {/* Workstream 5: MCX Bullion Lifecycle & Compulsory Delivery Tender Rules */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-mono">
                MCX Bullion Compulsory Delivery & Tender Rules
              </h3>
              <p className="text-xs text-slate-500">
                Regulatory specifications under SEBI Master Circulars for Indian Commodity Derivatives
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
            Workstream 5 Intelligence
          </span>
        </div>

        {/* Regulatory summary callout */}
        <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 text-xs text-slate-700 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 font-mono">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            <span>5-Day Compulsory Delivery Tender Period Enforcement</span>
          </div>
          <p className="leading-relaxed">
            All MCX Gold futures contracts (Gold Mini, Gold Ten, Gold Guinea, Gold Petal) follow <strong>Compulsory Physical Delivery</strong> settlement. During the <strong>5 trading days prior to contract expiry (Tender Window)</strong>, open positions incur escalating tender margins (typically 5% incremental per day up to 25%) and carry compulsory delivery matching risk with substantial penalties for delivery failure. AUREX strictly <strong>prohibits opening new pair positions</strong> within tender windows and issues <strong>forced liquidation alerts</strong> for active positions entering tender.
          </p>
        </div>

        {/* Contract Delivery Rules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.values(CONTRACT_DELIVERY_RULES).map(rule => (
            <div
              key={rule.symbol}
              className={`p-4 rounded-xl border transition-all ${
                rule.symbol === selectedSymbol
                  ? 'border-amber-400 bg-amber-50/30 ring-1 ring-amber-400'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-slate-900">{rule.symbol}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                    {rule.deliveryType.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  Launch: {rule.listingEffectiveDate}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Tender Period</span>
                  <span className="font-mono font-bold text-amber-700">{rule.tenderPeriodDays} Trading Days</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Delivery Margin</span>
                  <span className="font-mono font-bold text-slate-800">5% / day (25% total)</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Delivery Unit</span>
                  <span className="font-medium text-slate-800">{rule.deliveryUnit}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Basis Delivery Center</span>
                  <span className="font-medium text-slate-800">{rule.deliveryCenter}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-mono flex items-center gap-1">
                    <FileText className="w-3 h-3 text-slate-400" />
                    Regulatory Reference
                  </span>
                  <span className="text-[11px] text-slate-600 font-mono leading-tight">{rule.officialCircularReference}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contract Comparability Engine Analysis */}
      <ContractComparabilityCard
        obsA={latestBySymbol.GOLDM}
        obsB={latestBySymbol[selectedSymbol] || latestBySymbol.GOLDTEN}
        pair={['GOLDM', selectedSymbol === 'GOLDM' ? 'GOLDTEN' : selectedSymbol]}
      />

      {/* Normalized Contract Prices Chart highlighting selected contract */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Comparative Time Series
          </div>
          <div className="text-xs text-slate-500">
            Clicking any row above highlights its time-series curve below.
          </div>
        </div>
        <NormalizedComparisonChart
          observations={observations}
          selectedSymbol={selectedSymbol}
        />
      </div>
    </div>
  );
};
