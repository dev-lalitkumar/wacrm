"use client";

import type { Contact, Tag, CustomField, Profile } from "@/types";
import { Phone, Mail, Building2, User, Tag as TagIcon } from "lucide-react";

interface ContactInfoCardProps {
  contact: Contact & { tags?: Tag[] };
  customFields: CustomField[];
  assignee?: Profile | null;
}

function renderCustomValue(field: CustomField, raw: unknown): React.ReactNode {
  if (raw == null || raw === "") return <span className="text-slate-600">—</span>;
  if (field.field_type === "multi_select") {
    const arr = Array.isArray(raw) ? (raw as string[]) : [String(raw)];
    return <span className="text-slate-200">{arr.join(", ")}</span>;
  }
  if (field.field_type === "file") {
    const url = String(raw);
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline truncate block max-w-[120px]"
      >
        View file ↗
      </a>
    );
  }
  return <span className="text-slate-200">{String(raw)}</span>;
}

export function ContactInfoCard({ contact, customFields, assignee }: ContactInfoCardProps) {
  const tags = contact.tags ?? [];

  return (
    <div className="space-y-2.5">
      {/* 2×2 grid: phone / email / company / assigned */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <p className="flex items-center gap-1 text-[11px] text-slate-500 mb-0.5">
            <Phone className="size-2.5" /> Phone
          </p>
          <p className="text-xs text-slate-200">{contact.phone || "—"}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[11px] text-slate-500 mb-0.5">
            <Mail className="size-2.5" /> Email
          </p>
          <p className="text-xs text-slate-200 truncate">{contact.email || "—"}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[11px] text-slate-500 mb-0.5">
            <Building2 className="size-2.5" /> Company
          </p>
          <p className="text-xs text-slate-200">{contact.company || "—"}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[11px] text-slate-500 mb-0.5">
            <User className="size-2.5" /> Assigned
          </p>
          <p className="text-xs text-slate-200">
            {assignee ? (assignee.full_name || assignee.email) : "—"}
          </p>
        </div>
        {contact.source && (
          <div>
            <p className="flex items-center gap-1 text-[11px] text-slate-500 mb-0.5">
              <TagIcon className="size-2.5" /> Source
            </p>
            <span className="inline-flex items-center rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-medium text-slate-200">
              {contact.source.name}
            </span>
          </div>
        )}

        {/* Custom fields — identical visual rhythm to standard fields */}
        {customFields.map((field) => {
          const raw = (contact.custom_data ?? {})[field.id];
          return (
            <div key={field.id}>
              <p className="text-[11px] text-slate-500 mb-0.5">{field.field_name}</p>
              <div className="text-xs">{renderCustomValue(field, raw)}</div>
            </div>
          );
        })}
      </div>

      {/* Tags row */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-700/40">
          {tags.slice(0, 6).map((tag) => (
            <span
              key={tag.id}
              className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
          {tags.length > 6 && (
            <span className="text-[10px] text-slate-500 self-center">
              +{tags.length - 6} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
