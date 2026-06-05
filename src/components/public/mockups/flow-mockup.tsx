import { Bot, CheckCheck } from "lucide-react";
import { MockupFrame } from "./mockup-frame";
import { cn } from "@/lib/utils";

type Message = {
  from: "bot" | "user";
  text?: string;
  buttons?: string[];
  time: string;
};

const CONVERSATION: Message[] = [
  { from: "bot", text: "Hey there! \u{1F44B} Welcome to Tundla. I'm here to help you find the right plan.", time: "11:00" },
  { from: "bot", text: "What best describes your team size?", buttons: ["1-5 people", "6-20 people", "20+ people"], time: "11:00" },
  { from: "user", text: "6-20 people", time: "11:01" },
  { from: "bot", text: "Great choice! For teams of 6-20, our Pro plan is the most popular. It includes:", time: "11:01" },
  { from: "bot", text: "✓ Shared WhatsApp inbox\n✓ Unlimited pipelines\n✓ Automations & flows\n✓ Reports dashboard", time: "11:01" },
  { from: "bot", text: "Would you like to:", buttons: ["See pricing", "Book a demo", "Talk to sales"], time: "11:01" },
  { from: "user", text: "Book a demo", time: "11:02" },
  { from: "bot", text: "Awesome! Let me connect you with our sales team. A human agent will be with you shortly. \u{1F64F}", time: "11:02" },
];

export function FlowMockup({ className }: { className?: string }) {
  return (
    <MockupFrame url="app.crm.tundla.com/flows/builder" className={className}>
      <div className="flex h-[460px] text-left">
        {/* Flow info sidebar */}
        <div className="hidden w-48 flex-col border-r border-white/5 bg-white/[0.02] sm:flex">
          <div className="border-b border-white/5 px-3 py-3">
            <div className="flex items-center gap-2">
              <Bot className="size-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Welcome Bot</span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Keyword: &quot;hello&quot;, &quot;hi&quot;, &quot;start&quot;</p>
          </div>
          <div className="flex-1 space-y-2 p-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</p>
              <span className="mt-1 inline-block rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">Active</span>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Nodes</p>
              <p className="mt-0.5 text-xs text-foreground">8 nodes</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Runs Today</p>
              <p className="mt-0.5 text-xs text-foreground">47 conversations</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Handoff Rate</p>
              <p className="mt-0.5 text-xs text-foreground">23%</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Fallback</p>
              <p className="mt-0.5 text-xs text-foreground">Reprompt 2x, then handoff</p>
            </div>
            <div className="mt-3 border-t border-white/5 pt-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Variables</p>
              <div className="mt-1 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">team_size</span>
                  <span className="text-foreground">&quot;6-20&quot;</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">interest</span>
                  <span className="text-foreground">&quot;demo&quot;</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chat preview */}
        <div className="flex flex-1 flex-col bg-[#0a0a10]">
          <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/20">
              <Bot className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-foreground">Flow Preview</p>
              <p className="text-[10px] text-muted-foreground">Simulated conversation</p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {CONVERSATION.map((msg, i) => (
              <div key={i} className={cn("flex", msg.from === "user" ? "justify-end" : "justify-start")}>
                <div className="max-w-[80%]">
                  <div className={cn(
                    "rounded-2xl px-3 py-2 text-[12px] leading-relaxed",
                    msg.from === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-white/8 text-foreground",
                  )}>
                    {msg.text && <span className="whitespace-pre-line">{msg.text}</span>}
                    {msg.text && (
                      <span className={cn("ml-2 text-[9px]", msg.from === "user" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {msg.time}
                        {msg.from === "user" && <CheckCheck className="ml-0.5 inline size-3" />}
                      </span>
                    )}
                  </div>
                  {msg.buttons && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {msg.buttons.map((btn) => (
                        <span
                          key={btn}
                          className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary"
                        >
                          {btn}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}
