'use client';

import type { ProposalHistory as ProposalHistoryType } from '@/types';
import {
  Send,
  Eye,
  CheckCircle,
  XCircle,
  Pencil,
  PlusCircle,
  Download,
  Clock,
} from 'lucide-react';

const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  created: { label: 'Proposal created', icon: PlusCircle, color: 'text-blue-400' },
  edited: { label: 'Proposal edited', icon: Pencil, color: 'text-slate-400' },
  sent: { label: 'Proposal sent', icon: Send, color: 'text-primary' },
  viewed: { label: 'Client viewed proposal', icon: Eye, color: 'text-amber-400' },
  accepted: { label: 'Client accepted proposal', icon: CheckCircle, color: 'text-green-400' },
  rejected: { label: 'Client rejected proposal', icon: XCircle, color: 'text-red-400' },
  downloaded: { label: 'PDF downloaded', icon: Download, color: 'text-slate-400' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ProposalHistoryProps {
  history: ProposalHistoryType[];
}

export function ProposalHistory({ history }: ProposalHistoryProps) {
  if (history.length === 0) {
    return <p className="text-sm text-slate-500 py-4 text-center">No activity yet.</p>;
  }

  return (
    <div className="space-y-1">
      {history.map(entry => {
        const meta = ACTION_META[entry.action] ?? { label: entry.action, icon: Clock, color: 'text-slate-400' };
        const Icon = meta.icon;
        return (
          <div key={entry.id} className="flex items-start gap-3 py-2">
            <div className={`mt-0.5 shrink-0 ${meta.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-200">{meta.label}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {entry.actor && (
                  <span className="text-xs text-slate-500">
                    by {(entry.actor as { full_name?: string }).full_name ?? 'Unknown'}
                  </span>
                )}
                {entry.recipient && (
                  <span className="text-xs text-slate-500">→ {entry.recipient}</span>
                )}
                {entry.channel && (
                  <span className="text-xs bg-slate-800 text-slate-400 rounded px-1.5 py-0.5">{entry.channel}</span>
                )}
              </div>
            </div>
            <time className="shrink-0 text-xs text-slate-600" title={new Date(entry.created_at).toLocaleString()}>
              {timeAgo(entry.created_at)}
            </time>
          </div>
        );
      })}
    </div>
  );
}
