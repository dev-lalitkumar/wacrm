"use client";

import { Bell, CheckCheck } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationItem } from "./notification-item";
import type { NotificationRecord } from "@/lib/notifications/types";

interface NotificationPanelProps {
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  onMarkAllRead: () => void;
  onMarkRead: (ids: string[]) => void;
  onClose?: () => void;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function NotificationPanel({
  notifications,
  unreadCount,
  loading,
  onMarkAllRead,
  onMarkRead,
  onClose,
}: NotificationPanelProps) {
  const today = startOfToday();
  const todays = notifications.filter(
    (n) => new Date(n.created_at).getTime() >= today,
  );
  const earlier = notifications.filter(
    (n) => new Date(n.created_at).getTime() < today,
  );

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
        <span className="text-sm font-semibold text-white">Notifications</span>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        ) : null}
      </div>

      <ScrollArea className="max-h-[460px]">
        {loading ? (
          <div className="px-3 py-10 text-center text-sm text-slate-500">
            Loading…
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-12 text-center">
            <Bell className="h-7 w-7 text-slate-600" />
            <span className="text-sm text-slate-400">You&apos;re all caught up</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {todays.length > 0 ? (
              <Section
                label="Today"
                items={todays}
                onMarkRead={onMarkRead}
                onClose={onClose}
              />
            ) : null}
            {earlier.length > 0 ? (
              <Section
                label="Earlier"
                items={earlier}
                onMarkRead={onMarkRead}
                onClose={onClose}
              />
            ) : null}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function Section({
  label,
  items,
  onMarkRead,
  onClose,
}: {
  label: string;
  items: NotificationRecord[];
  onMarkRead: (ids: string[]) => void;
  onClose?: () => void;
}) {
  return (
    <div>
      <div className="bg-slate-900/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </div>
      {items.map((n) => (
        <NotificationItem
          key={n.id}
          notification={n}
          onRead={onMarkRead}
          onNavigate={onClose}
        />
      ))}
    </div>
  );
}
