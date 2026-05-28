"use client";

import { useMemo } from "react";
import type { Deal, PipelineStage } from "@/types";
import {
  DollarSign,
  TrendingUp,
  Target,
  BarChart3,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PipelineAnalyticsProps {
  stages: PipelineStage[];
  deals: Deal[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Weighted pipeline value: value × per-stage probability.
 * Stages interpolate linearly from 10% (first stage) to 90% (last stage).
 * e.g. New ≈ 10%, Qualified ≈ 37%, Proposal Sent ≈ 63%, Negotiation ≈ 90%.
 */
function computeStageProbability(
  stage: PipelineStage,
  sortedStages: PipelineStage[],
): number {
  const n = sortedStages.length;
  if (n <= 1) return 0.5;
  const index = sortedStages.findIndex((s) => s.id === stage.id);
  if (index < 0) return 0;
  const t = index / (n - 1);
  return 0.1 + t * (0.9 - 0.1);
}

export function PipelineAnalytics({ stages, deals }: PipelineAnalyticsProps) {
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages],
  );

  const stats = useMemo(() => {
    // All deals passed in are open (filtered by parent), but guard anyway
    const openDeals = deals.filter((d) => d.status === "open" || !d.status);

    const totalCount = openDeals.length;
    const totalValue = openDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const avgValue = totalCount > 0 ? totalValue / totalCount : 0;

    const stageById = new Map(sortedStages.map((s) => [s.id, s]));
    const weightedValue = openDeals.reduce((sum, d) => {
      const stage = stageById.get(d.stage_id);
      if (!stage) return sum;
      const prob = computeStageProbability(stage, sortedStages);
      return sum + Number(d.value || 0) * prob;
    }, 0);

    return { totalCount, totalValue, avgValue, weightedValue };
  }, [deals, sortedStages]);

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-4">
        <Metric
          icon={<BarChart3 className="h-4 w-4 text-slate-400" />}
          label="Open Deals"
          value={String(stats.totalCount)}
          tooltip="Count of all open deals in the pipeline."
        />
        <Metric
          icon={<DollarSign className="h-4 w-4 text-primary" />}
          label="Pipeline Value"
          value={formatCurrency(stats.totalValue)}
          tooltip="Sum of the dollar values of all open deals in the pipeline."
        />
        <Metric
          icon={<Target className="h-4 w-4 text-blue-400" />}
          label="Avg Deal Size"
          value={formatCurrency(stats.avgValue)}
          tooltip="Pipeline Value divided by Open Deals — the average value of a single deal."
        />
        <Metric
          icon={<TrendingUp className="h-4 w-4 text-purple-400" />}
          label="Weighted Value"
          value={formatCurrency(stats.weightedValue)}
          tooltip="Expected revenue: each deal's value × its stage probability. New ≈ 10%, Qualified ≈ 37%, Proposal Sent ≈ 63%, Negotiation ≈ 90%."
        />
      </div>
    </TooltipProvider>
  );
}

function Metric({
  icon,
  label,
  value,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tooltip: string;
}) {
  return (
    <div className="rounded-lg bg-slate-800/50 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
        {icon}
        <span>{label}</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={`How ${label} is calculated`}
                className="ml-auto text-slate-500 hover:text-slate-300 focus:outline-none"
              />
            }
          >
            <Info className="h-3 w-3" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-left">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}
