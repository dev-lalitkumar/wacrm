'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Proposal, ProposalItem, Company } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Send,
  Eye,
  Download,
  Loader2,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { LineItemsTable } from './line-items-table';
import { ProposalPreview } from './proposal-preview';
import { SendProposalDialog } from './send-proposal-dialog';
import { ProposalHistory } from './proposal-history';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-700 text-slate-200',
  sent: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  viewed: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  accepted: 'bg-green-500/20 text-green-300 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 0 }).format(amount);
}

interface ProposalBuilderProps {
  proposalId: string;
}

export function ProposalBuilder({ proposalId }: ProposalBuilderProps) {
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/proposals/${proposalId}`),
        fetch('/api/company'),
      ]);
      if (!pRes.ok) throw new Error('Proposal not found');
      const [pData, cData] = await Promise.all([pRes.json(), cRes.ok ? cRes.json() : null]);
      setProposal(pData);
      setCompany(cData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load proposal');
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => { load(); }, [load]);

  function scheduleSave(updated: Proposal) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(() => persistSave(updated), 1000);
  }

  async function persistSave(updated: Proposal) {
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: updated.title,
          valid_until: updated.valid_until ?? null,
          notes: updated.notes ?? null,
          terms: updated.terms ?? null,
          discount_amount: updated.discount_amount,
          tax_rate: updated.tax_rate,
          items: updated.items ?? [],
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('idle');
      toast.error('Auto-save failed');
    }
  }

  function update(field: keyof Proposal, value: unknown) {
    if (!proposal) return;
    const updated = { ...proposal, [field]: value };
    setProposal(updated);
    scheduleSave(updated);
  }

  function updateItems(items: ProposalItem[]) {
    if (!proposal) return;
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const totalAmount = Math.max(0, subtotal - (proposal.discount_amount ?? 0) + subtotal * (proposal.tax_rate ?? 0) / 100);
    const updated = { ...proposal, items, subtotal, total_amount: totalAmount };
    setProposal(updated);
    scheduleSave(updated);
  }

  async function downloadPdf() {
    try {
      const res = await fetch(`/api/proposals/${proposalId}/pdf`);
      if (!res.ok) { toast.error('PDF generation failed'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${proposal?.proposal_number ?? 'proposal'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!proposal) {
    return <div className="flex items-center justify-center h-full text-slate-400">Proposal not found.</div>;
  }

  const contact = proposal.contact as { name?: string; email?: string; phone?: string; company?: string } | null;

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between border-b border-slate-800 px-6 py-3 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{proposal.proposal_number}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[proposal.status] ?? STATUS_COLORS.draft}`}>
                {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
              </span>
            </div>
            <input
              className="bg-transparent text-white font-semibold text-lg outline-none w-full truncate placeholder:text-slate-600 focus:bg-slate-800/50 rounded px-1 -ml-1"
              value={proposal.title}
              onChange={e => update('title', e.target.value)}
              placeholder="Proposal title…"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saveState === 'saving' && (
            <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" /> Saving…</span>
          )}
          {saveState === 'saved' && (
            <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Saved</span>
          )}
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-1.5" /> Preview
          </Button>
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            <Download className="h-4 w-4 mr-1.5" /> PDF
          </Button>
          <Button size="sm" onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4 mr-1.5" /> Send
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Tabs defaultValue="editor">
            <TabsList>
              <TabsTrigger value="editor">Editor</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="mt-6 space-y-6">
              {/* Company + Client header */}
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
                <div className="flex justify-between gap-6">
                  <div className="flex items-start gap-4">
                    {company?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={company.logo_url} alt={company.name} className="h-12 w-12 rounded-lg object-contain bg-white/5 shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-slate-700 shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold text-white">{company?.name ?? '—'}</p>
                      {company?.email && <p className="text-sm text-slate-400">{company.email}</p>}
                      {company?.phone && <p className="text-sm text-slate-400">{company.phone}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500 mb-1">Valid Until</p>
                    <input
                      type="date"
                      value={proposal.valid_until ?? ''}
                      onChange={e => update('valid_until', e.target.value || null)}
                      className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Prepared For</p>
                  <p className="text-white">{contact?.name ?? '—'}</p>
                  {contact?.company && <p className="text-sm text-slate-400">{contact.company}</p>}
                  {contact?.email && <p className="text-sm text-slate-400">{contact.email}</p>}
                </div>
              </div>

              {/* Line items */}
              <div className="rounded-xl border border-slate-700 bg-slate-800/30">
                <div className="px-4 py-3 border-b border-slate-700">
                  <h2 className="text-sm font-semibold text-white">Items</h2>
                </div>
                <LineItemsTable
                  items={proposal.items ?? []}
                  currency={proposal.currency}
                  onChange={updateItems}
                />

                {/* Totals */}
                <div className="flex justify-end px-6 py-4 border-t border-slate-700">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm text-slate-400">
                      <span>Subtotal</span><span className="text-white">{money(proposal.subtotal, proposal.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-400">
                      <span>Discount (amount)</span>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 text-xs">{proposal.currency}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={proposal.discount_amount}
                          onChange={e => update('discount_amount', parseFloat(e.target.value) || 0)}
                          className="w-24 text-right bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-400">
                      <span>Tax rate</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={proposal.tax_rate}
                          onChange={e => update('tax_rate', parseFloat(e.target.value) || 0)}
                          className="w-24 text-right bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-slate-500 text-xs">%</span>
                      </div>
                    </div>
                    <div className="flex justify-between font-semibold text-base text-white pt-2 border-t border-slate-700">
                      <span>Total</span><span>{money(proposal.total_amount, proposal.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 block">Notes</Label>
                  <Textarea
                    value={proposal.notes ?? ''}
                    onChange={e => update('notes', e.target.value || null)}
                    placeholder="Add any notes for the client…"
                    rows={4}
                    className="bg-transparent border-0 resize-none focus:ring-0 p-0 text-slate-200 placeholder:text-slate-600"
                  />
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 block">Terms & Conditions</Label>
                  <Textarea
                    value={proposal.terms ?? ''}
                    onChange={e => update('terms', e.target.value || null)}
                    placeholder="Payment terms, delivery conditions…"
                    rows={4}
                    className="bg-transparent border-0 resize-none focus:ring-0 p-0 text-slate-200 placeholder:text-slate-600"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                <ProposalHistory history={proposal.history ?? []} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Preview overlay */}
      {previewOpen && (
        <ProposalPreview proposal={proposal} company={company} onClose={() => setPreviewOpen(false)} />
      )}

      {/* Send dialog */}
      <SendProposalDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        proposal={proposal}
        onSent={() => { load(); setSendOpen(false); }}
      />
    </div>
  );
}
