/**
 * Classify a deal's `reminder_at` timestamp into a UI chip. Returns
 * `null` when the deal has no reminder set. Shared by `deal-detail-view`
 * and `deal-list` so they stay in sync.
 */
export interface ReminderStatusChip {
  label: string;
  cls: string;
}

export function reminderStatus(reminder_at?: string | null): ReminderStatusChip | null {
  if (!reminder_at) return null;
  const dt = new Date(reminder_at);
  const now = new Date();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const tomorrowEnd = new Date(todayEnd);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  if (dt < now) return { label: "Overdue", cls: "bg-red-500/15 text-red-400" };
  if (dt <= todayEnd) {
    const time = dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    return { label: `Today ${time}`, cls: "bg-amber-500/15 text-amber-400" };
  }
  if (dt <= tomorrowEnd) return { label: "Tomorrow", cls: "bg-slate-700 text-slate-300" };
  return {
    label: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    cls: "bg-slate-700 text-slate-400",
  };
}
