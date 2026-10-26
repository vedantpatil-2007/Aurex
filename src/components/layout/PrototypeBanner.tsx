import React from 'react';
import { Database, ArrowRight, ShieldCheck } from 'lucide-react';
import { DataProvenance, DatasetMetadata, DataMode } from '../../types/market';

interface PrototypeBannerProps {
  provenance: DataProvenance;
  filename?: string;
  dataQualityStatus?: 'PASS' | 'WARN';
  onNavigateToDataLab?: () => void;
  metadata?: DatasetMetadata;
  dataMode?: DataMode;
}

export const PrototypeBanner: React.FC<PrototypeBannerProps> = ({ 
  provenance,
  filename,
  dataQualityStatus = 'PASS',
  onNavigateToDataLab,
  metadata,
  dataMode
}) => {
  const isOfficial = provenance === 'OFFICIAL MCX DATA — SOURCE VERIFIED';
  const isAttested = metadata?.isUserAttested ?? (provenance === 'USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED');
  const isUserImported = provenance === 'USER-IMPORTED DATA — SOURCE UNVERIFIED' || isAttested;
  const isSample = provenance === 'PROTOTYPE SAMPLE — UNVERIFIED SOURCING';
  const isHybrid = provenance === 'HYBRID / MIXED PROVENANCE' || (dataMode === 'ALL' && (metadata?.provenanceBreakdown?.userImportedCount || 0) > 0);

  const badgeColor = isOfficial
    ? 'bg-emerald-600 text-white'
    : isHybrid
    ? 'bg-purple-700 text-white font-bold'
    : isUserImported
    ? 'bg-sky-700 text-white'
    : isSample
    ? 'bg-amber-600 text-slate-950 font-black'
    : 'bg-slate-700 text-amber-300';

  const containerBg = isOfficial
    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
    : isHybrid
    ? 'bg-purple-50/70 border-purple-200 text-purple-950'
    : isUserImported
    ? 'bg-sky-50/70 border-sky-200 text-sky-950'
    : isSample
    ? 'bg-amber-50/80 border-amber-300 text-amber-950'
    : 'bg-slate-50 border-slate-200 text-slate-800';

  const sourceFilesCount = metadata?.sourceFiles?.length || 0;
  const observationsCount = metadata?.validRows || 0;

  // Build compact, auditable summary string as specified in Phase 3.C
  let compactSummary = '';
  if (isOfficial) {
    compactSummary = `Official MCX · ${observationsCount.toLocaleString()} observations · Source Verified`;
  } else if (isHybrid) {
    const simCount = metadata?.provenanceBreakdown?.prototypeSimulationCount || 0;
    const impCount = metadata?.provenanceBreakdown?.userImportedCount || 0;
    compactSummary = `Hybrid Dataset · ${(simCount + impCount || observationsCount).toLocaleString()} observations (${simCount} sim + ${impCount} imported) · Mixed Provenance`;
  } else if (isUserImported) {
    if (observationsCount === 0) {
      compactSummary = `Imported Mode · 0 observations loaded · Ingest Bhavcopy CSV in Data Lab`;
    } else {
      compactSummary = `Imported${isAttested ? ' (User-Attested)' : ''} · ${sourceFilesCount > 1 ? `${sourceFilesCount} source files` : (filename || 'Bhavcopy CSV')} · ${observationsCount.toLocaleString()} observations · Source unverified`;
    }
  } else if (isSample) {
    compactSummary = `Sample Schema · ${observationsCount.toLocaleString()} observations · Unverified Sourcing`;
  } else {
    compactSummary = `Prototype Simulation · ${observationsCount.toLocaleString()} observations · Not live exchange execution`;
  }

  return (
    <div className={`border-b px-3 sm:px-4 py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-medium transition-colors ${containerBg}`}>
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold tracking-wider text-[10px] uppercase shadow-xs shrink-0 ${badgeColor}`}>
          <Database className="w-3 h-3" />
          {provenance}
        </span>
        {isAttested && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold tracking-wider text-[10px] uppercase shadow-xs shrink-0 bg-teal-800 text-white border border-teal-700"
            title="User recorded a local source attestation note. This is NOT independent exchange verification."
          >
            USER ATTESTATION RECORDED — NOT INDEPENDENTLY VERIFIED
          </span>
        )}
        <span className="text-slate-700 truncate max-w-full font-mono text-[11px] min-w-0" title={filename}>
          {compactSummary}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5 text-slate-700 text-[11px]" title="Client-side schema, syntax and parsing validation checks. Does NOT imply independent MCX exchange verification.">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="hidden xs:inline">Ingestion:</span>
          <span className={`font-mono font-bold px-1.5 py-0.2 rounded text-[10px] ${
            dataQualityStatus === 'PASS' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}>
            {dataQualityStatus === 'PASS' ? 'INGESTION PASS' : dataQualityStatus}
          </span>
        </div>

        {onNavigateToDataLab && (
          <button
            onClick={onNavigateToDataLab}
            className="text-[11px] font-mono text-slate-800 hover:text-amber-800 underline flex items-center gap-0.5 ml-1 cursor-pointer"
            title="Inspect complete source files, SHA-256 fingerprints and data records in Data Lab"
          >
            <span>Data Lab Details</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
