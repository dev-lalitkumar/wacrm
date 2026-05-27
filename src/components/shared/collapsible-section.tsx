"use client";

import type { ReactNode } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

/**
 * Accordion row used by the Followup tabs in both the Deal and Contact
 * side-views. Shows a title + a collapsed summary; click to expand and
 * reveal `children`.
 *
 * Lives in /shared because both detail views render it. Keeping it
 * top-level (rather than a closure inside each parent) keeps React's
 * component identity stable across renders — required by the React
 * Compiler's `react-hooks/static-components` rule.
 */
export function CollapsibleSection({
  title,
  icon,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon?: ReactNode;
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left cursor-pointer"
      >
        {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
        <span className="text-xs font-semibold text-slate-300 w-[68px] shrink-0">
          {title}
        </span>
        {!open && (
          <span className="flex-1 min-w-0 text-[11px] truncate">{summary}</span>
        )}
        {open ? (
          <ChevronUp className="ml-auto size-3.5 text-slate-500 shrink-0" />
        ) : (
          <ChevronDown className="ml-auto size-3.5 text-slate-500 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 border-t border-slate-700/40">
          {children}
        </div>
      )}
    </div>
  );
}
