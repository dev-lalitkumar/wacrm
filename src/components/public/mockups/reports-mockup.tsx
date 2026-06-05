import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Calendar,
} from "lucide-react";
import { MockupFrame } from "./mockup-frame";
import { MockupNavRail } from "./mockup-nav-rail";
import { cn } from "@/lib/utils";

const STAT_CARDS = [
  { label: "Revenue This Month", value: "₹18.4L", change: "+23%", up: true },
  { label: "Deals Won", value: "47", change: "+12%", up: true },
  { label: "Avg. Deal Size", value: "₹39.1K", change: "+8%", up: true },
  { label: "Deals Lost", value: "11", change: "-5%", up: false },
];

const FUNNEL_STAGES = [
  { name: "New Lead", count: 124, width: "100%" },
  { name: "Qualified", count: 82, width: "66%" },
  { name: "Proposal", count: 51, width: "41%" },
  { name: "Negotiation", count: 34, width: "27%" },
  { name: "Won", count: 22, width: "18%" },
];

const BAR_DATA = [
  { month: "Jan", value: 65 },
  { month: "Feb", value: 72 },
  { month: "Mar", value: 58 },
  { month: "Apr", value: 89 },
  { month: "May", value: 94 },
  { month: "Jun", value: 78 },
];

const SOURCE_DATA = [
  { name: "Meta Ads", deals: 34, revenue: "₹8.2L", pct: 45 },
  { name: "WhatsApp", deals: 28, revenue: "₹5.6L", pct: 30 },
  { name: "Website", deals: 15, revenue: "₹3.1L", pct: 17 },
  { name: "Direct", deals: 8, revenue: "₹1.5L", pct: 8 },
];

export function ReportsMockup({ className }: { className?: string }) {
  return (
    <MockupFrame url="app.crm.tundla.com/reports" className={className}>
      <div className="flex h-[460px] text-left">
        <MockupNavRail activeIndex={4} />

        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <span className="text-sm font-medium text-foreground">Reports Dashboard</span>
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3" />
              Last 30 days
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STAT_CARDS.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{stat.value}</p>
                  <div className={cn("mt-1 flex items-center gap-0.5 text-[10px] font-medium", stat.up ? "text-green-400" : "text-red-400")}>
                    {stat.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {stat.change}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {/* Bar chart */}
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <p className="text-xs font-medium text-foreground">Monthly Revenue</p>
                <div className="mt-3 flex items-end gap-2">
                  {BAR_DATA.map((d) => (
                    <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-primary to-primary/60"
                        style={{ height: `${d.value}px` }}
                      />
                      <span className="text-[9px] text-muted-foreground">{d.month}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Funnel */}
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <p className="text-xs font-medium text-foreground">Conversion Funnel</p>
                <div className="mt-3 space-y-2">
                  {FUNNEL_STAGES.map((stage) => (
                    <div key={stage.name} className="flex items-center gap-2">
                      <span className="w-20 text-[10px] text-muted-foreground">{stage.name}</span>
                      <div className="flex-1">
                        <div
                          className="h-5 rounded bg-gradient-to-r from-primary to-primary/40"
                          style={{ width: stage.width }}
                        />
                      </div>
                      <span className="w-8 text-right text-[10px] font-medium text-foreground">{stage.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Source ROI */}
            <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <p className="text-xs font-medium text-foreground">Source ROI</p>
              <div className="mt-2">
                {SOURCE_DATA.map((src) => (
                  <div key={src.name} className="flex items-center gap-3 border-b border-white/5 py-2 last:border-0">
                    <span className="w-20 text-[11px] text-foreground">{src.name}</span>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-white/5">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${src.pct}%` }} />
                      </div>
                    </div>
                    <span className="w-12 text-right text-[10px] text-muted-foreground">{src.deals} deals</span>
                    <span className="w-14 text-right text-[10px] font-medium text-foreground">{src.revenue}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}
