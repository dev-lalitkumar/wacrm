"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { NotificationRecord } from "@/lib/notifications/types";

const PAGE_SIZE = 50;

interface UseNotificationsResult {
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

/**
 * Loads the current profile's recent notifications, keeps them live via a
 * Supabase Realtime subscription filtered to this profile, and exposes
 * mark-as-read helpers. Fires a browser Notification when a new one arrives
 * and the panel was previously empty of unread items (0 → 1 transition).
 */
export function useNotifications(): UseNotificationsResult {
  const { profile } = useAuth();
  const profileId = profile?.id ?? null;

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Mirror of the current unread count so the Realtime handler can detect the
  // 0 → 1 transition without depending on stale closure state. Assigned inside
  // an effect (not during render) per React 19's refs rule — the Realtime
  // callback only reads `.current`, and always after the render that set it.
  const unreadRef = useRef(0);

  const unreadCount = notifications.reduce((n, x) => (x.is_read ? n : n + 1), 0);
  useEffect(() => {
    unreadRef.current = unreadCount;
  });

  // ── Initial fetch ──────────────────────────────────────────────
  useEffect(() => {
    if (!profileId) return;
    let active = true;
    const supabase = createClient();

    void supabase
      .from("notifications")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data }) => {
        if (!active) return;
        setNotifications((data as NotificationRecord[]) ?? []);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [profileId]);

  // ── Realtime subscription ──────────────────────────────────────
  useEffect(() => {
    if (!profileId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          const incoming = payload.new as NotificationRecord;
          setNotifications((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev;
            return [incoming, ...prev];
          });
          // Browser notification only on the empty → non-empty transition.
          if (unreadRef.current === 0) {
            showBrowserNotification(incoming.title, incoming.body);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          const updated = payload.new as NotificationRecord;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n)),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profileId]);

  // ── Mutations ──────────────────────────────────────────────────
  const markAsRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) =>
        ids.includes(n.id) ? { ...n, is_read: true, read_at: readAt } : n,
      ),
    );
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: readAt })
      .in("id", ids);
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications
      .filter((n) => !n.is_read)
      .map((n) => n.id);
    if (!unreadIds.length) return;
    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.is_read ? n : { ...n, is_read: true, read_at: readAt })),
    );
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: readAt })
      .in("id", unreadIds);
  }, [notifications]);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead };
}

async function showBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return;
    new Notification(title || "New notification", {
      body,
      icon: "/favicon.ico",
      tag: "wacrm-notification",
    });
  } catch {
    // Browser may block notifications outside a user gesture — ignore.
  }
}
