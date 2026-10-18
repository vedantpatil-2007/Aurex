import React, { useState, useRef } from 'react';
import { 
  DatasetMetadata, 
  DataProvenance, 
  MarketObservation, 
  RejectedRow, 
  ContractSymbol 
} from '../types/market';
import { marketDataService } from '../services/marketDataService';
import { parseBhavcopyCsv, ParseResult, ColumnMapping, detectColumnMapping, tokenizeCsvLine } from '../services/csvParserService';
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
  Layers, 
  Table, 
  ShieldCheck, 
  Info,
  Calendar,
  FileText,
  Trash2
} from 'lucide-react';

interface DataLabProps {
  metadata: DatasetMetadata;
  provenance: DataProvenance;
  onDatasetChanged: () => void;
  onNavigate: (page: any) => void;
}

export const DataLab: React.FC<DataLabProps> = ({
  metadata,
  provenance,
  onDatasetChanged,
  onNavigate
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvRawText, setCsvRawText] = useState<string>('');
  const [parsePreview, setParsePreview] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'preview' | 'rejected' | 'mapping'>('current');
  const [customMapping, setCustomMapping] = useState<Partial<ColumnMapping>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvRawText(text);
      try {
        const preview = parseBhavcopyCsv(text, file.name, 'USER-IMPORTED MCX DATA');
        setParsePreview(preview);
        setCustomMapping(preview.columnMapping);
        setActiveTab('preview');
      } catch (err: any) {
        setParseError(err.message || 'Failed to parse CSV file.');
      }
    };
    reader.readAsText(file);
  };

  // Load bundled authentic official MCX Bhavcopy sample
  const handleLoadOfficialSample = () => {
    try {
      const res = marketDataService.loadOfficialSample();
      setParsePreview(res);
      setSelectedFile(null);
      setCsvRawText(SAMPLE_MCX_BHAVCOPY_CSV);
      onDatasetChanged();
      setActiveTab('current');
    } catch (err: any) {
      setParseError(err.message || 'Failed to load official sample dataset.');
    }
  };

  // Confirm and commit uploaded dataset into active memory
  const handleConfirmImport = () => {
    if (!csvRawText) return;
    try {
      marketDataService.importFromCsv(
        csvRawText,
        selectedFile ? selectedFile.name : 'imported_bhavcopy.csv',
        customMapping
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
    marketDataService.resetToSimulation();
    setParsePreview(null);
    setSelectedFile(null);
    setCsvRawText('');
    onDatasetChanged();
    setActiveTab('current');
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
      reportStatus: metadata.rejectedRows > 0 ? 'WARN' : 'PASS'
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

  return (
    <div className="space-y-6">
      {/* Title & Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-900 text-amber-400 font-mono">
              Priority One
            </span>
            <span className="text-xs text-slate-500 font-medium">Official Data Pipeline & Provenance</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 font-mono">
            Data Lab & Provenance
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Ingest official MCX Bhavcopy CSV files, preview and map columns, inspect validation and rejections, and verify provenance across all analytical engines.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={handleLoadOfficialSample}
            className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm font-mono"
            title="Load authentic pre-packaged MCX Bhavcopy CSV dataset"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Load Official Sample CSV</span>
          </button>
          <button
            onClick={handleResetToSimulation}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 border border-slate-300"
            title="Restore default calibrated prototype simulation"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset to Simulation</span>
          </button>
        </div>
      </div>

      {/* Provenance Status Banner */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        provenance === 'OFFICIAL MCX DATA' 
          ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
          : provenance === 'USER-IMPORTED MCX DATA'
          ? 'bg-sky-50 border-sky-300 text-sky-950'
          : 'bg-amber-50 border-amber-300 text-amber-950'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
            provenance === 'OFFICIAL MCX DATA'
              ? 'bg-emerald-600 text-white'
              : provenance === 'USER-IMPORTED MCX DATA'
              ? 'bg-sky-600 text-white'
              : 'bg-amber-600 text-white'
          }`}>
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-white/80 border shadow-sm">
                Active Source: {provenance}
              </span>
              <span className="text-xs text-slate-600 font-mono">
                {metadata.filename || 'internal'}
              </span>
            </div>
            <div className="text-xs text-slate-700 mt-0.5">
              {metadata.sourceClassification} • Date Range: {metadata.dateRange.start} to {metadata.dateRange.end} ({metadata.totalRows} observations)
            </div>
          </div>
        </div>

        <button
          onClick={handleDownloadDataReport}
          className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-mono font-medium shadow-sm transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-slate-600" />
          <span>Download Quality Audit</span>
        </button>
      </div>

      {/* CSV Upload / Drag-and-Drop Area */}
      <div className="bg-white border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl p-6 text-center transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="hidden"
          id="csv-file-upload"
        />
        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-500">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <label
              htmlFor="csv-file-upload"
              className="cursor-pointer text-sm font-bold text-amber-700 hover:text-amber-800 underline mr-1"
            >
              Choose MCX Bhavcopy CSV File
            </label>
            <span className="text-xs text-slate-500">or drag and drop here</span>
          </div>
          <p className="text-xs text-slate-500">
            Supports official MCX daily bhavcopy formats. Auto-detects columns: Date, Symbol, Expiry, Open, High, Low, Close, Volume, Open Interest.
          </p>
          <div className="flex items-center justify-center gap-3 pt-1">
            <button
              onClick={handleDownloadSampleCsv}
              className="text-xs text-slate-600 hover:text-slate-900 underline flex items-center gap-1 font-mono"
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
      <div className="border-b border-slate-200 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('current')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'current'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Active Dataset Coverage ({metadata.validRows} rows)</span>
        </button>

        {parsePreview && (
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
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
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
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
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                Discrete Contract Coverage Matrix
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                Total Rows: {metadata.totalRows} | Valid: {metadata.validRows} | Duplicates: {metadata.duplicateCount}
              </span>
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
                    const cov = metadata.contractCoverage[sym] || { count: 0, earliestDate: 'N/A', latestDate: 'N/A', expiries: [] };
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

          {/* Known Data Limitations Panel */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 font-mono">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Verified Data Provenance & Limitations
            </h4>
            <ul className="text-xs text-slate-600 space-y-1 list-disc pl-5">
              {metadata.knownLimitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
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
            <div className="flex items-center gap-2">
              <button
                onClick={handleConfirmImport}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm font-mono flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm & Ingest Dataset</span>
              </button>
            </div>
          </div>

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
              The AUREX validation pipeline rejects records with invalid dates, non-PS03 commodity symbols, negative prices, or missing expiries to prevent look-ahead or corrupted calculations.
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
                  {parsePreview.rejectedRows.map((rej, idx) => (
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
          </div>
        </div>
      )}
    </div>
  );
};
