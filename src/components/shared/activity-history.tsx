"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";
import { Loader2, MessageSquare, Phone, Mail, Users, FileText, StickyNote } from "lucide-react";

const CHANNEL_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  whatsapp: { label: "WhatsApp", icon: <MessageSquare className="size-2.5" />, cls: "bg-green-500/15 text-green-400" },
  call:     { label: "Call",     icon: <Phone className="size-2.5" />,         cls: "bg-blue-500/15 text-blue-400" },
  email:    { label: "Email",    icon: <Mail className="size-2.5" />,          cls: "bg-sky-500/15 text-sky-400" },
  meeting:  { label: "Meeting",  icon: <Users className="size-2.5" />,         cls: "bg-violet-500/15 text-violet-400" },
  other:    { label: "Other",    icon: <FileText className="size-2.5" />,      cls: "bg-slate-600 text-slate-300" },
};

interface FollowupEntry {
  id: string;
  created_at: string;
  note: string;
  channel?: string;
  type: "followup" | "note";
  creator?: { full_name?: string; email?: string };
}

interface ActivityHistoryProps {
  entityType: "deal" | "contact";
  entityId: string;
}

const PAGE_SIZE = 20;

export function ActivityHistory({ entityType, entityId }: ActivityHistoryProps) {
  const supabase = createClient();
  const [entries, setEntries] = useState<FollowupEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const fetchEntries = useCallback(async (pageNum: number) => {
    setLoading(true);
    const from = 0;
    const to = (pageNum + 1) * PAGE_SIZE - 1;

    const table = entityType === "deal" ? "deal_followups" : "contact_followups";
    const col   = entityType === "deal" ? "deal_id" : "contact_id";

    const promises: Promise<FollowupEntry[]>[] = [
      (async (): Promise<FollowupEntry[]> => {
        const { data } = await supabase
          .from(table)
          .select("id, created_at, note, channel, creator:profiles(full_name, email)")
          .eq(col, entityId)
          .order("created_at", { ascending: false })
          .range(from, to);
        return (data ?? []).map((r) => ({
          id: r.id,
          created_at: r.created_at,
          note: r.note,
          channel: r.channel,
          type: "followup" as const,
          creator: r.creator as { full_name?: string; email?: string } | undefined,
        }));
      })(),
    ];

    // For contacts, also load notes
    if (entityType === "contact") {
      promises.push(
        (async (): Promise<FollowupEntry[]> => {
          const { data } = await supabase
            .from("contact_notes")
            .select("id, created_at, note_text, creator:profiles(full_name, email)")
            .eq("contact_id", entityId)
            .order("created_at", { ascending: false })
            .range(from, to);
          return (data ?? []).map((r) => ({
            id: r.id,
            created_at: r.created_at,
            note: r.note_text,
            channel: undefined,
            type: "note" as const,
            creator: r.creator as { full_name?: string; email?: string } | undefined,
          }));
        })()
      );
    }

    const results = await Promise.all(promises);
    const merged = results
      .flat()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, (pageNum + 1) * PAGE_SIZE);

    setEntries(merged);
    setHasMore(merged.length === (pageNum + 1) * PAGE_SIZE);
    setLoading(false);
  }, [supabase, entityType, entityId]);

  useEffect(() => {
    setEntries([]);
    setPage(0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEntries(0);
  }, [fetchEntries]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchEntries(next);
  }

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-4 animate-spin text-slate-500" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <StickyNote className="size-6 text-slate-600 mb-2" />
        <p className="text-sm text-slate-500">No activity yet.</p>
        <p className="text-xs text-slate-600 mt-0.5">Log a follow-up to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => {
        const meta = entry.type === "followup" && entry.channel
          ? CHANNEL_META[entry.channel] ?? CHANNEL_META.other
          : null;
        const creatorName = entry.creator?.full_name || entry.creator?.email || "Unknown";
        return (
          <div key={entry.id} className="flex gap-3 py-2.5 border-b border-slate-700/40 last:border-0">
            <div className="mt-0.5 shrink-0">
              {meta ? (
                <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.cls}`}>
                  {meta.icon}
                  {meta.label}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-slate-700 text-slate-300">
                  <StickyNote className="size-2.5" />
                  Note
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{entry.note}</p>
              <p className="text-[10px] text-slate-500 mt-1">
                {creatorName} · {timeAgo(entry.created_at)}
              </p>
            </div>
          </div>
        );
      })}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
        >
          {loading ? <Loader2 className="size-3 animate-spin" /> : null}
          Load more
        </button>
      )}
    </div>
  );
}
