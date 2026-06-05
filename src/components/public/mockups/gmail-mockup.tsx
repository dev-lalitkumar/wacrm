import {
  Mail,
  Send,
  Inbox,
  Star,
  CheckCircle2,
  Eye,
  Clock,
  Paperclip,
} from "lucide-react";
import { MockupFrame } from "./mockup-frame";
import { cn } from "@/lib/utils";

const EMAILS = [
  { from: "Aarav Mehta", subject: "Re: Pro Plan Pricing", snippet: "Looks good, let me discuss with my team and get back to…", time: "10:45 AM", read: true, starred: true, status: "opened" as const },
  { from: "Sofia Rossi", subject: "Enterprise Inquiry", snippet: "Hi, I'd like to know more about your enterprise features and…", time: "9:30 AM", read: false, starred: false, status: "delivered" as const },
  { from: "Liam O'Connor", subject: "Re: Demo Follow-up", snippet: "Thanks for the demo yesterday! The pipeline feature looks exactly…", time: "Yesterday", read: true, starred: false, status: "opened" as const },
  { from: "Priya Nair", subject: "Proposal Review", snippet: "I've reviewed the proposal and have a few questions about the…", time: "Yesterday", read: true, starred: false, status: "delivered" as const },
  { from: "Noah Williams", subject: "Contract Ready", snippet: "We're ready to proceed. Please send over the final agreement…", time: "Jun 2", read: true, starred: true, status: "opened" as const },
];

const statusConfig = {
  opened: { icon: Eye, label: "Opened", color: "text-green-400" },
  delivered: { icon: CheckCircle2, label: "Delivered", color: "text-blue-400" },
};

export function GmailMockup({ className }: { className?: string }) {
  return (
    <MockupFrame url="app.crm.tundla.com/inbox?channel=email" className={className}>
      <div className="flex h-[420px] text-left">
        {/* Sidebar */}
        <div className="hidden w-48 flex-col border-r border-white/5 bg-white/[0.02] sm:flex">
          <div className="p-3">
            <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
              <Send className="size-4" />
              Compose
            </button>
          </div>
          <nav className="flex-1 px-2">
            {[
              { icon: Inbox, label: "Inbox", count: 3, active: true },
              { icon: Send, label: "Sent", count: 0, active: false },
              { icon: Star, label: "Starred", count: 2, active: false },
              { icon: Clock, label: "Scheduled", count: 0, active: false },
            ].map((item) => (
              <div
                key={item.label}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                  item.active
                    ? "bg-primary/15 font-medium text-primary"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                {item.count > 0 && (
                  <span className="text-xs text-muted-foreground">{item.count}</span>
                )}
              </div>
            ))}
          </nav>
          <div className="border-t border-white/5 p-3">
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2">
              <div className="size-2 rounded-full bg-green-500" />
              <span className="text-xs text-green-400">Gmail connected</span>
            </div>
          </div>
        </div>

        {/* Email list */}
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Inbox</span>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">3 new</span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {EMAILS.map((email) => {
              const StatusIcon = statusConfig[email.status].icon;
              return (
                <div
                  key={email.subject}
                  className={cn(
                    "flex items-start gap-3 border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/[0.02]",
                    !email.read && "bg-primary/5",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/20 text-xs font-semibold text-white">
                    {email.from.split(" ").map((n) => n[0]).join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-[13px]", !email.read ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
                        {email.from}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{email.time}</span>
                    </div>
                    <p className={cn("truncate text-[12px]", !email.read ? "font-medium text-foreground/90" : "text-muted-foreground")}>
                      {email.subject}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{email.snippet}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {email.starred && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
                    <div className={cn("flex items-center gap-1 text-[9px]", statusConfig[email.status].color)}>
                      <StatusIcon className="size-3" />
                      {statusConfig[email.status].label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}

export function GmailComposeMockup({ className }: { className?: string }) {
  return (
    <MockupFrame url="app.crm.tundla.com/inbox?compose=new" className={className}>
      <div className="flex h-[420px] flex-col text-left">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <Mail className="size-4 text-primary" />
          <span className="text-sm font-medium text-foreground">New Email</span>
        </div>
        <div className="flex-1 p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <span className="w-12 text-xs text-muted-foreground">To:</span>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/20 px-2.5 py-1 text-xs font-medium text-primary">Aarav Mehta &lt;aarav@northwind.com&gt;</span>
              </div>
            </div>
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <span className="w-12 text-xs text-muted-foreground">CC:</span>
              <span className="text-xs text-muted-foreground/50">Add recipients</span>
            </div>
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <span className="w-12 text-xs text-muted-foreground">Subject:</span>
              <span className="text-sm text-foreground">Pro Plan — Pricing & Proposal</span>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-foreground/80">
              <p>Hi Aarav,</p>
              <p>Thanks for your interest in the Pro plan! I&apos;ve attached our detailed proposal with pricing for your team of 12.</p>
              <p>The proposal includes volume discounts and the onboarding package we discussed. You can review and accept it directly from the link.</p>
              <p>Looking forward to getting your team onboarded!</p>
              <p className="text-muted-foreground">Best,<br />Rahul — Tundla CRM</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-white/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              <Send className="size-3.5" />
              Send
            </button>
            <Paperclip className="size-4 text-muted-foreground" />
          </div>
          <span className="text-[10px] text-muted-foreground">Sending from rahul@tundla.com via Gmail</span>
        </div>
      </div>
    </MockupFrame>
  );
}
