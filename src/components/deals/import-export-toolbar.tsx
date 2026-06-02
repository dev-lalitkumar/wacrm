'use client';

import { useState } from 'react';
import { Download, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DealImportModal } from './deal-import-modal';
import { downloadCSV } from '@/lib/export/csv';
import { toast } from 'sonner';
import type { DealFilters } from '@/lib/export/deals-query';

interface DealImportExportToolbarProps {
  filters: DealFilters;
  onImported?: () => void;
  exportOnly?: boolean; // closed-deals page doesn't show Import
}

/**
 * Import + Export buttons for the Deals surfaces.
 * Export always uses the currently-active filters so the CSV matches
 * exactly what the user sees on screen.
 */
export function DealImportExportToolbar({
  filters,
  onImported,
  exportOnly = false,
}: DealImportExportToolbarProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.statusTab) params.set('status_tab', filters.statusTab);
      if (filters.search) params.set('search', filters.search);
      if (filters.reminderTab && filters.reminderTab !== 'all') {
        params.set('reminder_tab', filters.reminderTab);
      }
      (filters.assigneeFilter ?? []).forEach((id) => params.append('assignee', id));
      (filters.lostReasonFilter ?? []).forEach((id) => params.append('lost_reason', id));

      const res = await fetch(`/api/deals/export?${params.toString()}`);
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Export failed' }));
        toast.error(error ?? 'Export failed');
        return;
      }

      const csv = await res.text();
      const date = new Date().toISOString().slice(0, 10);
      const suffix = filters.statusTab && filters.statusTab !== 'all'
        ? `-${filters.statusTab}`
        : '';
      downloadCSV(`deals${suffix}-${date}.csv`, csv);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {!exportOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="gap-1.5"
          >
            <Upload className="size-3.5" />
            Import
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting}
          className="gap-1.5"
        >
          {exporting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          Export
        </Button>
      </div>

      <DealImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          onImported?.();
        }}
      />
    </>
  );
}
