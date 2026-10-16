import React from 'react';
import { NormalizedObservation, ContractSymbol } from '../../types/market';
import { CONTRACT_SPECIFICATIONS } from '../../data/contracts';
import { formatINR, formatNumber } from '../../utils/formatters';
import { Clock } from 'lucide-react';

interface ContractSnapshotTableProps {
  latestData: Record<ContractSymbol, NormalizedObservation>;
  selectedSymbol?: ContractSymbol;
  onSelectContract?: (symbol: ContractSymbol) => void;
}

export const ContractSnapshotTable: React.FC<ContractSnapshotTableProps> = ({
  latestData,
  selectedSymbol,
  onSelectContract
}) => {
  const symbols: ContractSymbol[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'];

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            MCX Gold Contract Snapshot
          </h3>
          <p className="text-xs text-slate-500">
            Official PS03 contracts: heterogeneous lot sizes and purities observed on common date
          </p>
        </div>
        <div className="text-xs text-slate-500 font-mono">
          4 Active Contracts
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Contract</th>
              <th className="py-3 px-4">Contract Size</th>
              <th className="py-3 px-4">Quote Unit</th>
              <th className="py-3 px-4">Purity</th>
              <th className="py-3 px-4">Discrete Expiry</th>
              <th className="py-3 px-4 text-right">Raw Close</th>
              <th className="py-3 px-4 text-right">Normalized (₹/10g)</th>
              <th className="py-3 px-4 text-right">Volume (Lots)</th>
              <th className="py-3 px-4 text-right">Open Interest</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono-nums">
            {symbols.map(sym => {
              const spec = CONTRACT_SPECIFICATIONS[sym];
              const obs = latestData[sym];
              const isSelected = selectedSymbol === sym;

              if (!obs) return null;

              return (
                <tr
                  key={sym}
                  onClick={() => onSelectContract && onSelectContract(sym)}
                  className={`hover:bg-amber-50/40 cursor-pointer transition-colors ${
                    isSelected ? 'bg-amber-50/70 border-l-4 border-l-amber-600' : ''
                  }`}
                >
                  {/* Contract Symbol & Name */}
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span>{sym}</span>
                      {isSelected && (
                        <span className="text-[10px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-sans font-semibold">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-sans font-normal text-slate-500">
                      {spec.name}
                    </div>
                  </td>

                  {/* Contract Size */}
                  <td className="py-3.5 px-4 text-slate-700">
                    <span className="font-semibold">{spec.contractSizeGrams} g</span>
                  </td>

                  {/* Quote Unit */}
                  <td className="py-3.5 px-4 text-slate-700">
                    <span>{spec.quoteUnitGrams} g</span>
                  </td>

                  {/* Purity */}
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                      spec.purityPermille === 999 
                        ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {spec.purityPermille} Fineness
                    </span>
                  </td>

                  {/* Expiry */}
                  <td className="py-3.5 px-4 text-slate-700">
                    <div className="font-mono text-xs">{obs.expiryDate}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{obs.daysToExpiry} days to expiry</span>
                    </div>
                  </td>

                  {/* Raw Close */}
                  <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">
                    {formatINR(obs.close)}
                  </td>

                  {/* Normalized ₹/10g */}
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-800 bg-amber-50/30">
                    {formatINR(obs.normalizedPrice)}
                  </td>

                  {/* Volume */}
                  <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                    {formatNumber(obs.volume)}
                  </td>

                  {/* Open Interest */}
                  <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                    {formatNumber(obs.openInterest)}
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectContract && onSelectContract(sym);
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
