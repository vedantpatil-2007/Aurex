import React from 'react';
import { DataHealthSummary } from '../../types/market';
import { ShieldCheck, Database, Calendar, Layers, Activity, ArrowRight, Download } from 'lucide-react';
import { marketDataService } from '../../services/marketDataService';

interface DataHealthPanelProps {
  health?: DataHealthSummary;
  compact?: boolean;
  onOpenDataLab?: () => void;
}

export const DataHealthPanel: React.FC<DataHealthPanelProps> = ({ 
  health, 
  compact = false,
  onOpenDataLab
}) => {
  const safeHealth = health || marketDataService.getDataHealthSummary();

  const handleDownloadReport = () => {
    const metadata = marketDataService.getMetadata();
    const auditPayload = {
      ...metadata,
      auditCertification: {
        provenanceClassification: safeHealth.provenance,
        isUserAttested: metadata.isUserAttested ?? false,
        attestationNotes: metadata.attestationNotes || null,
        attestationTimestamp: metadata.attestationTimestamp || null,
        isIndependentlyVerified: false,
        independentVerificationStatus: 'NOT_INDEPENDENTLY_VERIFIED',
        verificationDisclaimer: 'Uploading a file and recording a source attestation does not independently verify that the file originated from MCX. AUREX currently has no independent official-source verification mechanism. User-attested datasets remain independently unverified.'
      },
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(auditPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AUREX_Data_Quality_Report_${safeHealth.provenance.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (compact) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs shadow-sm font-mono">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Database className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[11px] font-sans text-slate-500">Source:</span>
          <span className="font-semibold text-slate-800">{safeHealth.source}</span>
        </div>
        <span className="text-slate-300">|</span>
        <div className="text-slate-600">
          <span className="text-[11px] font-sans text-slate-500">Records:</span>{' '}
          <span className="font-bold text-slate-800">{safeHealth.totalRecords}</span>
        </div>
        <span className="text-slate-300">|</span>
        <div className="text-slate-600">
          <span className="text-[11px] font-sans text-slate-500">Contracts:</span>{' '}
          <span className="font-bold text-slate-800">{safeHealth.contractsCount} / 4</span>
        </div>
        <span className="text-slate-300">|</span>
        <div className="flex items-center gap-1" title="Client-side schema and ingestion parsing validation (does not constitute official exchange authentication).">
          <span className="text-[11px] font-sans text-slate-500">Ingestion:</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
            safeHealth.qualityStatus === 'PASS' 
              ? 'bg-emerald-100 text-emerald-800' 
              : 'bg-amber-100 text-amber-800'
          }`}>
            {safeHealth.qualityStatus === 'PASS' ? 'INGESTION PASS' : safeHealth.qualityStatus}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Activity className="w-4 h-4 text-amber-600 shrink-0" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
            Data Health & Integrity Status
          </h3>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase break-all sm:break-normal ${
            safeHealth.provenance === 'OFFICIAL MCX DATA — SOURCE VERIFIED'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : safeHealth.provenance === 'USER-IMPORTED DATA — SOURCE UNVERIFIED'
              ? 'bg-sky-100 text-sky-800 border border-sky-300'
              : safeHealth.provenance === 'PROTOTYPE SAMPLE — UNVERIFIED SOURCING'
              ? 'bg-amber-100 text-amber-900 border border-amber-300'
              : 'bg-slate-100 text-slate-800 border border-slate-300'
          }`}>
            {safeHealth.provenance}
          </span>
          {safeHealth.isUserAttested && (
            <span
              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase bg-teal-100 text-teal-900 border border-teal-300 break-all sm:break-normal"
              title="User origin attestation recorded for local audit trail. Does NOT constitute official exchange verification."
            >
              USER ATTESTATION RECORDED — NOT INDEPENDENTLY VERIFIED
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={handleDownloadReport}
            className="text-xs text-slate-600 hover:text-slate-900 font-mono flex items-center gap-1 px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer"
            title="Download full JSON provenance report"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Audit JSON</span>
          </button>
          {onOpenDataLab && (
            <button
              onClick={onOpenDataLab}
              className="text-xs text-amber-800 hover:text-amber-900 font-mono font-bold flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 border border-amber-200 cursor-pointer"
            >
              <span>Manage in Data Lab</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-w-0">
          <div className="text-[10px] font-sans uppercase font-medium text-slate-400">Data Source</div>
          <div className="font-bold text-slate-900 mt-0.5 truncate" title={safeHealth.source}>
            {safeHealth.source}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate" title={safeHealth.filename || 'internal'}>
            {safeHealth.filename || 'internal'}
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-w-0">
          <div className="text-[10px] font-sans uppercase font-medium text-slate-400">Total Observations</div>
          <div className="font-bold text-slate-900 mt-0.5">
            {safeHealth.totalRecords} Rows
          </div>
          <div className="text-[10px] text-emerald-700 mt-0.5 truncate">
            {safeHealth.validRecords} Valid ({safeHealth.rejectedRecords} Rejected)
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-w-0">
          <div className="text-[10px] font-sans uppercase font-medium text-slate-400">Contract Universe</div>
          <div className="font-bold text-slate-900 mt-0.5">
            {safeHealth.contractsCount} / 4 Contracts
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
            Discrete expiries only
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-w-0">
          <div className="text-[10px] font-sans uppercase font-medium text-slate-400">Latest Session</div>
          <div className="font-bold text-slate-900 mt-0.5">
            {safeHealth.lastAvailableDate}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate" title="Client-side parsing and schema validation status (unverified source).">
            Ingestion: {safeHealth.qualityStatus === 'PASS' ? 'Ingestion Pass (Unverified Source)' : safeHealth.qualityStatus}
          </div>
        </div>
      </div>
    </div>
  );
};
