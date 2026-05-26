"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Deal, DealReminderType } from "@/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Bell, CalendarClock } from "lucide-react";
import { toast } from "sonner";

const REMINDER_TYPES: { value: DealReminderType; label: string }[] = [
  { value: "followup", label: "Follow-up" },
  { value: "call",     label: "Call" },
  { value: "meeting",  label: "Meeting" },
  { value: "other",    label: "Other" },
];

function reminderStatus(reminder_at?: string): "overdue" | "today" | "upcoming" | null {
  if (!reminder_at) return null;
  const dt = new Date(reminder_at);
  const now = new Date();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  if (dt < now) return "overdue";
  if (dt <= todayEnd) return "today";
  return "upcoming";
}

function formatDateTimeLocal(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutes(mins: number) {
  const d = new Date(Date.now() + mins * 60000);
  return formatDateTimeLocal(d.toISOString());
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

interface DealReminderSectionProps {
  deal: Deal;
  onUpdated: () => void;
}

export function DealReminderSection({ deal, onUpdated }: DealReminderSectionProps) {
  const supabase = createClient();
  const isOpen = !deal.status || deal.status === "open";

  const [type, setType]     = useState<DealReminderType>(deal.reminder_type ?? "followup");
  const [at, setAt]         = useState(formatDateTimeLocal(deal.reminder_at));
  const [note, setNote]     = useState(deal.reminder_note ?? "");
  const [saving, setSaving] = useState(false);
  const [doneMode, setDoneMode] = useState(false);

  // sync when deal changes (e.g. after save)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setType(deal.reminder_type ?? "followup");
    setAt(formatDateTimeLocal(deal.reminder_at));
    setNote(deal.reminder_note ?? "");
    setDoneMode(false);
  }, [deal.reminder_type, deal.reminder_at, deal.reminder_note]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const status = reminderStatus(deal.reminder_at);

  async function handleSave() {
    if (!at) { toast.error("Please set a date and time"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("deals")
      .update({
        reminder_type:       type,
        reminder_at:         new Date(at).toISOString(),
        reminder_note:       note.trim() || null,
        reminder_updated_at: new Date().toISOString(),
      })
      .eq("id", deal.id);
    setSaving(false);
    if (error) { toast.error("Failed to save reminder"); return; }
    toast.success("Reminder saved");
    onUpdated();
    setDoneMode(false);
  }

  async function handleDoneScheduleNext() {
    // Mark current reminder as done by clearing it then saving a new one
    // (the UI switches to "schedule next" mode immediately)
    setDoneMode(true);
    setAt(tomorrowAt9());
    setNote("");
  }

  if (!isOpen) {
    // Read-only snapshot for won/lost deals
    return (
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Last Reminder
        </p>
        {deal.reminder_at ? (
          <p className="text-sm text-slate-400">
            {REMINDER_TYPES.find((t) => t.value === deal.reminder_type)?.label ?? deal.reminder_type}
            {" · "}
            {new Date(deal.reminder_at).toLocaleString("en-US", {
              month: "short", day: "numeric", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        ) : (
          <p className="text-sm text-slate-500">No reminder set</p>
        )}
        {deal.reminder_note && (
          <p className="text-xs text-slate-500">{deal.reminder_note}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="size-3.5 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            {doneMode ? "Schedule Next Reminder" : "Active Reminder"}
          </p>
        </div>
        {status && !doneMode && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              status === "overdue"
                ? "bg-red-500/15 text-red-400"
                : status === "today"
                ? "bg-amber-500/15 text-amber-400"
                : "bg-slate-700 text-slate-300"
            }`}
          >
            <CalendarClock className="size-3" />
            {status === "overdue" ? "Overdue" : status === "today" ? "Due Today" : "Upcoming"}
          </span>
        )}
      </div>

      {/* Type selector */}
      <div className="flex flex-wrap gap-1.5">
        {REMINDER_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all cursor-pointer ${
              type === t.value
                ? "bg-primary text-primary-foreground"
                : "bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date/time picker */}
      <div className="space-y-1.5">
        <Label className="text-slate-400 text-xs">Date & Time</Label>
        <input
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
          className="h-8 w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary [color-scheme:dark]"
        />
      </div>

      {/* Quick-set buttons */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: "+15m", fn: () => addMinutes(15) },
          { label: "+1h",  fn: () => addMinutes(60) },
          { label: "Tomorrow 9 AM", fn: tomorrowAt9 },
          { label: "Next Mon",      fn: nextMonday },
        ].map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => setAt(q.fn())}
            className="rounded px-2 py-0.5 text-[11px] text-slate-400 bg-slate-700/60 hover:bg-slate-700 hover:text-slate-200 transition-colors cursor-pointer"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <Label className="text-slate-400 text-xs">Note</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What needs to happen?"
          className="min-h-[56px] resize-none border-slate-700 bg-slate-800 text-sm text-white placeholder:text-slate-500"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={saving || !at}
          size="sm"
          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {doneMode ? "Save Next Reminder" : "Save Reminder"}
        </Button>
        {!doneMode && (
          <Button
            onClick={handleDoneScheduleNext}
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
          >
            Done — Schedule Next
          </Button>
        )}
      </div>
    </div>
  );
}
