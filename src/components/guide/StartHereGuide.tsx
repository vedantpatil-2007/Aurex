import React, { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Database,
  Scale,
  Layers,
  GitCompare,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';
import { NavigationPage } from '../layout/Sidebar';

interface StartHereGuideProps {
  onNavigate?: (page: NavigationPage) => void;
  defaultExpanded?: boolean;
}

export const StartHereGuide: React.FC<StartHereGuideProps> = ({
  onNavigate,
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showGlossary, setShowGlossary] = useState(false);
  const [showDataGuide, setShowDataGuide] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all">
      {/* Header Bar */}
      <div
        className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition-colors border-b border-slate-100"
        onClick={() => setIsExpanded(prev => !prev)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 font-mono">
                Start Here: What AUREX Does
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-sans">
                Platform Guide
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Five clear steps from raw exchange data to cost-aware contract intelligence in plain English.
            </p>
          </div>
        </div>

        <button
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
          aria-label={isExpanded ? 'Collapse guide' : 'Expand guide'}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-5 text-slate-700 text-xs">
          {/* Executive Overview in Plain English */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 leading-relaxed text-slate-600">
            <strong className="text-slate-900 font-medium">The Commodity Derivatives Problem: </strong>
            On the Multi Commodity Exchange of India (MCX), gold futures trade under four distinct contracts (<strong>GOLDM</strong>, <strong>GOLDTEN</strong>, <strong>GOLDGUINEA</strong>, and <strong>GOLDPETAL</strong>). Even though all four represent gold, their prices cannot be compared directly because they trade in different weights, quotation units, and purity levels. AUREX normalizes these prices into a fair common benchmark and checks whether observed price differences survive real-world trading costs.
          </div>

          {/* 5 Short Steps Workflow */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono mb-3">
              The 5-Step AUREX Workflow
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {/* Step 1 */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col justify-between space-y-2 min-w-0">
                <div>
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px] mb-1">
                    <span>STEP 1</span>
                    <Database className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="font-bold text-slate-900 text-xs font-mono">1. Load Data</div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    Select bundled demo data or import a market-data CSV file through the Data Lab.
                  </p>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('data-lab')}
                    className="text-[10px] font-mono font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1"
                  >
                    <span>Open Data Lab</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Step 2 */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col justify-between space-y-2 min-w-0">
                <div>
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px] mb-1">
                    <span>STEP 2</span>
                    <Scale className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="font-bold text-slate-900 text-xs font-mono">2. Normalize Prices</div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    Convert eligible gold-contract prices to a common ₹/10g at 999-purity standard for an honest comparison.
                  </p>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('normalization')}
                    className="text-[10px] font-mono font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1 pt-1"
                  >
                    <span>View Normalization</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Step 3 */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col justify-between space-y-2 min-w-0">
                <div>
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px] mb-1">
                    <span>STEP 3</span>
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="font-bold text-slate-900 text-xs font-mono">3. Compare Contracts</div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    Check contract specifications and expiry compatibility before comparing prices to avoid maturity mismatches.
                  </p>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('contracts')}
                    className="text-[10px] font-mono font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 pt-1"
                  >
                    <span>Inspect Specs</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Step 4 */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col justify-between space-y-2 min-w-0">
                <div>
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px] mb-1">
                    <span>STEP 4</span>
                    <GitCompare className="w-3.5 h-3.5 text-teal-600" />
                  </div>
                  <div className="font-bold text-slate-900 text-xs font-mono">4. Evaluate Opportunities</div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    Examine relative-value differences after estimated costs and liquidity considerations.
                  </p>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('relative-value')}
                    className="text-[10px] font-mono font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 pt-1"
                  >
                    <span>Relative Value</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Step 5 */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col justify-between space-y-2 min-w-0">
                <div>
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px] mb-1">
                    <span>STEP 5</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="font-bold text-slate-900 text-xs font-mono">5. Validate Results</div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    Use historical walk-forward validation and the Edge Survival Ledger to assess evidence and limitations.
                  </p>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('ledger')}
                    className="text-[10px] font-mono font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 pt-1"
                  >
                    <span>Audit Ledger</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Decision States Explained */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
              Understanding Decision States (Cost-Gated)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950">
                <span className="font-mono font-bold text-xs text-emerald-800 block">ACTIONABLE</span>
                <span className="text-[11px] text-emerald-900 leading-relaxed block mt-0.5">
                  The observed normalized price difference exceeds estimated slippage, STT/taxes, and safety buffers with adequate contract liquidity.
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-950">
                <span className="font-mono font-bold text-xs text-amber-800 block">WATCH</span>
                <span className="text-[11px] text-amber-900 leading-relaxed block mt-0.5">
                  A potential price dislocation exists, but the net edge is marginal or contract depth on the thinner leg is borderline. Monitor before acting.
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-900">
                <span className="font-mono font-bold text-xs text-slate-800 block">NO TRADE (Capital Preserved)</span>
                <span className="text-[11px] text-slate-700 leading-relaxed block mt-0.5">
                  The apparent opportunity does not survive estimated execution costs. Discarding unprofitable trades preserves capital and is an institutional win.
                </span>
              </div>
            </div>
          </div>

          {/* Collapsible Guidance: Data Choices & Glossary */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
            <button
              onClick={() => setShowGlossary(prev => !prev)}
              className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs flex items-center gap-1.5 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              <span>{showGlossary ? 'Hide Commodity Glossary' : 'View Commodity Glossary'}</span>
              {showGlossary ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              onClick={() => setShowDataGuide(prev => !prev)}
              className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs flex items-center gap-1.5 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>{showDataGuide ? 'Hide Data Provenance Guide' : 'How AUREX Classifies Data'}</span>
              {showDataGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Collapsible Glossary Section */}
          {showGlossary && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2.5">
              <h4 className="font-mono font-bold text-xs uppercase tracking-wider text-slate-900">
                Commodity Derivatives Glossary
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px] text-slate-700">
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <strong className="text-slate-900 block font-mono">Contract</strong>
                  A standardized exchange-traded agreement with defined specifications and expiry.
                </div>
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <strong className="text-slate-900 block font-mono">Expiry</strong>
                  The date when a futures contract expires.
                </div>
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <strong className="text-slate-900 block font-mono">Normalization</strong>
                  Converting prices to the same basis for a fair comparison.
                </div>
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <strong className="text-slate-900 block font-mono">Relative Value</strong>
                  Comparing prices of eligible related contracts.
                </div>
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <strong className="text-slate-900 block font-mono">Transaction Costs</strong>
                  Estimated expenses associated with trading.
                </div>
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <strong className="text-slate-900 block font-mono">Liquidity</strong>
                  How readily a contract can be traded at reasonable prices.
                </div>
                <div className="bg-white p-2.5 rounded border border-slate-200 md:col-span-2">
                  <strong className="text-slate-900 block font-mono">Walk-Forward Validation</strong>
                  Testing a method on later observations that were not used to develop it.
                </div>
              </div>
            </div>
          )}

          {/* Collapsible Data Choices Guide */}
          {showDataGuide && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2.5">
              <h4 className="font-mono font-bold text-xs uppercase tracking-wider text-slate-900">
                Understanding Data Sourcing & Provenance
              </h4>
              <div className="space-y-2 text-[11px]">
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="font-mono font-bold text-amber-700">PROTOTYPE SIMULATION: </span>
                  Generated or calibrated demonstration values based on MCX contract parameters, not actual historical exchange records.
                </div>
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="font-mono font-bold text-indigo-700">PROTOTYPE SAMPLE — UNVERIFIED SOURCING: </span>
                  Bundled illustrative dataset formatted to MCX Bhavcopy schema for prototype demonstration; official origin unverified.
                </div>
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="font-mono font-bold text-sky-700">USER-IMPORTED DATA — SOURCE UNVERIFIED: </span>
                  Imported CSV file whose column structure has been checked, but whose official origin has not been independently verified.
                </div>
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="font-mono font-bold text-teal-700">USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED: </span>
                  User-recorded assertion of source origin. Does not constitute independent verification by AUREX or MCX.
                </div>
              </div>
              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                <strong>Mandatory Disclosure: </strong>
                Uploading a file and recording a source attestation does not independently verify that the file originated from MCX.
              </div>
            </div>
          )}

          {/* Institutional Decision Support Disclaimer */}
          <div className="p-2.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[11px] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-slate-900">Prototype Disclaimer: </strong>
              AUREX is a quantitative decision-support prototype. It is not a guaranteed-profit system, does not execute real-money trades, and does not provide financial investment advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
