import {
  Search,
  Phone,
  Video,
  Send,
  CheckCheck,
  Paperclip,
  Image,
} from "lucide-react";
import { MockupFrame } from "./mockup-frame";
import { MockupNavRail } from "./mockup-nav-rail";
import { cn } from "@/lib/utils";

const CONVERSATIONS = [
  { name: "Aarav Mehta", msg: "Great, send me the proposal \u{1F64C}", time: "2m", unread: 2, active: true, tag: "Hot lead" },
  { name: "Sofia Rossi", msg: "Is the enterprise plan monthly?", time: "14m", unread: 0, active: false },
  { name: "Liam O'Connor", msg: "Thanks for the quick demo!", time: "1h", unread: 0, active: false },
  { name: "Priya Nair", msg: "Voice note (0:42)", time: "3h", unread: 0, active: false },
  { name: "Noah Williams", msg: "We'll sign this week.", time: "1d", unread: 0, active: false },
];

const THREAD = [
  { from: "them", text: "Hi! Saw your ad on Instagram — interested in the Pro plan.", time: "10:24" },
  { from: "me", text: "Welcome \u{1F44B} Happy to help. I've added you to our pipeline.", time: "10:25" },
  { from: "them", text: "Great, send me the proposal \u{1F64C}", time: "10:27" },
  { from: "me", text: "On its way — sharing the catalog + pricing now.", time: "10:27" },
];

export function InboxMockup({ className }: { className?: string }) {
  return (
    <MockupFrame url="app.crm.tundla.com/inbox" className={className}>
      <div className="flex h-[420px] text-left">
        <MockupNavRail activeIndex={0} />

        {/* Conversation list */}
        <div className="hidden w-60 flex-col border-r border-white/5 md:flex">
          <div className="border-b border-white/5 p-3">
            <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-muted-foreground">
              <Search className="size-3.5" />
              Search conversations
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {CONVERSATIONS.map((c) => (
              <div key={c.name} className={cn("flex items-start gap-3 border-b border-white/5 px-3 py-3", c.active && "bg-primary/10")}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-indigo-500/30 text-xs font-semibold text-white">
                  {c.name.split(" ").map((n) => n[0]).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px] font-medium text-foreground">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground">{c.time}</span>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{c.msg}</p>
                  {c.tag && <span className="mt-1 inline-block rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-medium text-primary">{c.tag}</span>}
                </div>
                {c.unread > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white">{c.unread}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat thread */}
        <div className="flex flex-1 flex-col bg-[#0a0a10]">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-indigo-500/30 text-xs font-semibold text-white">AM</span>
              <div>
                <p className="text-[13px] font-medium text-foreground">Aarav Mehta</p>
                <p className="text-[10px] text-green-400">online</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Phone className="size-4" />
              <Video className="size-4" />
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-hidden p-4">
            {THREAD.map((m, i) => (
              <div key={i} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[78%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed", m.from === "me" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-white/8 text-foreground")}>
                  {m.text}
                  <span className={cn("ml-2 inline-flex items-center gap-0.5 text-[9px]", m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {m.time}
                    {m.from === "me" && <CheckCheck className="size-3" />}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-white/5 p-3">
            <Paperclip className="size-4 text-muted-foreground" />
            <Image className="size-4 text-muted-foreground" />
            <div className="flex-1 rounded-full bg-white/5 px-4 py-2 text-[12px] text-muted-foreground">Type a message…</div>
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Send className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}
