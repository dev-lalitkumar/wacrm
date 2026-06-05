import {
  Megaphone,
  Users,
} from "lucide-react";
import { MockupFrame } from "./mockup-frame";
import { cn } from "@/lib/utils";

const DELIVERY_STATS = [
  { label: "Sent", value: 1247, pct: 100, color: "bg-blue-500" },
  { label: "Delivered", value: 1198, pct: 96, color: "bg-green-500" },
  { label: "Read", value: 843, pct: 68, color: "bg-purple-500" },
  { label: "Replied", value: 312, pct: 25, color: "bg-amber-500" },
  { label: "Failed", value: 49, pct: 4, color: "bg-red-500" },
];

const RECENT_BROADCASTS = [
  { name: "June Promo — 20% Off", status: "Completed", sent: 1247, read: "68%" },
  { name: "Product Launch Announcement", status: "Completed", sent: 892, read: "72%" },
  { name: "Re-engagement Campaign", status: "Scheduled", sent: 0, read: "—" },
  { name: "Diwali Sale Preview", status: "Draft", sent: 0, read: "—" },
];

export function BroadcastMockup({ className }: { className?: string }) {
  return (
    <MockupFrame url="app.crm.tundla.com/broadcasts" className={className}>
      <div className="flex h-[440px] text-left">
        {/* Campaign list */}
        <div className="hidden w-56 flex-col border-r border-white/5 bg-white/[0.02] md:flex">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-3">
            <span className="text-sm font-medium text-foreground">Broadcasts</span>
            <button className="rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground">+ New</button>
          </div>
          <div className="flex-1 overflow-hidden">
            {RECENT_BROADCASTS.map((b, i) => (
              <div key={b.name} className={cn("border-b border-white/5 px-3 py-2.5", i === 0 && "bg-primary/10")}>
                <p className="truncate text-[12px] font-medium text-foreground">{b.name}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                    b.status === "Completed" ? "bg-green-500/20 text-green-400" :
                    b.status === "Scheduled" ? "bg-blue-500/20 text-blue-400" :
                    "bg-zinc-500/20 text-zinc-400",
                  )}>{b.status}</span>
                  {b.sent > 0 && <span className="text-[10px] text-muted-foreground">{b.sent} sent</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Campaign detail */}
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Megaphone className="size-4 text-primary" />
              <span className="text-sm font-medium text-foreground">June Promo — 20% Off</span>
              <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">Completed</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Template preview */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Template</p>
              <div className="mt-2 rounded-lg bg-[#0a0a10] p-3">
                <div className="rounded-lg bg-white/8 p-3 text-[12px] leading-relaxed text-foreground">
                  <p className="font-medium">{"\u{1F525}"} Exclusive June Offer!</p>
                  <p className="mt-1 text-muted-foreground">Hi {"{{contact_name}}"}, we&apos;re celebrating our anniversary with 20% off all plans this month!</p>
                  <p className="mt-1 text-muted-foreground">Use code <span className="font-mono font-medium text-primary">JUNE20</span> at checkout.</p>
                  <div className="mt-2 flex gap-2">
                    <span className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">Claim Offer</span>
                    <span className="rounded-lg border border-white/10 px-3 py-1 text-[11px] text-muted-foreground">Learn More</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Audience */}
            <div className="mt-3 flex items-center gap-4 rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <Users className="size-4 text-primary" />
              <div>
                <p className="text-xs font-medium text-foreground">Audience: Active Contacts</p>
                <p className="text-[10px] text-muted-foreground">Tag: &quot;Active&quot; · Status: Qualified or Contacted · 1,247 recipients</p>
              </div>
            </div>

            {/* Delivery stats */}
            <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <p className="text-xs font-medium text-foreground">Delivery Analytics</p>
              <div className="mt-3 space-y-2">
                {DELIVERY_STATS.map((stat) => (
                  <div key={stat.label} className="flex items-center gap-3">
                    <span className="w-16 text-[11px] text-muted-foreground">{stat.label}</span>
                    <div className="flex-1">
                      <div className="h-4 rounded bg-white/5">
                        <div className={cn("h-4 rounded", stat.color)} style={{ width: `${stat.pct}%` }} />
                      </div>
                    </div>
                    <span className="w-12 text-right text-[11px] font-medium text-foreground">{stat.value.toLocaleString()}</span>
                    <span className="w-8 text-right text-[10px] text-muted-foreground">{stat.pct}%</span>
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
