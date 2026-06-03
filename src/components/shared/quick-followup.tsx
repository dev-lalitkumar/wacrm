"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";
import type { Followup, FollowupChannel, DealReminderType, FollowupOutcome } from "@/types";
import { FOLLOWUP_OUTCOME_LABELS } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Bell } from "lucide-react";
import { toast } from "sonner";

const CHANNELS: { value: FollowupChannel; label: string; icon: string }[] = [
  { value: "whatsapp", label: "WhatsApp", icon: "\u{1F4AC}" },
  { value: "call",     label: "Call",     icon: "\u{1F4DE}" },
  { value: "email",    label: "Email",    icon: "\u{2709}\u{FE0F}" },
  { value: "meeting",  label: "Meeting",  icon: "\u{1F91D}" },
  { value: "other",    label: "Other",    icon: "\u{1F4DD}" },
];

const REMINDER_TYPES: { value: DealReminderType; label: string }[] = [
  { value: "followup", label: "Follow-up" },
  { value: "call",     label: "Call" },
  { value: "meeting",  label: "Meeting" },
  { value: "other",    label: "Other" },
];

const OUTCOMES = Object.entries(FOLLOWUP_OUTCOME_LABELS) as [FollowupOutcome, string][];

type FollowupRow = Followup & { creator?: { full_name?: string; email?: string } };

/* ── Date helpers (same as deal-reminder-section) ──────────── */

function formatDateTimeLocal(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutes(mins: number) {
  return formatDateTimeLocal(new Date(Date.now() + mins * 60000).toISOString());
}

function tomorrowAt9() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return formatDateTimeLocal(d.toISOString());
}

function nextMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(9, 0, 0, 0);
  return formatDateTimeLocal(d.toISOString());
}

/* ── Component ─────────────────────────────────────────────── */

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
  const [outcome, setOutcome] = useState<FollowupOutcome | "">("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<FollowupRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // ── Inline reminder state (ON by default) ─────────────────
  const [setReminder, setSetReminder] = useState(true);
  const [reminderType, setReminderType] = useState<DealReminderType>("followup");
  const [reminderAt, setReminderAt] = useState(tomorrowAt9());
  const [reminderNote, setReminderNote] = useState("");

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

    // Validate reminder fields when toggle is on
    if (setReminder && !reminderAt) {
      toast.error("Please set a reminder date & time, or turn off the reminder toggle");
      return;
    }

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

    // 1. Insert followup row
    const row: Record<string, unknown> = {
      contact_id: contactId,
      channel,
      note: note.trim(),
      created_by: profile.id,
    };
    if (dealId) row.deal_id = dealId;
    if (outcome) row.outcome = outcome;

    const { error: fuError } = await supabase.from("followups").insert(row);
    if (fuError) {
      toast.error("Failed to save follow-up");
      setSaving(false);
      return;
    }

    // 2. Update reminder on the entity (deal or contact) if toggle is on
    if (setReminder && reminderAt) {
      const reminderUpdate = {
        reminder_type: reminderType,
        reminder_at: new Date(reminderAt).toISOString(),
        reminder_note: (reminderNote.trim() || note.trim()) || null,
        reminder_updated_at: new Date().toISOString(),
      };

      const table = dealId ? "deals" : "contacts";
      const id = dealId ?? contactId;

      const { error: remError } = await supabase
        .from(table)
        .update(reminderUpdate)
        .eq("id", id);

      if (remError) {
        // Followup saved but reminder failed — still a partial success
        toast.error("Follow-up saved, but failed to set reminder");
        setSaving(false);
        fetchHistory();
        onSaved?.();
        return;
      }
    }

    toast.success(setReminder ? "Follow-up saved & reminder set" : "Follow-up saved");
    setChannel("");
    setOutcome("");
    setNote("");
    setReminderNote("");
    setReminderAt(tomorrowAt9());
    setReminderType("followup");
    fetchHistory();
    onSaved?.();
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

      {/* Outcome / disposition — optional, shown once a channel is chosen */}
      {channel && (
        <div className="space-y-1">
          <Label className="text-slate-400 text-[11px]">Outcome (optional)</Label>
          <div className="flex flex-wrap gap-1.5">
            {OUTCOMES.map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setOutcome((cur) => (cur === val ? "" : val))}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                  outcome === val
                    ? "bg-primary text-primary-foreground"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Note textarea */}
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What happened? Add a note…"
        className="min-h-[72px] resize-none border-slate-700 bg-slate-800 text-sm text-white placeholder:text-slate-500"
      />

      {/* ── Inline "Set next reminder" toggle + fields ──────── */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-2.5 space-y-2.5">
        <button
          type="button"
          onClick={() => setSetReminder((v) => !v)}
          className="flex items-center gap-2 w-full cursor-pointer group"
        >
          <div
            className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
              setReminder ? "bg-primary" : "bg-slate-600"
            }`}
          >
            <span
              className={`inline-block size-3 rounded-full bg-white transition-transform ${
                setReminder ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </div>
          <Bell className="size-3 text-slate-400" />
          <span className="text-xs font-medium text-slate-300 group-hover:text-slate-100 transition-colors">
            Set next reminder
          </span>
        </button>

        {setReminder && (
          <div className="space-y-2.5 pt-0.5">
            {/* Reminder type chips */}
            <div className="flex flex-wrap gap-1.5">
              {REMINDER_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setReminderType(t.value)}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                    reminderType === t.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Quick-set date buttons */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "+15m",  fn: () => addMinutes(15) },
                { label: "+1h",   fn: () => addMinutes(60) },
                { label: "Tomorrow 9 AM", fn: tomorrowAt9 },
                { label: "Next Mon",      fn: nextMonday },
              ].map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setReminderAt(q.fn())}
                  className="rounded px-2 py-0.5 text-[11px] text-slate-400 bg-slate-700/60 hover:bg-slate-700 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {q.label}
                </button>
              ))}
            </div>

            {/* Date/time picker */}
            <div className="space-y-1">
              <Label className="text-slate-400 text-[11px]">When</Label>
              <input
                type="datetime-local"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                className="h-7 w-full rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-white outline-none focus:border-primary [color-scheme:dark]"
              />
            </div>

            {/* Reminder note (optional override — defaults to followup note) */}
            <div className="space-y-1">
              <Label className="text-slate-400 text-[11px]">Reminder note (optional — defaults to followup note)</Label>
              <Textarea
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
                placeholder={note.trim() || "What needs to happen next?"}
                className="min-h-[48px] resize-none border-slate-700 bg-slate-800 text-xs text-white placeholder:text-slate-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Save button + email compose link */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleSave}
          disabled={!channel || !note.trim() || saving}
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {setReminder ? "Save Follow-up & Set Reminder" : "Save Follow-up"}
        </Button>
        {channel === "email" && onComposeEmail && (
          <button
            type="button"
            onClick={onComposeEmail}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            {"✉️"} Compose &amp; Send
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
                    {f.outcome && (
                      <span className="inline-flex items-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {FOLLOWUP_OUTCOME_LABELS[f.outcome]}
                      </span>
                    )}
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
