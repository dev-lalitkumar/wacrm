"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";
import type { Followup, FollowupChannel } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const CHANNELS: { value: FollowupChannel; label: string; icon: string }[] = [
  { value: "whatsapp", label: "WhatsApp", icon: "💬" },
  { value: "call",     label: "Call",     icon: "📞" },
  { value: "email",    label: "Email",    icon: "✉️" },
  { value: "meeting",  label: "Meeting",  icon: "🤝" },
  { value: "other",    label: "Other",    icon: "📝" },
];

type FollowupRow = Followup & { creator?: { full_name?: string; email?: string } };

interface QuickFollowupProps {
  contactId: string;
  dealId?: string;
  onSaved?: () => void;
  /** When false, hides the recent-history list. Defaults to true. */
  showHistory?: boolean;
  /** Callback to open the email compose dialog. Shown when email channel is selected. */
  onComposeEmail?: () => void;
}

export function QuickFollowup({ contactId, dealId, onSaved, showHistory = true, onComposeEmail }: QuickFollowupProps) {
  const supabase = createClient();

  const [channel, setChannel] = useState<FollowupChannel | "">("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<FollowupRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // When dealId is set, scope history to that deal; otherwise show all contact followups
  const filterCol = dealId ? "deal_id" : "contact_id";
  const filterVal = dealId ?? contactId;

  const fetchHistory = useCallback(async () => {
    if (!filterVal) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from("followups")
      .select("*, creator:profiles(full_name, email)")
      .eq(filterCol, filterVal)
      .order("created_at", { ascending: false })
      .limit(showAll ? 50 : 6);
    setHistory((data ?? []) as FollowupRow[]);
    setLoadingHistory(false);
  }, [supabase, filterCol, filterVal, showAll]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHistory();
  }, [fetchHistory]);

  async function handleSave() {
    if (!channel || !note.trim()) return;
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { toast.error("Not signed in"); setSaving(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!profile) { toast.error("Profile not found"); setSaving(false); return; }

    const row: Record<string, unknown> = {
      contact_id: contactId,
      channel,
      note: note.trim(),
      created_by: profile.id,
    };
    if (dealId) row.deal_id = dealId;

    const { error } = await supabase.from("followups").insert(row);
    if (error) {
      toast.error("Failed to save follow-up");
    } else {
      toast.success("Follow-up saved");
      setChannel("");
      setNote("");
      fetchHistory();
      onSaved?.();
    }
    setSaving(false);
  }

  const displayedHistory = showAll ? history : history.slice(0, 5);

  return (
    <div className="space-y-3">
      {/* Channel chips */}
      <div className="flex flex-wrap gap-1.5">
        {CHANNELS.map((ch) => (
          <button
            key={ch.value}
            type="button"
            onClick={() => setChannel(ch.value)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
              channel === ch.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700"
            }`}
          >
            <span>{ch.icon}</span>
            {ch.label}
          </button>
        ))}
      </div>

      {/* Note textarea */}
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What happened? Add a note…"
        className="min-h-[72px] resize-none border-slate-700 bg-slate-800 text-sm text-white placeholder:text-slate-500"
      />

      <div className="flex items-center gap-2">
        <Button
          onClick={handleSave}
          disabled={!channel || !note.trim() || saving}
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Save Follow-up
        </Button>
        {channel === "email" && onComposeEmail && (
          <button
            type="button"
            onClick={onComposeEmail}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            ✉️ Compose &amp; Send
          </button>
        )}
      </div>

      {/* History — hidden when showHistory=false */}
      {showHistory && (
        loadingHistory ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-4 animate-spin text-slate-500" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">No follow-ups recorded yet.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              History
            </p>
            {displayedHistory.map((f) => {
              const ch = CHANNELS.find((c) => c.value === f.channel);
              return (
                <div
                  key={f.id}
                  className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 text-xs"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                      {ch?.icon} {ch?.label ?? f.channel}
                    </span>
                    <span className="text-slate-500 ml-auto">{timeAgo(f.created_at)}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{f.note}</p>
                  {f.creator && (
                    <p className="text-slate-500 mt-1">
                      {f.creator.full_name || f.creator.email}
                    </p>
                  )}
                </div>
              );
            })}
            {history.length > 5 && !showAll && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-xs text-primary hover:underline cursor-pointer"
              >
                View all {history.length} follow-ups
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}
