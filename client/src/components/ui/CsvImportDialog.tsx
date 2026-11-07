import React, { useState } from 'react';
import { Upload, X, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { Button } from './Button';
import { parseCsv } from '../../lib/csv';

export interface CsvImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  expectedColumns: string[];
  onConfirmImport: (records: Record<string, string>[]) => Promise<void> | void;
  validateRow?: (row: Record<string, string>, index: number) => string | null;
}

export const CsvImportDialog: React.FC<CsvImportDialogProps> = ({
  isOpen,
  onClose,
  title,
  expectedColumns,
  onConfirmImport,
  validateRow
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<{ rowIdx: number; message: string }[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const parsed = parseCsv(content);
      setHeaders(parsed.headers);
      setRows(parsed.rows);

      // Validate rows
      const validationErrors: { rowIdx: number; message: string }[] = [];
      parsed.rows.forEach((row, idx) => {
        if (validateRow) {
          const err = validateRow(row, idx);
          if (err) validationErrors.push({ rowIdx: idx + 1, message: err });
        }
      });
      setErrors(validationErrors);
    };
    reader.readAsText(selectedFile);
  };

  const handleConfirm = async () => {
    if (rows.length === 0 || errors.length > 0) return;
    setIsImporting(true);
    try {
      await onConfirmImport(rows);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Expected columns note */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Required CSV Columns: </span>
          <span className="font-mono text-indigo-700">{expectedColumns.join(', ')}</span>
        </div>

        {/* File drop area */}
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors">
          <input
            type="file"
            accept=".csv"
            id="csv-file-input"
            className="hidden"
            onChange={handleFileChange}
          />
          <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center gap-2">
            <FileText className="w-8 h-8 text-slate-400" />
            <span className="text-xs font-semibold text-indigo-600">
              {file ? file.name : 'Click to select CSV file'}
            </span>
            <span className="text-[11px] text-slate-400">Comma-separated values (.csv)</span>
          </label>
        </div>

        {/* Preview and Validation */}
        {rows.length > 0 && (
          <div className="space-y-3 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Preview ({rows.length} rows detected)</span>
              {errors.length > 0 ? (
                <span className="text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.length} validation issues
                </span>
              ) : (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All rows valid
                </span>
              )}
            </div>

            {errors.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 space-y-1 max-h-24 overflow-y-auto font-mono">
                {errors.slice(0, 5).map((e, idx) => (
                  <div key={idx}>Row {e.rowIdx}: {e.message}</div>
                ))}
                {errors.length > 5 && <div>...and {errors.length - 5} more errors</div>}
              </div>
            )}

            {/* First 3 rows table preview */}
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[11px] text-slate-500 uppercase">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="py-2 px-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {rows.slice(0, 3).map((r, i) => (
                    <tr key={i}>
                      {headers.map((h, j) => (
                        <td key={j} className="py-1.5 px-3 truncate max-w-[150px]">{r[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={rows.length === 0 || errors.length > 0 || isImporting}
          >
            {isImporting ? 'Importing...' : `Confirm Import (${rows.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
};
