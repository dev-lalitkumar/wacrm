"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  EVENT_PLACEHOLDERS,
  EVENT_TARGETS,
  type NotificationChannelName,
  type NotificationTemplate,
} from "@/lib/notifications/types";

const EVENT_LABELS: Record<string, string> = {
  "contact.assigned": "Contact assigned",
  "contact.welcome": "Welcome Message For Contact",
  "contact.welcome_back": "Welcome Back Message For Contact",
  "deal.created": "Deal created",
  "deal.assigned": "Deal assigned",
  "deal.stage_changed": "Deal stage changed",
  "deal.closed_won": "Deal won",
  "deal.closed_lost": "Deal lost",
  "reminder.due_today": "Reminder due today",
  "reminder.overdue": "Reminder overdue",
  "proposal.viewed": "Proposal viewed",
  "proposal.accepted": "Proposal accepted",
  "proposal.rejected": "Proposal rejected",
  "conversation.assigned": "Conversation assigned",
};

const CHANNEL_LABELS: Record<NotificationChannelName, string> = {
  in_app: "In-App",
  email: "Email",
  whatsapp: "WhatsApp",
};

const CHANNEL_ORDER: NotificationChannelName[] = ["in_app", "email", "whatsapp"];

export function NotificationTemplatesManager() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [openEvent, setOpenEvent] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/notification-templates");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setTemplates(data.templates as NotificationTemplate[]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load templates");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Group templates by event type, preserving a stable channel order.
  const grouped = useMemo(() => {
    const map = new Map<string, NotificationTemplate[]>();
    for (const t of templates) {
      const arr = map.get(t.event_type) ?? [];
      arr.push(t);
      map.set(t.event_type, arr);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          CHANNEL_ORDER.indexOf(a.channel) - CHANNEL_ORDER.indexOf(b.channel),
      );
    }
    return map;
  }, [templates]);

  function applyLocal(updated: NotificationTemplate) {
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  function removeLocal(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const eventTypes = Array.from(grouped.keys());

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Notification Templates</h2>
        <p className="mt-1 text-sm text-slate-400">
          Customise the message sent for each event on each channel. Use{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-xs text-primary">
            {"{{placeholder}}"}
          </code>{" "}
          tokens to insert live values. Toggle a channel off to stop it firing.
          Email &amp; WhatsApp only send when their integration is connected.
        </p>
      </div>

      <div className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
        {eventTypes.map((eventType) => {
          const rows = grouped.get(eventType) ?? [];
          const isOpen = openEvent === eventType;
          const placeholders = EVENT_PLACEHOLDERS[eventType as keyof typeof EVENT_PLACEHOLDERS] ?? [];
          return (
            <div key={eventType} className="bg-slate-900/40">
              <button
                type="button"
                onClick={() => setOpenEvent(isOpen ? null : eventType)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-800/40"
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {EVENT_LABELS[eventType] ?? eventType}
                  </span>
                  {EVENT_TARGETS[eventType as keyof typeof EVENT_TARGETS] === "contact" ? (
                    <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
                      To Contact
                    </span>
                  ) : (
                    <span className="rounded-full border border-slate-600 bg-slate-700/40 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                      To User
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-slate-500 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>

              {isOpen ? (
                <div className="space-y-4 border-t border-slate-800 px-4 py-4">
                  {placeholders.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span>Placeholders:</span>
                      {placeholders.map((p) => (
                        <code
                          key={p}
                          className="rounded bg-slate-800 px-1.5 py-0.5 text-primary"
                        >
                          {`{{${p}}}`}
                        </code>
                      ))}
                    </div>
                  ) : null}

                  {rows.map((t) => (
                    <TemplateRow
                      key={t.id}
                      template={t}
                      onSaved={applyLocal}
                      onDeleted={removeLocal}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TemplateRow({
  template,
  onSaved,
  onDeleted,
}: {
  template: NotificationTemplate;
  onSaved: (t: NotificationTemplate) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(template.name);
  const [title, setTitle] = useState(template.title);
  const [body, setBody] = useState(template.body);
  const [isActive, setIsActive] = useState(template.is_active);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty =
    name !== template.name ||
    title !== template.title ||
    body !== template.body ||
    isActive !== template.is_active;

  // In-app and email use a title (subject); WhatsApp has no subject line.
  const showTitle = template.channel !== "whatsapp";

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/notification-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, title, body, is_active: isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved(data.template as NotificationTemplate);
      toast.success("Template saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(next: boolean) {
    setIsActive(next);
    // Persist the toggle immediately — it's the most common quick action.
    try {
      const res = await fetch(`/api/notification-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: next }),
      });
      if (!res.ok) throw new Error("Failed to update");
      onSaved({ ...template, is_active: next, name, title, body });
    } catch {
      setIsActive(!next);
      toast.error("Failed to update channel");
    }
  }

  async function remove() {
    if (!confirm("Delete this template? This channel will stop notifying for this event.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/notification-templates/${template.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      onDeleted(template.id);
      toast.success("Template deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
          {CHANNEL_LABELS[template.channel]}
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <Switch checked={isActive} onCheckedChange={toggleActive} />
            {isActive ? "Active" : "Off"}
          </label>
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            aria-label="Delete template"
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Template name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {showTitle ? (
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              {template.channel === "email" ? "Subject" : "Title"}
            </label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-xs text-slate-500">Message body</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={template.channel === "email" ? 5 : 3}
          />
        </div>
      </div>

      <div className="mt-2.5 flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}
