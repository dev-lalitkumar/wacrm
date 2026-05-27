"use client";

import { useState } from "react";

export type ReportPeriod = "week" | "month" | "year";

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

interface ReportFiltersProps {
  onChange: (range: DateRange) => void;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function buildRange(period: ReportPeriod, year: number, month: number): DateRange {
  const now = new Date();

  if (period === "week") {
    const start = new Date(now);
    const day = start.getDay(); // 0=Sun
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end, label: "This Week" };
  }

  if (period === "month") {
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return {
      startDate: start,
      endDate: end,
      label: `${MONTHS[month]} ${year}`,
    };
  }

  // year
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { startDate: start, endDate: end, label: `${year}` };
}

export function ReportFilters({ onChange }: ReportFiltersProps) {
  const now = new Date();
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // Build and emit the current range
  function emit(p: ReportPeriod, y: number, m: number) {
    onChange(buildRange(p, y, m));
  }

  function handlePeriod(p: ReportPeriod) {
    setPeriod(p);
    emit(p, year, month);
  }

  function handleYear(y: number) {
    setYear(y);
    emit(period, y, month);
  }

  function handleMonth(m: number) {
    setMonth(m);
    emit(period, year, m);
  }

  // Generate year options: current year ± 3
  const currentYear = now.getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Period selector */}
      <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 p-0.5">
        {(["week", "month", "year"] as ReportPeriod[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handlePeriod(p)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              period === p
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {p === "week" ? "This Week" : p === "month" ? "This Month" : "This Year"}
          </button>
        ))}
      </div>

      {/* Year picker — always visible */}
      <select
        value={year}
        onChange={(e) => handleYear(Number(e.target.value))}
        className="h-8 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white outline-none focus:border-primary"
      >
        {yearOptions.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {/* Month picker — only visible when period is "month" */}
      {period === "month" && (
        <select
          value={month}
          onChange={(e) => handleMonth(Number(e.target.value))}
          className="h-8 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white outline-none focus:border-primary"
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i}>{m}</option>
          ))}
        </select>
      )}

      <span className="text-[11px] text-slate-500 ml-1">
        {buildRange(period, year, month).label}
      </span>
    </div>
  );
}

/** Build initial default range (this month) for page initialisation */
export function defaultDateRange(): DateRange {
  const now = new Date();
  return buildRange("month", now.getFullYear(), now.getMonth());
}
