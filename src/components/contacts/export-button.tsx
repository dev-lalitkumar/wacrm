'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadCSV } from '@/lib/export/csv';
import { toast } from 'sonner';

interface ContactExportButtonProps {
  search: string;
  assigneeFilter: string[];
  reminderTab: string;
  tagIds?: string[];
  activeFilters?: Record<string, string[]>;
}

/**
 * Exports the currently-filtered contacts list as a CSV.
 * Passes the exact same filter params the list page uses so the exported
 * rows always match what the user sees on screen.
 */
export function ContactExportButton({
  search,
  assigneeFilter,
  reminderTab,
  tagIds = [],
  activeFilters = {},
}: ContactExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (reminderTab && reminderTab !== 'all') params.set('reminder_tab', reminderTab);
      assigneeFilter.forEach((id) => params.append('assignee', id));
      tagIds.forEach((id) => params.append('tags', id));
      Object.entries(activeFilters).forEach(([fieldId, values]) => {
        values.forEach((v) => params.append(`cf_${fieldId}`, v));
      });

      const res = await fetch(`/api/contacts/export?${params.toString()}`);
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Export failed' }));
        toast.error(error ?? 'Export failed');
        return;
      }

      const csv = await res.text();
      const date = new Date().toISOString().slice(0, 10);
      downloadCSV(`contacts-${date}.csv`, csv);
    } catch {
      toast.error('Export failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className="gap-1.5"
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Download className="size-3.5" />
      )}
      Export
    </Button>
  );
}
