'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Proposal } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  FileText,
  MoreHorizontal,
  Eye,
  Download,
  Trash2,
  Loader2,
  Copy,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-700 text-slate-200 border-slate-600',
  sent: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  viewed: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  accepted: 'bg-green-500/20 text-green-300 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 0 }).format(amount);
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_OPTIONS = ['all', 'draft', 'sent', 'viewed', 'accepted', 'rejected'] as const;

export default function ProposalsPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/proposals${params}`);
      if (!res.ok) throw new Error('Failed to load');
      setProposals(await res.json());
    } catch {
      toast.error('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function createProposal() {
    if (!newTitle.trim()) { toast.error('Please enter a title'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const data = await res.json();
      router.push(`/proposals/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/proposals/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setProposals(prev => prev.filter(p => p.id !== deleteId));
      toast.success('Proposal deleted');
      setDeleteId(null);
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  async function downloadPdf(proposal: Proposal) {
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/pdf`);
      if (!res.ok) { toast.error('PDF failed'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${proposal.proposal_number}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  }

  async function duplicate(proposal: Proposal) {
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${proposal.title} (Copy)`, contact_id: proposal.contact_id, deal_id: proposal.deal_id }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      toast.success('Proposal duplicated');
      router.push(`/proposals/${data.id}`);
    } catch { toast.error('Failed to duplicate'); }
  }

  const filtered = search
    ? proposals.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.proposal_number.toLowerCase().includes(search.toLowerCase()) ||
        (p.contact as { name?: string } | null)?.name?.toLowerCase().includes(search.toLowerCase()) ||
        false
      )
    : proposals;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Proposals</h1>
          <p className="text-sm text-slate-400">{proposals.length} total</p>
        </div>
        <Button onClick={() => { setNewTitle(''); setNewOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New Proposal
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-800 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input className="pl-9 w-56" placeholder="Search proposals…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm">
              {search || statusFilter !== 'all' ? 'No proposals match your filters.' : 'No proposals yet.'}
            </p>
            {!search && statusFilter === 'all' && (
              <Button className="mt-4" onClick={() => { setNewTitle(''); setNewOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Create First Proposal
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proposal</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => {
                const contact = p.contact as { name?: string } | null;
                const deal = p.deal as { title?: string } | null;
                return (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-slate-800/50" onClick={() => router.push(`/proposals/${p.id}`)}>
                    <TableCell>
                      <p className="font-medium text-white">{p.title}</p>
                      <p className="text-xs text-slate-400">{p.proposal_number}</p>
                    </TableCell>
                    <TableCell>
                      {contact?.name ? (
                        <p className="text-sm text-slate-300">{contact.name}</p>
                      ) : (
                        <span className="text-slate-500 text-sm">—</span>
                      )}
                      {deal?.title && <p className="text-xs text-slate-500">{deal.title}</p>}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full border ${STATUS_COLORS[p.status] ?? STATUS_COLORS.draft}`}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-white">
                      {money(p.total_amount, p.currency)}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">{fmtDate(p.created_at)}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{fmtDate(p.sent_at)}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon" className="h-8 w-8" />}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-900 text-slate-100 ring-slate-700">
                          <DropdownMenuItem onClick={() => router.push(`/proposals/${p.id}`)} className="focus:bg-slate-800">
                            <Eye className="mr-2 h-4 w-4" /> Open
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadPdf(p)} className="focus:bg-slate-800">
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicate(p)} className="focus:bg-slate-800">
                            <Copy className="mr-2 h-4 w-4" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-800" />
                          <DropdownMenuItem onClick={() => setDeleteId(p.id)} className="text-red-400 focus:bg-slate-800 focus:text-red-300">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* New proposal dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>New Proposal</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-sm text-slate-400">Proposal Title</label>
            <Input
              placeholder="e.g. Website Redesign Proposal"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createProposal()}
              autoFocus
            />
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={createProposal} disabled={creating || !newTitle.trim()}>
              {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : 'Create & Open'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Delete Proposal</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-400">Are you sure? This cannot be undone.</p>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
