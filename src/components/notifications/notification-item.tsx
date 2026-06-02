"use client";

import { useRouter } from "next/navigation";
import {
  Bell,
  DollarSign,
  FileText,
  MessageSquare,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import type { NotificationRecord } from "@/lib/notifications/types";

interface NotificationItemProps {
  notification: NotificationRecord;
  onRead: (ids: string[]) => void;
  /** Called after navigation so the parent can close the popover. */
  onNavigate?: () => void;
}

/** Icon + accent colour per entity / event family. */
function visual(n: NotificationRecord): { Icon: LucideIcon; cls: string } {
  if (n.type.startsWith("reminder")) {
    return { Icon: Bell, cls: "bg-orange-500/10 text-orange-400" };
  }
  switch (n.entity_type) {
    case "contact":
      return { Icon: User, cls: "bg-blue-500/10 text-blue-400" };
    case "deal":
      return { Icon: DollarSign, cls: "bg-emerald-500/10 text-emerald-400" };
    case "proposal":
      return { Icon: FileText, cls: "bg-amber-500/10 text-amber-400" };
    case "conversation":
      return { Icon: MessageSquare, cls: "bg-purple-500/10 text-purple-400" };
    default:
      return { Icon: Bell, cls: "bg-slate-700/40 text-slate-300" };
  }
}

function hrefFor(n: NotificationRecord): string | null {
  if (!n.entity_id) return null;
  switch (n.entity_type) {
    case "contact":
      return `/contacts?highlight=${n.entity_id}`;
    case "deal":
      return `/pipelines?deal=${n.entity_id}`;
    case "proposal":
      return `/proposals?id=${n.entity_id}`;
    case "conversation":
      return `/inbox?conversation=${n.entity_id}`;
    default:
      return null;
  }
}

export function NotificationItem({
  notification,
  onRead,
  onNavigate,
}: NotificationItemProps) {
  const router = useRouter();
  const { Icon, cls } = visual(notification);

  function handleClick() {
    if (!notification.is_read) onRead([notification.id]);
    const href = hrefFor(notification);
    if (href) {
      router.push(href);
      onNavigate?.();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-800/60",
        !notification.is_read && "bg-slate-800/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          cls,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">
          {notification.title}
        </span>
        {notification.body ? (
          <span className="mt-0.5 line-clamp-2 block text-xs text-slate-400">
            {notification.body}
          </span>
        ) : null}
        <span className="mt-1 block text-[11px] text-slate-500">
          {timeAgo(notification.created_at)}
        </span>
      </span>
      {!notification.is_read ? (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
      ) : null}
    </button>
  );
}
