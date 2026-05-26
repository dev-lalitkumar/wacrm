"use client";

import type { Deal, PipelineStage, CustomField } from "@/types";
import { Calendar, Check, X, Bell } from "lucide-react";

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
  onEdit: (deal: Deal) => void;
  isOverlay?: boolean;
  customFields?: CustomField[];
}

function formatCurrency(value: number, currency?: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function reminderBadge(reminder_at?: string, status?: string) {
  if (!reminder_at || (status && status !== "open")) return null;
  const dt = new Date(reminder_at);
  const now = new Date();
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  if (dt < now) {
    return { label: "Overdue", cls: "bg-red-500/15 text-red-400" };
  }
  if (dt <= today) {
    const time = dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    return { label: `Today ${time}`, cls: "bg-amber-500/15 text-amber-400" };
  }
  if (dt <= tomorrow) {
    return { label: "Tomorrow", cls: "bg-slate-700 text-slate-300" };
  }
  return {
    label: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    cls: "bg-slate-700 text-slate-400",
  };
}

function initials(name?: string, fallback?: string) {
  const source = (name || fallback || "?").trim();
  if (!source) return "?";
  return source.charAt(0).toUpperCase();
}

export function DealCard({ deal, stage, onEdit, isOverlay, customFields }: DealCardProps) {
  const contactLabel = deal.contact?.name || deal.contact?.phone || "No contact";
  const assigneeLabel = deal.assignee?.full_name || null;
  const badge = reminderBadge(deal.reminder_at, deal.status);
  const contactTags = deal.contact?.contact_tags?.map((ct) => ct.tag).filter(Boolean) ?? [];

  return (
    <button
      type="button"
      onClick={(e) => {
        if (isOverlay) return;
        e.stopPropagation();
        onEdit(deal);
      }}
      className={`group relative w-full cursor-pointer rounded-xl border border-slate-700/50 bg-slate-800/70 pl-4 pr-3 py-3 text-left shadow-sm transition-all ${
        isOverlay
          ? "shadow-xl"
          : "hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-800 hover:shadow-lg"
      }`}
    >
      {/* 4px left accent bar using stage color */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
      />

      <div className="flex items-start justify-between gap-2">
        <h4 className="flex-1 text-sm font-semibold leading-snug text-white break-words">
          {deal.title}
        </h4>
        {deal.status === "won" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            <Check className="h-3 w-3" />
            Won
          </span>
        )}
        {deal.status === "lost" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
            <X className="h-3 w-3" />
            Lost
          </span>
        )}
      </div>

      {/* Contact row */}
      <div className="mt-2 flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold text-slate-200">
          {initials(deal.contact?.name, deal.contact?.phone)}
        </span>
        <div className="min-w-0 flex-1">
          <span className="truncate text-xs text-slate-400 block">{contactLabel}</span>
          {deal.contact?.company && (
            <span className="truncate text-[10px] text-slate-500 block">{deal.contact.company}</span>
          )}
        </div>
      </div>

      {/* Contact tags */}
      {contactTags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {contactTags.slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
          {contactTags.length > 2 && (
            <span className="text-[10px] text-slate-500 self-center">+{contactTags.length - 2}</span>
          )}
        </div>
      )}

      {/* Deal custom fields — top 2 */}
      {customFields && customFields.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {customFields.slice(0, 2).map((field) => {
            const raw = (deal.custom_data ?? {})[field.id];
            if (raw == null || raw === "") return null;
            const display = Array.isArray(raw) ? (raw as string[]).join(", ") : String(raw);
            return (
              <p key={field.id} className="text-[10px] text-slate-500 truncate">
                {field.field_name}: <span className="text-slate-400">{display}</span>
              </p>
            );
          })}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold text-primary">
          {formatCurrency(deal.value, deal.currency)}
        </span>
        {badge ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
            <Bell className="h-2.5 w-2.5" />
            {badge.label}
          </span>
        ) : deal.expected_close_date ? (
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <Calendar className="h-3 w-3" />
            {formatDate(deal.expected_close_date)}
          </span>
        ) : null}
      </div>

      {assigneeLabel && (
        <div className="mt-2 flex items-center justify-end">
          <span
            title={assigneeLabel}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
          >
            {initials(assigneeLabel)}
          </span>
        </div>
      )}
    </button>
  );
}
