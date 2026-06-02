'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, CheckCircle, XCircle, Download } from 'lucide-react';
import { generateSampleCSV, downloadCSV } from '@/lib/export/csv';

interface DealImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface ParsedRow {
  title: string;
  contact_phone: string;
  value?: string;
  currency?: string;
  stage_name?: string;
  expected_close_date?: string;
  notes?: string;
  assigned_to_email?: string;
  [key: string]: string | undefined;
}

/** Parse CSV text into an array of row objects keyed by header name. */
function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().replace(/^["']|["']$/g, ''));

  const titleIdx = headers.findIndex((h) => h.toLowerCase() === 'title');
  const phoneIdx = headers.findIndex((h) => h.toLowerCase() === 'contact_phone');

  if (titleIdx === -1 || phoneIdx === -1) return { headers, rows: [] };

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple quoted-field CSV parser
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const title = values[titleIdx]?.replace(/^["']|["']$/g, '').trim();
    const phone = values[phoneIdx]?.replace(/^["']|["']$/g, '').trim();
    if (!title || !phone) continue;

    const row: ParsedRow = { title, contact_phone: phone };
    headers.forEach((h, idx) => {
      if (idx !== titleIdx && idx !== phoneIdx) {
        const val = values[idx]?.replace(/^["']|["']$/g, '').trim();
        if (val) row[h] = val;
      }
    });
    rows.push(row);
  }

  return { headers, rows };
}

const SAMPLE_COLUMNS = [
  { name: 'title', example: 'Enterprise Deal - Acme Corp' },
  { name: 'contact_phone', example: '+1234567890' },
  { name: 'value', example: '5000' },
  { name: 'currency', example: 'USD' },
  { name: 'stage_name', example: 'Qualified' },
  { name: 'expected_close_date', example: '2026-09-30' },
  { name: 'notes', example: 'Met at conference' },
  { name: 'assigned_to_email', example: 'rep@company.com' },
];

export function DealImportModal({ open, onOpenChange, onImported }: DealImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    failed: number;
    errors: { row: number; reason: string }[];
  } | null>(null);

  function handleReset() {
    setStep('upload');
    setParsedRows([]);
    setParsedHeaders([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      if (rows.length === 0) {
        toast.error(
          headers.length === 0
            ? 'Could not parse CSV. Ensure the file has a header row with at least "title" and "contact_phone" columns.'
            : 'No valid rows found. Each row needs a title and contact_phone.',
        );
        return;
      }
      setParsedHeaders(headers);
      setParsedRows(rows);
      setStep('preview');
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setImporting(true);
    try {
      const res = await fetch('/api/deals/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Import failed');
        setImporting(false);
        return;
      }
      setResult(data);
      setStep('result');
      if (data.imported > 0) {
        onImported();
        toast.success(`${data.imported} deal${data.imported !== 1 ? 's' : ''} imported`);
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setImporting(false);
    }
  }

  function handleSampleDownload() {
    downloadCSV('deals-sample.csv', generateSampleCSV(SAMPLE_COLUMNS));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleReset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl border-slate-800 bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-white">Import Deals</DialogTitle>
          <DialogDescription className="text-slate-400">
            Upload a CSV to bulk-import deals. Each row must reference an
            existing contact by phone number.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/50 p-10 transition hover:border-slate-500"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mb-3 size-8 text-slate-500" />
              <p className="text-sm font-medium text-slate-300">
                Click to upload a CSV file
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Required columns: <code>title</code>, <code>contact_phone</code>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Download className="size-4 shrink-0" />
              <span>Not sure about the format?</span>
              <button
                type="button"
                onClick={handleSampleDownload}
                className="text-primary hover:underline"
              >
                Download sample CSV
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300">
              <FileText className="size-4 shrink-0 text-slate-500" />
              <span>
                {parsedRows.length} deal{parsedRows.length !== 1 ? 's' : ''} ready to import
              </span>
            </div>

            {/* Preview first 5 rows */}
            <div className="overflow-auto rounded-lg border border-slate-700">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-800">
                  <tr>
                    {parsedHeaders.slice(0, 6).map((h) => (
                      <th
                        key={h}
                        className="border-b border-slate-700 px-3 py-2 text-left font-medium text-slate-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      {parsedHeaders.slice(0, 6).map((h) => (
                        <td key={h} className="max-w-[140px] truncate px-3 py-2 text-slate-300">
                          {row[h] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 5 && (
                <p className="px-3 py-2 text-xs text-slate-500">
                  …and {parsedRows.length - 5} more row{parsedRows.length - 5 !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
              {result.failed === 0 ? (
                <CheckCircle className="size-5 text-green-400" />
              ) : (
                <XCircle className="size-5 text-amber-400" />
              )}
              <div className="text-sm">
                <p className="font-medium text-white">
                  {result.imported} imported
                  {result.failed > 0 ? `, ${result.failed} failed` : ''}
                </p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
                {result.errors.slice(0, 20).map((e, i) => (
                  <p key={i}>Row {e.row}: {e.reason}</p>
                ))}
                {result.errors.length > 20 && (
                  <p className="mt-1 text-red-500/60">…and {result.errors.length - 20} more</p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={handleReset}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Import {parsedRows.length} deal{parsedRows.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
