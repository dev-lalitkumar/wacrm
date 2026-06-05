import {
  Bell,
  Mail,
  MessageSquare,
  UserPlus,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Clock,
} from "lucide-react";
import { MockupFrame } from "./mockup-frame";
import { cn } from "@/lib/utils";

const IN_APP_NOTIFICATIONS = [
  { icon: UserPlus, title: "New contact assigned", detail: "Sofia Rossi was assigned to you", time: "2m", unread: true, color: "text-blue-400 bg-blue-500/20" },
  { icon: DollarSign, title: "Deal won!", detail: "Vertex Labs — ₹2.8L closed by Rahul", time: "15m", unread: true, color: "text-green-400 bg-green-500/20" },
  { icon: FileText, title: "Proposal viewed", detail: "Aarav Mehta opened your proposal", time: "1h", unread: true, color: "text-purple-400 bg-purple-500/20" },
  { icon: Clock, title: "Reminder due", detail: "Follow up with Priya Nair — call scheduled", time: "2h", unread: false, color: "text-amber-400 bg-amber-500/20" },
  { icon: AlertTriangle, title: "SLA breach", detail: "Lead response time exceeded for Noah Williams", time: "3h", unread: false, color: "text-red-400 bg-red-500/20" },
  { icon: CheckCircle2, title: "Proposal accepted", detail: "Meera Joshi accepted — Kanso Digital deal", time: "5h", unread: false, color: "text-green-400 bg-green-500/20" },
];

export function NotificationMockup({ className }: { className?: string }) {
  return (
    <MockupFrame url="app.crm.tundla.com/notifications" className={className}>
      <div className="flex h-[440px] text-left">
        {/* In-app notifications */}
        <div className="flex flex-1 flex-col border-r border-white/5">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bell className="size-4 text-primary" />
                <span className="absolute -right-1 -top-1 flex size-3 items-center justify-center rounded-full bg-red-500 text-[7px] font-bold text-white">3</span>
              </div>
              <span className="text-sm font-medium text-foreground">In-App</span>
            </div>
            <button className="text-[10px] text-primary">Mark all read</button>
          </div>
          <div className="flex-1 overflow-hidden">
            {IN_APP_NOTIFICATIONS.map((n, i) => (
              <div key={i} className={cn("flex items-start gap-3 border-b border-white/5 px-4 py-3", n.unread && "bg-primary/[0.03]")}>
                <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", n.color)}>
                  <n.icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("text-[12px]", n.unread ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>{n.title}</p>
                    <span className="shrink-0 text-[9px] text-muted-foreground">{n.time}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{n.detail}</p>
                </div>
                {n.unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
              </div>
            ))}
          </div>
        </div>

        {/* Channel previews */}
        <div className="hidden w-56 flex-col lg:flex">
          {/* Email notification */}
          <div className="flex-1 border-b border-white/5 p-3">
            <div className="flex items-center gap-2 pb-2">
              <Mail className="size-3.5 text-blue-400" />
              <span className="text-[10px] font-medium text-foreground">Email Channel</span>
            </div>
            <div className="rounded-lg border border-white/5 bg-[#0a0a10] p-3">
              <p className="text-[10px] text-muted-foreground">To: rahul@company.com</p>
              <p className="mt-1 text-[11px] font-medium text-foreground">New deal assigned to you</p>
              <div className="mt-2 space-y-1 text-[10px] leading-relaxed text-muted-foreground">
                <p>Hi Rahul,</p>
                <p>A new deal <span className="text-foreground">Northwind Retail — ₹1.2L</span> has been assigned to you.</p>
                <p>Contact: Aarav Mehta</p>
                <p className="mt-2 text-primary">View Deal →</p>
              </div>
            </div>
          </div>

          {/* WhatsApp notification */}
          <div className="flex-1 p-3">
            <div className="flex items-center gap-2 pb-2">
              <MessageSquare className="size-3.5 text-green-400" />
              <span className="text-[10px] font-medium text-foreground">WhatsApp Channel</span>
            </div>
            <div className="rounded-lg border border-white/5 bg-[#0a0a10] p-3">
              <div className="rounded-lg bg-white/8 p-2.5 text-[11px] leading-relaxed text-foreground">
                <p>{"\u{1F514}"} <span className="font-medium">Reminder Due</span></p>
                <p className="mt-1 text-muted-foreground">You have a follow-up call with <span className="text-foreground">Priya Nair</span> scheduled for today at 3:00 PM.</p>
                <p className="mt-1 text-muted-foreground">Deal: Saffron & Co. — ₹1.7L</p>
                <div className="mt-2">
                  <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Open CRM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}
