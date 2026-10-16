import React from 'react';
import { ValidationWindowResult } from '../../types/market';
import { DecisionBadge } from '../cards/DecisionBadge';
import { formatINR } from '../../utils/formatters';
import { Calendar, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';

interface WalkForwardTimelineChartProps {
  windows: ValidationWindowResult[];
}

export const WalkForwardTimelineChart: React.FC<WalkForwardTimelineChartProps> = ({ windows }) => {
  return (
    <div className="space-y-6">
      {/* Rolling Windows Visual Timeline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {windows.map((w) => (
          <div
            key={w.windowId}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition-all space-y-3.5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {w.windowLabel}
                </span>
                <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                  w.status === 'STABLE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : w.status === 'MARGINAL'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {w.status}
                </span>
              </div>
              <DecisionBadge decision={w.decisionTaken} size="sm" />
            </div>

            {/* Window Timeline Segments Visual */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>In-Sample Calibration</span>
                <span>Out-of-Sample Test</span>
              </div>
              
              <div className="h-5 w-full bg-slate-100 rounded-md overflow-hidden flex border border-slate-200">
                {/* Train block */}
                <div 
                  className="bg-slate-700 h-full flex items-center justify-center text-[10px] text-white font-mono font-medium px-2"
                  style={{ width: '65%' }}
                  title={`Train: ${w.trainStartDate} to ${w.trainEndDate} (${w.trainObservationsCount} days)`}
                >
                  TRAIN (t-k → t-1)
                </div>
                {/* Test block */}
                <div 
                  className="bg-amber-500 h-full flex items-center justify-center text-[10px] text-slate-950 font-mono font-bold px-2"
                  style={{ width: '35%' }}
                  title={`Test: ${w.testStartDate} to ${w.testEndDate} (${w.testObservationsCount} days)`}
                >
                  TEST (t)
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5">
                <span>{w.trainStartDate} → {w.trainEndDate}</span>
                <span>{w.testStartDate} → {w.testEndDate}</span>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center font-mono">
              <div className="bg-slate-50 p-2 rounded">
                <div className="text-[10px] text-slate-400 uppercase font-sans">Train μ Spread</div>
                <div className="text-xs font-bold text-slate-700 mt-0.5">{formatINR(w.inSampleMeanSpread)}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded">
                <div className="text-[10px] text-slate-400 uppercase font-sans">Test Edge</div>
                <div className="text-xs font-bold text-amber-700 mt-0.5">{formatINR(w.outOfSampleObservedEdge)}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded">
                <div className="text-[10px] text-slate-400 uppercase font-sans">Friction</div>
                <div className="text-xs font-bold text-rose-600 mt-0.5">{formatINR(w.estimatedFriction)}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded">
                <div className="text-[10px] text-slate-400 uppercase font-sans">Net Edge</div>
                <div className={`text-xs font-bold mt-0.5 ${w.netEdge > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatINR(w.netEdge)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
