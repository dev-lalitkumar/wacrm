import {
  Zap,
  MessageSquare,
  Tag,
  Users,
  Clock,
  GitBranch,
  ArrowDown,
} from "lucide-react";
import { MockupFrame } from "./mockup-frame";
import { cn } from "@/lib/utils";

type FlowNode = {
  icon: React.ElementType;
  label: string;
  detail: string;
  color: string;
  type: "trigger" | "condition" | "action" | "wait";
};

const FLOW_NODES: FlowNode[] = [
  { icon: Zap, label: "New Message Received", detail: "Keyword contains \"pricing\"", color: "bg-amber-500/20 text-amber-400 ring-amber-500/30", type: "trigger" },
  { icon: Tag, label: "Add Tag", detail: "\"Interested in Pricing\"", color: "bg-blue-500/20 text-blue-400 ring-blue-500/30", type: "action" },
  { icon: GitBranch, label: "Condition", detail: "Contact has tag \"Enterprise\"?", color: "bg-purple-500/20 text-purple-400 ring-purple-500/30", type: "condition" },
  { icon: MessageSquare, label: "Send Template", detail: "\"enterprise_pricing_v2\"", color: "bg-green-500/20 text-green-400 ring-green-500/30", type: "action" },
  { icon: Clock, label: "Wait", detail: "2 hours", color: "bg-zinc-500/20 text-zinc-400 ring-zinc-500/30", type: "wait" },
  { icon: Users, label: "Assign to", detail: "Round-robin: Sales Team", color: "bg-cyan-500/20 text-cyan-400 ring-cyan-500/30", type: "action" },
];

const SIDEBAR_AUTOMATIONS = [
  { name: "Welcome Flow", status: "Active", runs: 342 },
  { name: "Pricing Inquiry", status: "Active", runs: 128 },
  { name: "Follow-up Reminder", status: "Active", runs: 256 },
  { name: "Lead Qualification", status: "Paused", runs: 89 },
  { name: "After-Hours Reply", status: "Active", runs: 64 },
];

export function AutomationMockup({ className }: { className?: string }) {
  return (
    <MockupFrame url="app.crm.tundla.com/automations" className={className}>
      <div className="flex h-[460px] text-left">
        {/* Automation list sidebar */}
        <div className="hidden w-52 flex-col border-r border-white/5 bg-white/[0.02] md:flex">
          <div className="border-b border-white/5 px-3 py-3">
            <span className="text-sm font-medium text-foreground">Automations</span>
          </div>
          <div className="flex-1 overflow-hidden">
            {SIDEBAR_AUTOMATIONS.map((a, i) => (
              <div
                key={a.name}
                className={cn(
                  "flex items-center justify-between border-b border-white/5 px-3 py-2.5",
                  i === 1 && "bg-primary/10",
                )}
              >
                <div>
                  <p className="text-[12px] font-medium text-foreground">{a.name}</p>
                  <p className="text-[10px] text-muted-foreground">{a.runs} runs</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                    a.status === "Active"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-zinc-500/20 text-zinc-400",
                  )}
                >
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Flow canvas */}
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Pricing Inquiry</span>
              <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">Active</span>
            </div>
            <span className="text-[10px] text-muted-foreground">128 runs</span>
          </div>

          <div className="flex flex-1 items-start justify-center overflow-y-auto py-6">
            <div className="flex flex-col items-center">
              {FLOW_NODES.map((node, i) => (
                <div key={i} className="flex flex-col items-center">
                  {i > 0 && (
                    <div className="flex flex-col items-center py-1">
                      <div className="h-4 w-px bg-white/10" />
                      <ArrowDown className="size-3 text-white/20" />
                    </div>
                  )}
                  <div className={cn(
                    "flex w-64 items-center gap-3 rounded-xl border border-white/10 p-3 transition-all",
                    node.type === "condition" && "border-purple-500/30 bg-purple-500/5",
                    node.type === "trigger" && "border-amber-500/30 bg-amber-500/5",
                    node.type !== "condition" && node.type !== "trigger" && "bg-white/[0.02]",
                  )}>
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg ring-1", node.color)}>
                      <node.icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground">{node.label}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{node.detail}</p>
                    </div>
                  </div>
                  {node.type === "condition" && (
                    <div className="mt-1 flex gap-8 text-[9px]">
                      <span className="text-green-400">Yes ↓</span>
                      <span className="text-red-400">No → Skip</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}
