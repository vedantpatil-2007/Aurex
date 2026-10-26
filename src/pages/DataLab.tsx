import React, { useState, useRef, useMemo } from 'react';
import {
  DatasetMetadata,
  DataProvenance,
  ContractSymbol,
  DataMode,
  BackupValidationResult
} from '../types/market';
import { marketDataService } from '../services/marketDataService';
import { ParseResult, ColumnMapping } from '../services/csvParserService';
import { SAMPLE_MCX_BHAVCOPY_CSV } from '../data/sampleOfficialBhavcopy';
import {
  Database,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  Table,
  ShieldCheck,
  Info,
  FileText,
  Trash2,
  ArrowRight
} from 'lucide-react';

interface DataLabProps {
  metadata: DatasetMetadata;
  provenance: DataProvenance;
  dataMode?: DataMode;
  onSelectDataMode?: (mode: DataMode) => void;
  onDatasetChanged: () => void;
  onNavigate: (page: any) => void;
}

export const DataLab: React.FC<DataLabProps> = ({
  metadata,
  provenance,
  dataMode,
  onSelectDataMode: _onSelectDataMode,
  onDatasetChanged,
  onNavigate
}) => {
  const effectiveMode = dataMode ?? marketDataService.getActiveDataMode();
  const activeMetadata = marketDataService.getMetadata(effectiveMode);
  const totalStoredRecords = marketDataService.getMetadata('ALL').totalRows;
  const importedStoredCount = marketDataService.getMetadata('IMPORTED_ONLY').validRows;
  const modeDistinctDates = marketDataService.getAvailableDates(effectiveMode);
  const activeProvenance = activeMetadata.provenance;
  const parsedSourceRows = (activeMetadata.validRows || 0) + (activeMetadata.rejectedRows || 0);
  const sourceFilesCount = activeMetadata.sourceFiles?.length ||
    (activeMetadata.filename && activeMetadata.filename.includes(',')
      ? activeMetadata.filename.split(',').length
      : (activeMetadata.validRows > 0 && activeMetadata.filename !== 'No Imported Dataset' && activeMetadata.filename !== 'seed_prototype_simulation.internal' ? 1 : 0));

  const formattedDateRange = useMemo(() => {
    if (modeDistinctDates.length === 0) return 'No Dates Available';
    if (activeMetadata.dateRange.start === activeMetadata.dateRange.end) {
      const parts = activeMetadata.dateRange.start.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        if (monthIdx >= 0 && monthIdx < 12) {
          return `${months[monthIdx]} ${day}, ${year}`;
        }
      }
      return activeMetadata.dateRange.start;
    }
    return `${activeMetadata.dateRange.start} → ${activeMetadata.dateRange.end}`;
  }, [modeDistinctDates, activeMetadata.dateRange]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvRawText, setCsvRawText] = useState<string>('');
  const [parsePreview, setParsePreview] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'preview' | 'rejected' | 'mapping'>('current');
  const [customMapping, setCustomMapping] = useState<Partial<ColumnMapping>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const [showAttestationModal, setShowAttestationModal] = useState(false);
  const [attestationNotesInput, setAttestationNotesInput] = useState('User asserted origin from official MCX Bhavcopy archive');
  const [restorePreview, setRestorePreview] = useState<{ validation: BackupValidationResult; rawContent: string; fileName: string } | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);

  // Process selected or dropped file(s)
  const processFiles = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;
    setParseError(null);

    // Single file upload
    if (fileList.length === 1) {
      const file = fileList[0];
      setSelectedFile(file);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || '';
        setCsvRawText(text);

        // Auto-detect JSON backup payload even if dropped or selected in main upload zone
        const trimmed = text.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          const validation = marketDataService.validateBackup(trimmed);
          if (validation.isValid) {
            setRestorePreview({
              validation,
              rawContent: trimmed,
              fileName: file.name
            });
            return;
          }
        }

        // Parse as CSV / Bhavcopy
        try {
          const { parseResult } = marketDataService.analyzeImportMerge(text, file.name);
          setParsePreview(parseResult);
          setCustomMapping(parseResult.columnMapping);
          setActiveTab('preview');
        } catch (err: any) {
          setParseError(err.message || 'Failed to parse CSV file.');
        }
      };
      reader.readAsText(file);
      return;
    }

    // Multi-file batch upload (e.g. 60 Bhavcopy CSVs)
    setIsProcessingBatch(true);
    setBatchProgress(`Reading ${fileList.length} files...`);

    try {
      const batchFiles: Array<{ name: string; content: string }> = [];
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        const content = await f.text();
        batchFiles.push({ name: f.name, content });
      }

      setBatchProgress(`Parsing and merging ${fileList.length} Bhavcopy files...`);
      const result = await marketDataService.importBatchFromCsv(batchFiles);

      setRestoreMessage({
        type: 'success',
        text: `${result.message} Workspace now contains ${result.finalTotalStoredCount} observations across ${result.finalDistinctDatesCount} trading dates (${result.finalDateRange.start} → ${result.finalDateRange.end}).`
      });
      onDatasetChanged();
      setActiveTab('current');
    } catch (err: any) {
      setParseError(err.message || 'Batch import failed.');
    } finally {
      setIsProcessingBatch(false);
      setBatchProgress(null);
    }
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    processFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    processFiles(files);
  };

  // Load authentic 60-session historical MCX Bhavcopy dataset (1,440 observations)
  const handleLoadHistoricalDataset = () => {
    try {
      const res = marketDataService.loadBundledHistoricalDataset();
      setRestoreMessage({
        type: 'success',
        text: `Loaded authentic 60-session historical MCX Bhavcopy dataset: ${res.finalTotalStoredCount} observations across ${res.finalDistinctDatesCount} trading dates (${res.finalDateRange.start} → ${res.finalDateRange.end}).`
      });
      onDatasetChanged();
      setActiveTab('current');
    } catch (err: any) {
      setRestoreMessage({
        type: 'error',
        text: err.message || 'Failed to load historical Bhavcopy dataset.'
      });
    }
  };

  // Load bundled illustrative MCX Bhavcopy sample (Unverified)
  const handleLoadBundledSample = () => {
    try {
      const res = marketDataService.loadBundledSample();
      setParsePreview(res);
      setSelectedFile(null);
      setCsvRawText(SAMPLE_MCX_BHAVCOPY_CSV);
      onDatasetChanged();
      setActiveTab('current');
    } catch (err: any) {
      setParseError(err.message || 'Failed to load bundled sample dataset.');
    }
  };

  // User attestation handler (asserts origin without claiming independent verification)
  const handleRecordAttestation = () => {
    try {
      marketDataService.recordSourceAttestation(attestationNotesInput);
      onDatasetChanged();
      setShowAttestationModal(false);
    } catch (err: any) {
      setParseError(err.message || 'Attestation failed.');
    }
  };

  // Revoke user attestation and restore unverified status
  const handleRevokeAttestation = () => {
    marketDataService.revokeSourceAttestation();
    onDatasetChanged();
  };

  // Confirm and commit uploaded dataset into active memory & local storage
  const handleConfirmImport = (forceReplace = false) => {
    if (!csvRawText) return;
    try {
      marketDataService.importFromCsv(
        csvRawText,
        selectedFile ? selectedFile.name : 'imported_bhavcopy.csv',
        customMapping,
        forceReplace
      );
      onDatasetChanged();
      setActiveTab('current');
      setParsePreview(null);
      setSelectedFile(null);
    } catch (err: any) {
      setParseError(err.message || 'Import failed.');
    }
  };

  // Reset to deterministic Prototype Simulation
  const handleResetToSimulation = () => {
    if (marketDataService.hasPersistedData()) {
      if (!window.confirm('Resetting will clear the active workspace and restore the default calibrated prototype simulation. Continue?')) {
        return;
      }
    }
    marketDataService.resetToSimulation();
    setParsePreview(null);
    setSelectedFile(null);
    setCsvRawText('');
    onDatasetChanged();
    setActiveTab('current');
  };

  // Clear persistent local storage dataset and revert to simulation
  const handleClearLocalStorage = () => {
    if (window.confirm('Are you sure you want to clear stored imported records from browser storage? This will reset the workspace to the prototype simulation.')) {
      marketDataService.clearPersistedData();
      setParsePreview(null);
      setSelectedFile(null);
      setCsvRawText('');
      onDatasetChanged();
      setActiveTab('current');
    }
  };

  // Download official sample CSV file
  const handleDownloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_MCX_BHAVCOPY_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mcx_gold_sample_bhavcopy.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download comprehensive Data Health & Quality Report JSON
  const handleDownloadDataReport = () => {
    const reportData = {
      datasetMetadata: metadata,
      provenance,
      generatedAt: new Date().toISOString(),
      reportStatus: metadata.rejectedRows > 0 ? 'WARN' : 'PASS',
      sourceAttestation: metadata.isUserAttested ? {
        status: 'USER_ATTESTED_ONLY',
        notes: metadata.attestationNotes,
        timestamp: metadata.attestationTimestamp,
        independentVerification: 'NOT_INDEPENDENTLY_VERIFIED',
        disclaimer: 'Uploading a file and recording a source attestation does not independently verify that the file originated from MCX. AUREX currently has no independent official-source verification mechanism. User-attested datasets remain independently unverified.'
      } : {
        status: 'UNATTESTED',
        independentVerification: 'NOT_INDEPENDENTLY_VERIFIED'
      }
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AUREX_Data_Health_Report_${provenance.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download complete historical dataset backup JSON (versioned schema)
  const handleDownloadDatasetBackup = () => {
    try {
      const backup = marketDataService.exportDatasetBackup(effectiveMode);
      if (backup.observationsCount === 0) {
        setRestoreMessage({ type: 'error', text: 'Active dataset contains 0 observations to backup.' });
        return;
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = `AUREX_Dataset_Backup_${backup.provenance.replace(/\s+/g, '_')}_${backup.observationsCount}obs_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setRestoreMessage({
        type: 'success',
        text: `Complete backup exported: ${backup.observationsCount} observations across ${backup.distinctDatesCount} trading dates (${backup.dateRange.start} → ${backup.dateRange.end}).`
      });
    } catch (err: any) {
      setRestoreMessage({ type: 'error', text: `Backup export failed: ${err.message}` });
    }
  };

  // Trigger restore file selection
  const handleTriggerRestoreBackup = () => {
    if (backupFileInputRef.current) {
      backupFileInputRef.current.value = '';
      backupFileInputRef.current.click();
    }
  };

  // Parse and validate backup file on selection
  const handleBackupFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const validation = marketDataService.validateBackup(content);
      if (!validation.isValid) {
        setRestoreMessage({
          type: 'error',
          text: `Invalid backup file "${file.name}": ${validation.errors.join('; ')}`
        });
        return;
      }
      setRestorePreview({
        validation,
        rawContent: content,
        fileName: file.name
      });
    };
    reader.readAsText(file);
  };

  // Confirm and execute backup restoration
  const handleConfirmRestore = () => {
    if (!restorePreview) return;
    try {
      const result = marketDataService.restoreDatasetBackup(restorePreview.rawContent);
      setRestorePreview(null);
      setRestoreMessage({
        type: 'success',
        text: `${result.message} Workspace now has ${result.finalTotalStoredCount} observations across ${result.finalDistinctDatesCount} trading dates (${result.finalDateRange.start} → ${result.finalDateRange.end}).`
      });
      onDatasetChanged();
      setActiveTab('current');
    } catch (err: any) {
      setRestoreMessage({
        type: 'error',
        text: err.message || 'Dataset restore failed.'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-900 text-amber-400 font-mono">
              Priority One
            </span>
            <span className="text-xs text-slate-500 font-medium">Market Data Pipeline & Provenance Audit</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 font-mono">
            Data Lab & Provenance
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Ingest Bhavcopy CSV files, preview and map columns, inspect validation and rejections, compute cryptographic SHA-256 fingerprints, and track transparent provenance across all analytical engines.
          </p>
        </div>

        {/* Header Action: Reset to Simulation */}
        <div className="flex items-center gap-2 self-start flex-wrap">
          <button
            onClick={handleResetToSimulation}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 border border-slate-300 font-mono shadow-xs cursor-pointer"
            title="Restore default calibrated prototype simulation"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset to Simulation</span>
          </button>
        </div>
      </div>

      {/* Contextual Beginner Guide Link */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-slate-700 leading-relaxed">
            <strong className="text-slate-900">New to AUREX?</strong> If you are exploring for the first time, click <strong className="text-amber-950 font-mono">Explore Demo Data</strong> to test the analytical pipeline immediately without preparing a custom file.
          </div>
        </div>
        <button
          onClick={() => onNavigate('overview')}
          className="text-amber-800 hover:text-amber-950 font-mono font-bold text-xs flex items-center gap-1 shrink-0 self-start sm:self-auto underline"
        >
          <span>View 5-Step Workflow Guide</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Alert when IMPORTED mode has 0 records */}
      {effectiveMode === 'IMPORTED_ONLY' && importedStoredCount === 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold font-mono text-amber-950">
                No Imported Market Observations Found in Browser Storage
              </div>
              <p className="text-amber-900 leading-relaxed">
                AUREX is in <span className="font-mono font-bold">IMPORTED</span> mode, but no historical Bhavcopy records are stored in this browser session. Click <strong className="text-amber-950">Load 60-Session Historical Dataset</strong> to immediately restore the authentic 1,440 MCX Bhavcopy observations (July 31 – Oct 23, 2026), or upload your Bhavcopy CSV files.
              </p>
            </div>
          </div>
          <button
            onClick={handleLoadHistoricalDataset}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-mono font-bold rounded-lg text-xs shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Load 60 Sessions (1,440 Obs)</span>
          </button>
        </div>
      )}

      {/* Active Dataset Ingestion & Quality Summary Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Database className="w-4 h-4 text-amber-600 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">
              Dataset Ingestion & Quality Summary
            </h3>
            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] shrink-0 ${
              effectiveMode === 'IMPORTED_ONLY' ? 'bg-sky-100 text-sky-800 border border-sky-300' :
              effectiveMode === 'PROTOTYPE_ONLY' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
              'bg-slate-100 text-slate-800 border border-slate-300'
            }`}>
              {effectiveMode}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 break-words min-w-0 flex items-center gap-1.5 flex-wrap">
            <span>Provenance: <strong className="text-slate-800">{activeProvenance}</strong></span>
            {activeMetadata.isUserAttested && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-300">
                USER ATTESTATION RECORDED — NOT INDEPENDENTLY VERIFIED
              </span>
            )}
          </div>
        </div>

        {/* 5-Column Responsive Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* 1. Parsed Source Rows */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 min-w-0">
            <div className="text-[10px] uppercase font-mono font-semibold tracking-wider text-slate-500 truncate" title="Parsed Source Rows">
              Parsed Source Rows
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 mt-1">
              {parsedSourceRows.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 font-sans mt-0.5 leading-tight">
              Total rows read from raw CSVs
            </div>
          </div>

          {/* 2. Accepted Observations */}
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3 min-w-0">
            <div className="text-[10px] uppercase font-mono font-semibold tracking-wider text-emerald-800 truncate" title="Accepted Observations">
              Accepted Observations
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-900 mt-1">
              {activeMetadata.validRows.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-700 font-sans mt-0.5 leading-tight">
              Cleaned gold futures records
            </div>
          </div>

          {/* 3. Quarantined / Rejected Rows */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 min-w-0">
            <div className="text-[10px] uppercase font-mono font-semibold tracking-wider text-slate-500 truncate" title="Quarantined Rows">
              Quarantined Rows
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-rose-700 mt-1">
              {(activeMetadata.rejectedRows || 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 font-sans mt-0.5 leading-tight">
              Non-gold commodities & options
            </div>
          </div>

          {/* 4. Source Files */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 min-w-0">
            <div className="text-[10px] uppercase font-mono font-semibold tracking-wider text-slate-500 truncate" title="Source Files">
              Source Files
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 mt-1">
              {sourceFilesCount}
            </div>
            <div className="text-[10px] text-slate-500 font-sans mt-0.5 leading-tight">
              Distinct Bhavcopy CSV files
            </div>
          </div>

          {/* 5. Trading Dates */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 min-w-0 col-span-2 sm:col-span-1">
            <div className="text-[10px] uppercase font-mono font-semibold tracking-wider text-slate-500 truncate" title="Trading Dates">
              Trading Dates
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 mt-1">
              {modeDistinctDates.length}
            </div>
            <div className="text-[10px] text-slate-600 font-mono mt-0.5 truncate" title={formattedDateRange}>
              {formattedDateRange}
            </div>
          </div>
        </div>

        {/* Action Controls Bar - Cleanly separated and wrapping */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {activeMetadata.isUserAttested ? (
              <button
                onClick={handleRevokeAttestation}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-mono transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Revoke user attestation note"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Revoke Attestation</span>
              </button>
            ) : (activeProvenance === 'USER-IMPORTED DATA — SOURCE UNVERIFIED' || activeProvenance === 'HYBRID / MIXED PROVENANCE') && (
              <button
                onClick={() => setShowAttestationModal(true)}
                className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg text-xs font-mono font-medium transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Record user assertion of source origin (not independently verified)"
              >
                <FileText className="w-3.5 h-3.5 text-teal-700" />
                <span>Source Attestation</span>
              </button>
            )}

            <button
              onClick={handleDownloadDatasetBackup}
              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-mono font-medium transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Download complete historical dataset backup JSON (observations, dates, expiries, source metadata)"
            >
              <Download className="w-3.5 h-3.5 text-amber-700" />
              <span>Backup Dataset (JSON)</span>
            </button>

            <button
              onClick={handleTriggerRestoreBackup}
              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-lg text-xs font-mono font-medium transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Upload and restore a verified AUREX dataset backup JSON file"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-700" />
              <span>Restore Backup (JSON)</span>
            </button>

            <button
              onClick={handleDownloadDataReport}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-mono transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Download comprehensive quality audit with cryptographic digest and provenance"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Audit JSON</span>
            </button>

            {marketDataService.hasPersistedData() && (
              <button
                onClick={handleClearLocalStorage}
                className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-mono transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Clear dataset stored in browser localStorage and reset"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Clear Stored Data</span>
              </button>
            )}
          </div>
        </div>

        {/* Single Concise Source-Verification Warning */}
        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5 font-mono">
          <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>
            {effectiveMode === 'PROTOTYPE_ONLY'
              ? 'Notice: Operating on calibrated prototype simulation records for architectural demonstration.'
              : effectiveMode === 'IMPORTED_ONLY'
              ? 'Notice: User-imported datasets reflect local client files and are not independently verified by exchange authority.'
              : 'Notice: Multi-source dataset with strict single-provenance quarantine for all statistical distributions.'}
          </span>
        </div>
      </div>

      {/* Dataset Backup & Restore Feedback Banner */}
      {restoreMessage && (
        <div className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between gap-2 shadow-xs ${
          restoreMessage.type === 'success'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          <div className="flex items-center gap-2">
            {restoreMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{restoreMessage.text}</span>
          </div>
          <button
            onClick={() => setRestoreMessage(null)}
            className="text-[11px] underline opacity-75 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hidden file input for Dataset Backup JSON */}
      <input
        ref={backupFileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleBackupFileSelected}
        className="hidden"
        id="backup-json-file-upload"
      />

      {/* CSV / Bhavcopy Upload & Drag-and-Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-white border-2 border-dashed rounded-xl p-5 sm:p-6 text-center transition-colors shadow-xs ${
          isDragging ? 'border-amber-500 bg-amber-50/50' : 'border-slate-300 hover:border-amber-500'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,text/csv,.bhavcopy,.txt,application/json,.json"
          onChange={handleFileChange}
          className="hidden"
          id="csv-file-upload"
        />
        <div className="max-w-xl mx-auto space-y-3.5">
          <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-200 mx-auto flex items-center justify-center text-amber-700">
            <Database className="w-5 h-5" />
          </div>

          <div>
            <h3 className="text-sm font-bold font-mono text-slate-900">
              Data Sourcing & Ingestion Lab
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-lg mx-auto mt-1">
              Upload MCX Bhavcopy CSV files (single or multi-file batch) or JSON dataset backups to analyze historical market data. Or restore the 60-session historical dataset with 1 click.
            </p>
          </div>

          {/* Action Buttons: 60-Session Historical Dataset, Demo Data, and File Upload */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1 flex-wrap">
            <button
              onClick={handleLoadHistoricalDataset}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-sm font-mono transition-colors cursor-pointer"
              title="Loads the complete 60-session historical MCX Bhavcopy dataset (1,440 observations, July 31 - Oct 23, 2026)"
            >
              <Database className="w-4 h-4 text-white" />
              <span>Load 60-Session Historical Dataset</span>
            </button>

            <button
              onClick={handleLoadBundledSample}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shadow-sm font-mono transition-colors cursor-pointer"
            >
              <Database className="w-4 h-4 text-slate-950" />
              <span>Explore Demo Sample</span>
            </button>

            <label
              htmlFor="csv-file-upload"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-lg text-xs cursor-pointer shadow-sm font-mono transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Bhavcopy CSVs (Batch Supported)</span>
            </label>
          </div>

          {isProcessingBatch && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-2.5 text-xs font-mono font-bold text-amber-900 animate-pulse">
              {batchProgress}
            </div>
          )}

          <div className="text-[11px] text-slate-500">
            or drag and drop multiple CSV / Bhavcopy / JSON files here
          </div>

          {/* 4-step upload explanation */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-600 grid grid-cols-2 sm:grid-cols-4 gap-2 text-left font-mono">
            <div><span className="font-bold text-slate-900">1. Select Files:</span> Single or batch CSVs</div>
            <div><span className="font-bold text-slate-900">2. Auto-Detect:</span> Columns & JSON auto-detected</div>
            <div><span className="font-bold text-slate-900">3. Review:</span> Check validation & rejections</div>
            <div><span className="font-bold text-slate-900">4. Confirm:</span> Ingest for analysis</div>
          </div>

          <div className="pt-1">
            <button
              onClick={handleDownloadSampleCsv}
              className="text-xs text-slate-600 hover:text-slate-900 underline inline-flex items-center gap-1 font-mono"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Download sample Bhavcopy template (.csv)</span>
            </button>
          </div>
        </div>
      </div>


      {/* Parsing error display if any */}
      {parseError && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-start gap-2">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">CSV Ingestion Notice:</strong> {parseError}
          </div>
        </div>
      )}

      {/* Tab Navigation for Data Lab Details */}
      <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto flex-nowrap sm:flex-wrap">
        <button
          onClick={() => setActiveTab('current')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'current'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Active Dataset Coverage ({activeMetadata.validRows} rows in {effectiveMode})</span>
        </button>

        {parsePreview && (
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'preview'
                ? 'border-amber-500 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Upload Preview ({parsePreview.validRecords.length} parsed)</span>
          </button>
        )}

        {parsePreview && parsePreview.rejectedRows.length > 0 && (
          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'rejected'
                ? 'border-amber-500 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Rejected Records ({parsePreview.rejectedRows.length})</span>
          </button>
        )}
      </div>

      {/* TAB 1: Current Dataset Contract Coverage Matrix */}
      {activeTab === 'current' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 shrink-0">
                Discrete Contract Coverage Matrix ({effectiveMode})
              </h3>
              <div className="text-[11px] font-mono text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Mode Valid: <strong className="text-slate-800">{activeMetadata.validRows}</strong></span>
                <span className="text-slate-300">•</span>
                <span>Total Stored: <strong className="text-slate-800">{totalStoredRecords}</strong></span>
                <span className="text-slate-300">•</span>
                <span>Dates in Mode: <strong className="text-slate-800">{modeDistinctDates.length}</strong></span>
                <span className="text-slate-300">•</span>
                <span>Files: <strong className="text-slate-800">{activeMetadata.sourceFiles ? activeMetadata.sourceFiles.length : (effectiveMode === 'IMPORTED_ONLY' ? (importedStoredCount > 0 ? 1 : 0) : 1)}</strong></span>
                <span className="text-slate-300">•</span>
                <span>Duplicates Skipped: <strong className="text-slate-800">{activeMetadata.duplicateCount}</strong></span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-mono uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Contract Symbol</th>
                    <th className="py-2.5 px-4">Observations</th>
                    <th className="py-2.5 px-4">Earliest Date</th>
                    <th className="py-2.5 px-4">Latest Date</th>
                    <th className="py-2.5 px-4">Monitored Expiries</th>
                    <th className="py-2.5 px-4">Lifecycle Integrity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                  {(['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'] as ContractSymbol[]).map((sym) => {
                    const cov = activeMetadata.contractCoverage[sym] || { count: 0, earliestDate: 'N/A', latestDate: 'N/A', expiries: [] };
                    return (
                      <tr key={sym} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {sym}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold">
                            {cov.count} rows
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{cov.earliestDate || 'N/A'}</td>
                        <td className="py-3 px-4 text-slate-600">{cov.latestDate || 'N/A'}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {cov.expiries.map((exp, eIdx) => (
                              <span key={eIdx} className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {exp}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Discrete Lifecycle</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Multi-File Provenance Accumulation Card */}
          {activeMetadata.sourceFiles && activeMetadata.sourceFiles.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 shrink-0">
                  <Database className="w-3.5 h-3.5 text-slate-600" />
                  Historical Source Files ({activeMetadata.sourceFiles.length} Ingested File{activeMetadata.sourceFiles.length === 1 ? '' : 's'})
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {modeDistinctDates.length} Distinct Trading Date{modeDistinctDates.length === 1 ? '' : 's'} in {effectiveMode}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">File Name</th>
                      <th className="py-2 px-3">Trading Dates</th>
                      <th className="py-2 px-3">Valid Observations</th>
                      <th className="py-2 px-3">SHA-256 Digest</th>
                      <th className="py-2 px-3">Ingested At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {activeMetadata.sourceFiles.map((f, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-900">{f.filename}</td>
                        <td className="py-2 px-3 text-slate-700">{f.dateRange.start} → {f.dateRange.end}</td>
                        <td className="py-2 px-3 font-semibold text-emerald-700">{f.validRows} rows</td>
                        <td className="py-2 px-3 text-slate-500 text-[11px] font-mono" title={f.fileHashSha256}>
                          {f.fileHashSha256.slice(0, 16)}...
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">
                          {f.importTimestamp ? f.importTimestamp.slice(0, 19).replace('T', ' ') : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Known Data Limitations Panel */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 font-mono">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Data Provenance & Quantitative Limitations
            </h4>

            {/* Separate Guidance for Each Dataset Type */}
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="text-[11px] font-mono font-bold text-slate-700 uppercase">
                Dataset Classification Criteria:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="font-bold text-amber-800 font-mono">PROTOTYPE SIMULATION:</span>
                  <span className="text-slate-600 ml-1">Generated or calibrated demonstration values, not actual MCX market observations.</span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="font-bold text-indigo-800 font-mono">PROTOTYPE SAMPLE — UNVERIFIED SOURCING:</span>
                  <span className="text-slate-600 ml-1">Bundled illustrative data whose official source has not been verified.</span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="font-bold text-sky-800 font-mono">USER-IMPORTED DATA — SOURCE UNVERIFIED:</span>
                  <span className="text-slate-600 ml-1">Imported CSV whose origin has not been independently verified.</span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="font-bold text-teal-800 font-mono">USER ATTESTATION RECORDED — NOT INDEPENDENTLY VERIFIED:</span>
                  <span className="text-slate-600 ml-1">A user origin assertion recorded for local audit trail. Does NOT replace or upgrade source-unverified provenance.</span>
                </div>
              </div>
            </div>

            <div className="pt-1">
              <div className="text-[11px] font-mono font-bold text-slate-700 uppercase mb-1">
                Active Dataset Known Constraints:
              </div>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-5">
                {(activeMetadata.knownLimitations || metadata.knownLimitations).map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Upload Preview & Confirmation */}
      {activeTab === 'preview' && parsePreview && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold font-mono text-slate-900">
                Ready to Import: {parsePreview.metadata.validRows} Valid Records
              </h3>
              <p className="text-xs text-slate-500">
                File: {parsePreview.metadata.filename} • Rejected: {parsePreview.metadata.rejectedRows} rows
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                disabled={parsePreview.mergeAnalysis && parsePreview.mergeAnalysis.conflictingCount > 0}
                onClick={() => handleConfirmImport(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-lg text-xs transition-colors shadow-sm font-mono flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {parsePreview.mergeAnalysis?.isAccumulating
                    ? `Confirm & Merge (+${parsePreview.mergeAnalysis.newlyInsertedCount} New Records)`
                    : 'Confirm & Ingest Dataset'}
                </span>
              </button>
              {parsePreview.mergeAnalysis && parsePreview.mergeAnalysis.conflictingCount > 0 && (
                <button
                  onClick={() => handleConfirmImport(true)}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm font-mono cursor-pointer"
                >
                  Force Overwrite
                </button>
              )}
            </div>
          </div>

          {/* Explicit Merge Summary Card */}
          {parsePreview.mergeAnalysis && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
                <span className="font-bold text-slate-900 uppercase text-[11px] flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-amber-600" />
                  Pre-Import Merge & Accumulation Analysis
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  parsePreview.mergeAnalysis.isAccumulating ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {parsePreview.mergeAnalysis.isAccumulating ? 'ACCUMULATING INTO ACTIVE HISTORY' : 'INITIALIZING NEW HISTORICAL DATASET'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <div className="text-slate-500 text-[10px]">SOURCE FILE</div>
                  <div className="font-bold text-slate-900 truncate" title={parsePreview.mergeAnalysis.sourceFilename}>
                    {parsePreview.mergeAnalysis.sourceFilename}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <div className="text-slate-500 text-[10px]">DETECTED DATES</div>
                  <div className="font-bold text-slate-900 truncate" title={parsePreview.mergeAnalysis.detectedTradingDates.join(', ')}>
                    {parsePreview.mergeAnalysis.detectedTradingDates.length > 0
                      ? parsePreview.mergeAnalysis.detectedTradingDates.join(', ')
                      : 'None'}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <div className="text-slate-500 text-[10px]">VALID FUTURES (FUTCOM)</div>
                  <div className="font-bold text-emerald-700">
                    {parsePreview.mergeAnalysis.validFuturesInSource} rows
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <div className="text-slate-500 text-[10px]">NEWLY INSERTED</div>
                  <div className="font-bold text-emerald-700">
                    +{parsePreview.mergeAnalysis.newlyInsertedCount} rows
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <div className="text-slate-500 text-[10px]">UNCHANGED DUPLICATES</div>
                  <div className="font-bold text-slate-700">
                    {parsePreview.mergeAnalysis.unchangedDuplicatesCount} rows
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <div className="text-slate-500 text-[10px]">CONFLICTING RECORDS</div>
                  <div className={`font-bold ${parsePreview.mergeAnalysis.conflictingCount > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                    {parsePreview.mergeAnalysis.conflictingCount} rows
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <div className="text-slate-500 text-[10px]">QUARANTINED OPTIONS</div>
                  <div className="font-bold text-amber-700">
                    {parsePreview.mergeAnalysis.unsupportedInstrumentCount} rows
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <div className="text-slate-500 text-[10px]">PROJECTED DATASET SIZE</div>
                  <div className="font-bold text-sky-800">
                    {parsePreview.mergeAnalysis.projectedTotalRecords} total records
                  </div>
                </div>
              </div>

              {parsePreview.mergeAnalysis.conflictingCount > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Conflict Detected: Data Divergence on Existing Expiries
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {parsePreview.mergeAnalysis.conflictingCount} record(s) in this file match existing contract expiries but have conflicting settlement marks. Automatic import is blocked to prevent silent overwriting.
                  </p>
                  <div className="mt-2 text-[10px] bg-white p-2 rounded border border-rose-200 space-y-1">
                    {parsePreview.mergeAnalysis.conflictingObservations.map((c, i) => (
                      <div key={i}>{c.symbol} on {c.date} (Exp: {c.expiryDate}): {c.difference}</div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200 flex-wrap gap-2">
                <span>Resulting Date Range: <strong>{parsePreview.mergeAnalysis.projectedDateRange.start} → {parsePreview.mergeAnalysis.projectedDateRange.end}</strong></span>
                <span>Provenance: <strong>USER-IMPORTED DATA — SOURCE UNVERIFIED</strong></span>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-mono font-bold text-slate-700">
              Parsed Observation Samples (First 10 records)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-3">Expiry</th>
                    <th className="py-2 px-3">Close Price</th>
                    <th className="py-2 px-3">Volume</th>
                    <th className="py-2 px-3">Open Interest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {parsePreview.validRecords.slice(0, 10).map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3">{r.date}</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{r.symbol}</td>
                      <td className="py-2 px-3">{r.expiryDate}</td>
                      <td className="py-2 px-3 font-semibold">₹{r.close.toLocaleString('en-IN')}</td>
                      <td className="py-2 px-3 text-slate-600">{r.volume.toLocaleString('en-IN')}</td>
                      <td className="py-2 px-3 text-slate-600">{r.openInterest.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Rejected Rows Inspector */}
      {activeTab === 'rejected' && parsePreview && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1">
            <h4 className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Rejection Inspector ({parsePreview.rejectedRows.length} Rows Filtered Out)
            </h4>
            <p>
              The AUREX validation pipeline rejects records with invalid dates, unsupported commodity symbols, negative prices, or missing expiries to prevent look-ahead or corrupted calculations.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Row #</th>
                    <th className="py-2.5 px-3">Rejection Reason</th>
                    <th className="py-2.5 px-3">Raw Content</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {parsePreview.rejectedRows.slice(0, 100).map((rej, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-bold text-rose-700">Line {rej.rowNumber}</td>
                      <td className="py-2 px-3 text-rose-800">{rej.reason}</td>
                      <td className="py-2 px-3 text-slate-500 text-[11px] max-w-md truncate">
                        {JSON.stringify(rej.raw)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsePreview.rejectedRows.length > 100 && (
              <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 font-mono text-center">
                Showing first 100 of {parsePreview.rejectedRows.length.toLocaleString()} quarantined rows. All {parsePreview.rejectedRows.length.toLocaleString()} rows are preserved in parser metadata.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Explicit User Source Attestation Modal */}
      {showAttestationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm font-mono">
                  Record User Source Attestation
                </h3>
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-2 mt-1 leading-relaxed">
                  <strong>Quantitative & Regulatory Integrity Notice:</strong> A user attestation is a personal provenance note. It <strong>never constitutes independent authentication</strong> by MCX, SEBI, or any exchange authority. It <strong>does NOT change unverified data into verified data</strong>, and <strong>does NOT bypass the Decision Engine source-integrity gate or WATCH precaution</strong>. The dataset remains strictly unverified.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1 font-mono text-[11px]">
                <div>File: <strong className="text-slate-900 truncate block max-w-xs">{activeMetadata.filename}</strong></div>
                <div>Imported at: {activeMetadata.importTimestamp}</div>
                <div>Date Range: {activeMetadata.dateRange.start} → {activeMetadata.dateRange.end}</div>
                <div>Observations: {activeMetadata.validRows} valid rows</div>
                <div className="text-slate-600 text-[10px] pt-1 border-t border-slate-200 mt-1">
                  Underlying Source Provenance: <span className="font-bold text-sky-800">USER-IMPORTED DATA — SOURCE UNVERIFIED</span>
                </div>
                <div className="text-slate-600 text-[10px]">
                  Attestation Status: <span className="font-bold text-teal-800">USER ATTESTATION RECORDED — NOT INDEPENDENTLY VERIFIED</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  User Origin Reference / Notes:
                </label>
                <input
                  type="text"
                  value={attestationNotesInput}
                  onChange={(e) => setAttestationNotesInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono focus:border-teal-600 focus:outline-none"
                  placeholder="e.g. Downloaded from MCX official bhavcopy archive"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAttestationModal(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordAttestation}
                className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded text-xs font-mono flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save Attestation Note (Remains Unverified)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dataset Backup Restore Confirmation Modal */}
      {restorePreview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm font-mono">
                  Restore Dataset Backup
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Verify backup metadata before restoring to your local workspace.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">File:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[260px]">{restorePreview.fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Schema Version:</span>
                  <span className="font-bold text-slate-900">{restorePreview.validation.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Observations in Backup:</span>
                  <span className="font-bold text-indigo-700">{restorePreview.validation.validRecordsCount.toLocaleString()} rows</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Trading Dates:</span>
                  <span className="font-bold text-slate-900">{restorePreview.validation.detectedTradingDates.length} distinct dates</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date Range:</span>
                  <span className="text-slate-700">{restorePreview.validation.dateRange.start} → {restorePreview.validation.dateRange.end}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Source Provenance:</span>
                  <span className="font-bold text-slate-800">{restorePreview.validation.provenance}</span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded p-2.5 text-[11px] text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Validation Passed — Safe Restore</span>
                </div>
                <p className="text-[10px] text-emerald-800 leading-relaxed font-sans">
                  Existing dataset records will be strictly preserved. Genuinely new records will be accumulated into browser localStorage. Any unchanged duplicate rows will be safely skipped.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setRestorePreview(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs font-mono flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm & Restore</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
