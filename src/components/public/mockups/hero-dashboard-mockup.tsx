import {
  Inbox,
  KanbanSquare,
  BarChart3,
  Users,
  Bell,
  Megaphone,
  Search,
  CheckCheck,
  TrendingUp,
  Clock,
  MessageSquare,
  Mail,
} from "lucide-react";
import { LogoMark } from "../logo";
import { cn } from "@/lib/utils";

const MINI_CONVERSATIONS = [
  { name: "Aarav M.", msg: "Send me the proposal!", unread: 2, channel: "whatsapp" as const },
  { name: "Sofia R.", msg: "Re: Enterprise Pricing", unread: 1, channel: "email" as const },
  { name: "Liam O.", msg: "Thanks for the demo!", unread: 0, channel: "whatsapp" as const },
  { name: "Priya N.", msg: "Voice note (0:42)", unread: 0, channel: "whatsapp" as const },
];

const MINI_DEALS = [
  { name: "Northwind", value: "₹1.2L", stage: "New", color: "bg-blue-500" },
  { name: "Lumio Studio", value: "₹1.2L", stage: "New", color: "bg-blue-500" },
  { name: "Vertex Labs", value: "₹2.8L", stage: "Qualified", color: "bg-amber-500" },
  { name: "Bluepeak", value: "₹3.6L", stage: "Proposal", color: "bg-purple-500" },
  { name: "Kanso Digital", value: "₹5.1L", stage: "Negotiation", color: "bg-green-500" },
];

const MINI_STATS = [
  { label: "Revenue", value: "₹18.4L", change: "+23%", icon: TrendingUp },
  { label: "Deals Won", value: "47", change: "+12%", icon: KanbanSquare },
  { label: "Response Time", value: "4.2m", change: "-18%", icon: Clock },
];

const channelIcons = { whatsapp: MessageSquare, email: Mail };

export function HeroDashboardMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c12] shadow-2xl ring-1 shadow-black/60 ring-white/5",
        className,
      )}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.03] px-4 py-3">
        <span className="size-3 rounded-full bg-red-400/80" />
        <span className="size-3 rounded-full bg-yellow-400/80" />
        <span className="size-3 rounded-full bg-green-400/80" />
        <div className="ml-3 flex items-center gap-2 rounded-md bg-white/5 px-3 py-1 text-[11px] text-muted-foreground">
          app.crm.tundla.com/dashboard
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <Bell className="size-4 text-muted-foreground" />
            <span className="absolute -right-1 -top-1 flex size-3 items-center justify-center rounded-full bg-red-500 text-[7px] font-bold text-white">3</span>
          </div>
          <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-indigo-500/30 text-[9px] font-semibold text-white">RK</span>
        </div>
      </div>

      <div className="flex h-[400px] text-left">
        {/* Nav rail */}
        <div className="hidden w-14 flex-col items-center gap-1 border-r border-white/5 bg-white/[0.02] py-4 sm:flex">
          <LogoMark size={28} className="mb-3" />
          {[
            { icon: Inbox, active: true },
            { icon: KanbanSquare, active: false },
            { icon: Megaphone, active: false },
            { icon: Users, active: false },
            { icon: BarChart3, active: false },
          ].map(({ icon: Icon, active }, i) => (
            <span
              key={i}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg",
                active ? "bg-primary/20 text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-[18px]" />
            </span>
          ))}
        </div>

        <div className="flex flex-1 flex-col">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 border-b border-white/5 p-3">
            {MINI_STATS.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                <div className="flex items-center gap-1.5">
                  <stat.icon className="size-3 text-primary" />
                  <span className="text-[10px] text-muted-foreground">{stat.label}</span>
                </div>
                <p className="mt-1 text-lg font-bold text-foreground">{stat.value}</p>
                <span className="text-[10px] font-medium text-green-400">{stat.change}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-1">
            {/* Inbox preview */}
            <div className="flex w-1/2 flex-col border-r border-white/5">
              <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <Inbox className="size-3.5 text-primary" />
                  <span className="text-[11px] font-medium text-foreground">Inbox</span>
                  <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-[9px] font-medium text-green-400">3 new</span>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                {MINI_CONVERSATIONS.map((c) => {
                  const ChannelIcon = channelIcons[c.channel];
                  return (
                    <div key={c.name} className="flex items-center gap-2.5 border-b border-white/5 px-3 py-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-indigo-500/30 text-[9px] font-semibold text-white">
                        {c.name.split(" ").map((n) => n[0]).join("")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[11px] font-medium text-foreground">{c.name}</span>
                          <ChannelIcon className={cn("size-3", c.channel === "email" ? "text-blue-400" : "text-green-400")} />
                        </div>
                        <p className="truncate text-[10px] text-muted-foreground">{c.msg}</p>
                      </div>
                      {c.unread > 0 && (
                        <span className="flex size-4 items-center justify-center rounded-full bg-green-500 text-[8px] font-bold text-white">{c.unread}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pipeline preview */}
            <div className="flex w-1/2 flex-col">
              <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <KanbanSquare className="size-3.5 text-primary" />
                  <span className="text-[11px] font-medium text-foreground">Pipeline</span>
                </div>
                <span className="text-[10px] font-medium text-primary">₹13.9L</span>
              </div>
              <div className="flex-1 overflow-hidden px-2 py-2">
                {MINI_DEALS.map((deal) => (
                  <div key={deal.name} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.02]">
                    <span className={cn("size-2 rounded-full", deal.color)} />
                    <span className="flex-1 text-[11px] text-foreground">{deal.name}</span>
                    <span className="text-[11px] font-medium text-foreground">{deal.value}</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-muted-foreground">{deal.stage}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
