import React, { useState, useMemo } from 'react';
import { NormalizedObservation, ContractSymbol } from '../../types/market';
import { CONTRACT_SPECIFICATIONS } from '../../data/contracts';
import { getNormalizationBreakdown } from '../../engines/normalizationEngine';
import { formatINR, formatNumber } from '../../utils/formatters';
import {
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Scale,
  Clock,
  BarChart3,
  Info
} from 'lucide-react';

const ALL_SYMBOLS: ContractSymbol[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'];

interface ContractUniverseTableProps {
  observations: NormalizedObservation[];
  selectedSymbol: ContractSymbol;
  onSelectContract: (symbol: ContractSymbol) => void;
}

type SortField = 'symbol' | 'close' | 'normalizedPrice' | 'volume' | 'openInterest' | 'daysToExpiry';
type SortOrder = 'asc' | 'desc';

export const ContractUniverseTable: React.FC<ContractUniverseTableProps> = ({
  observations,
  selectedSymbol,
  onSelectContract
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSymbol, setFilterSymbol] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [expandedSymbol, setExpandedSymbol] = useState<ContractSymbol | null>(selectedSymbol);

  // Group latest observations by symbol
  const latestBySymbol = useMemo(() => {
    const map = new Map<ContractSymbol, NormalizedObservation>();
    for (const obs of observations) {
      // Since observations are in chronological order, later ones overwrite
      map.set(obs.symbol, obs);
    }
    return map;
  }, [observations]);

  const filteredData = useMemo(() => {
    return ALL_SYMBOLS
      .map(sym => latestBySymbol.get(sym))
      .filter((obs): obs is NormalizedObservation => {
        if (!obs) return false;
        if (filterSymbol !== 'ALL' && obs.symbol !== filterSymbol) return false;
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const spec = CONTRACT_SPECIFICATIONS[obs.symbol];
          return (
            obs.symbol.toLowerCase().includes(q) ||
            spec.name.toLowerCase().includes(q) ||
            spec.expiryScheduleDesc.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];
        if (typeof valA === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
  }, [latestBySymbol, filterSymbol, searchQuery, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleRowClick = (symbol: ContractSymbol) => {
    onSelectContract(symbol);
    setExpandedSymbol(prev => (prev === symbol ? null : symbol));
  };

  const expandedSpec = expandedSymbol ? CONTRACT_SPECIFICATIONS[expandedSymbol] : null;
  const expandedObs = expandedSymbol ? latestBySymbol.get(expandedSymbol) : null;
  const breakdown = expandedObs && expandedSpec ? getNormalizationBreakdown(expandedObs.close, expandedSpec) : null;

  return (
    <div className="space-y-4">
      {/* Controls Bar: Search & Filter */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search contracts, delivery specs, or names..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Filter:</span>
            <select
              value={filterSymbol}
              onChange={e => setFilterSymbol(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">All 4 Contracts</option>
              <option value="GOLDM">GOLDM</option>
              <option value="GOLDTEN">GOLDTEN</option>
              <option value="GOLDGUINEA">GOLDGUINEA</option>
              <option value="GOLDPETAL">GOLDPETAL</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Showing {filteredData.length} of {ALL_SYMBOLS.length} contracts
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 cursor-pointer hover:text-amber-800" onClick={() => handleSort('symbol')}>
                  <div className="flex items-center gap-1">
                    <span>Symbol</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4">Lot Size</th>
                <th className="py-3 px-4">Quote Unit</th>
                <th className="py-3 px-4">Purity</th>
                <th className="py-3 px-4">Expiry Window</th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-amber-800" onClick={() => handleSort('close')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Raw Close</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-amber-800" onClick={() => handleSort('volume')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Volume</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-amber-800" onClick={() => handleSort('openInterest')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Open Interest</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-amber-800" onClick={() => handleSort('normalizedPrice')}>
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-amber-900 font-bold">Normalized ₹/10g</span>
                    <ArrowUpDown className="w-3 h-3 text-amber-600" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-nums">
              {filteredData.map(obs => {
                const spec = CONTRACT_SPECIFICATIONS[obs.symbol];
                const isSelected = selectedSymbol === obs.symbol;
                const isExpanded = expandedSymbol === obs.symbol;

                return (
                  <tr
                    key={obs.symbol}
                    onClick={() => handleRowClick(obs.symbol)}
                    className={`hover:bg-amber-50/50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-amber-50/80 border-l-4 border-l-amber-600' : ''
                    }`}
                  >
                    {/* Symbol */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{obs.symbol}</span>
                        {isSelected && (
                          <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded font-sans uppercase">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-sans font-normal text-slate-500">
                        {spec.name}
                      </div>
                    </td>

                    {/* Lot Size */}
                    <td className="py-3.5 px-4 text-slate-700">
                      <span className="font-semibold">{spec.contractSizeGrams} g</span>
                    </td>

                    {/* Quote Unit */}
                    <td className="py-3.5 px-4 text-slate-700">
                      <span>{spec.quoteUnitGrams} g</span>
                    </td>

                    {/* Purity */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold text-[11px]">
                        {spec.purityPermille} Fineness
                      </span>
                    </td>

                    {/* Expiry Window */}
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="text-xs font-medium">{spec.expiryScheduleDesc}</div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Date: {obs.expiryDate} ({obs.daysToExpiry}d left)</span>
                      </div>
                    </td>

                    {/* Raw Close */}
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">
                      {formatINR(obs.close)}
                    </td>

                    {/* Volume */}
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                      {formatNumber(obs.volume)}
                    </td>

                    {/* Open Interest */}
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                      {formatNumber(obs.openInterest)}
                    </td>

                    {/* Normalized ₹/10g */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-900 bg-amber-50/40">
                      {formatINR(obs.normalizedPrice)}
                    </td>

                    {/* Toggle */}
                    <td className="py-3.5 px-4 text-center">
                      <button className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expandable Details Panel */}
      {expandedSymbol && expandedSpec && expandedObs && breakdown && (
        <div className="bg-white border-2 border-amber-500/30 rounded-xl p-5 shadow-sm transition-all animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-slate-900">
                {expandedSpec.symbol} — Detailed Contract Profile
              </span>
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                {expandedSpec.name}
              </span>
            </div>
            <button
              onClick={() => onSelectContract(expandedSymbol)}
              className="text-xs font-semibold px-3 py-1 bg-amber-500 text-slate-950 rounded hover:bg-amber-400 transition-colors"
            >
              Set as Primary Analytic Contract
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 text-xs">
            {/* Box 1: Contract Specifications */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Info className="w-3.5 h-3.5 text-amber-600" />
                Contract Specifications
              </div>
              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Trading Lot:</span>
                  <span className="font-mono font-medium text-slate-900">{expandedSpec.tradingLotDescription}</span>
                </div>
                <div className="flex justify-between">
                  <span>Contract Size:</span>
                  <span className="font-mono font-medium text-slate-900">{expandedSpec.contractSizeGrams} grams</span>
                </div>
                <div className="flex justify-between">
                  <span>Quote Unit:</span>
                  <span className="font-mono font-medium text-slate-900">{expandedSpec.quoteUnitGrams} grams</span>
                </div>
                <div className="flex justify-between">
                  <span>Purity Standard:</span>
                  <span className="font-mono font-medium text-slate-900">{expandedSpec.purityPermille} Fineness</span>
                </div>
                <div className="flex justify-between">
                  <span>Tick Size:</span>
                  <span className="font-mono font-medium text-slate-900">₹{expandedSpec.tickSize}</span>
                </div>
              </div>
            </div>

            {/* Box 2: Market Data */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
                Market Observations
              </div>
              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Observation Date:</span>
                  <span className="font-mono font-medium text-slate-900">{expandedObs.date}</span>
                </div>
                <div className="flex justify-between">
                  <span>Open:</span>
                  <span className="font-mono font-medium text-slate-900">{formatINR(expandedObs.open)}</span>
                </div>
                <div className="flex justify-between">
                  <span>High:</span>
                  <span className="font-mono font-medium text-slate-900">{formatINR(expandedObs.high)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Low:</span>
                  <span className="font-mono font-medium text-slate-900">{formatINR(expandedObs.low)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Settlement Close:</span>
                  <span className="font-mono text-amber-800">{formatINR(expandedObs.close)}</span>
                </div>
              </div>
            </div>

            {/* Box 3: Liquidity & Expiry */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Liquidity & Expiry
              </div>
              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Expiry Date:</span>
                  <span className="font-mono font-medium text-slate-900">{expandedObs.expiryDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Days Remaining:</span>
                  <span className="font-mono font-bold text-amber-700">{expandedObs.daysToExpiry} days</span>
                </div>
                <div className="flex justify-between">
                  <span>Turnover Volume:</span>
                  <span className="font-mono font-medium text-slate-900">{formatNumber(expandedObs.volume)} lots</span>
                </div>
                <div className="flex justify-between">
                  <span>Open Interest:</span>
                  <span className="font-mono font-medium text-slate-900">{formatNumber(expandedObs.openInterest)} lots</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Unit:</span>
                  <span className="font-medium text-slate-700 truncate max-w-[120px]">{expandedSpec.deliveryUnit}</span>
                </div>
              </div>
            </div>

            {/* Box 4: Normalization Result */}
            <div className="bg-amber-500/10 p-3.5 rounded-lg border border-amber-500/30 space-y-2">
              <div className="font-semibold text-amber-900 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Scale className="w-3.5 h-3.5 text-amber-700" />
                Normalization Result
              </div>
              <div className="space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span>Unit Multiplier:</span>
                  <span className="font-mono font-medium">{breakdown.unitMultiplier}x</span>
                </div>
                <div className="flex justify-between">
                  <span>Purity Multiplier:</span>
                  <span className="font-mono font-medium">{breakdown.purityMultiplier}x</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Scaling Factor:</span>
                  <span className="font-mono font-semibold">{breakdown.scalingFactor}</span>
                </div>
                <div className="pt-1.5 border-t border-amber-300">
                  <div className="text-[10px] text-amber-800 uppercase font-bold">Standard Normalized Basis:</div>
                  <div className="text-base font-mono font-bold text-amber-950 mt-0.5">
                    {formatINR(breakdown.normalizedPrice)} / 10g
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
