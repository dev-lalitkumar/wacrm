import {
  Webhook,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { MockupFrame } from "./mockup-frame";
import { cn } from "@/lib/utils";

const FIELD_MAPPINGS = [
  { from: "data.name", to: "Contact Name", mapped: true },
  { from: "data.email", to: "Contact Email", mapped: true },
  { from: "data.phone", to: "Contact Phone", mapped: true },
  { from: "data.company", to: "Company", mapped: true },
  { from: "data.interest", to: "Deal Title", mapped: true },
  { from: "data.budget", to: "Deal Value", mapped: true },
];

const REQUEST_LOG = [
  { time: "11:42:15", status: "ok", contact: "Aarav Mehta", source: "Zapier" },
  { time: "11:38:22", status: "ok", contact: "Sofia Rossi", source: "Website" },
  { time: "11:35:09", status: "ok", contact: "Liam O'Connor", source: "Zapier" },
  { time: "11:31:45", status: "rate_limited", contact: "—", source: "Bot" },
  { time: "11:28:33", status: "ok", contact: "Priya Nair", source: "Website" },
];

const statusConfig = {
  ok: { icon: CheckCircle2, color: "text-green-400", label: "OK" },
  rate_limited: { icon: AlertCircle, color: "text-amber-400", label: "Rate Limited" },
};

export function WebhookMockup({ className }: { className?: string }) {
  return (
    <MockupFrame url="app.crm.tundla.com/settings/integrations" className={className}>
      <div className="flex h-[440px] text-left">
        {/* Payload preview */}
        <div className="flex flex-1 flex-col border-r border-white/5">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
            <Webhook className="size-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Website Contact Form</span>
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">Active</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Endpoint */}
            <div className="rounded-lg bg-[#0a0a10] p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Endpoint</p>
              <p className="mt-1 break-all font-mono text-[11px] text-foreground">POST https://crm.tundla.com/api/webhooks/wh_7kx9...</p>
            </div>

            {/* Sample payload */}
            <div className="mt-3 rounded-lg bg-[#0a0a10] p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Sample Payload</p>
              <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed">
                <code>
                  <span className="text-muted-foreground">{"{"}</span>{"\n"}
                  <span className="text-muted-foreground">{"  "}</span><span className="text-purple-400">&quot;data&quot;</span><span className="text-muted-foreground">: {"{"}</span>{"\n"}
                  <span className="text-muted-foreground">{"    "}</span><span className="text-purple-400">&quot;name&quot;</span><span className="text-muted-foreground">: </span><span className="text-green-400">&quot;Aarav Mehta&quot;</span><span className="text-muted-foreground">,</span>{"\n"}
                  <span className="text-muted-foreground">{"    "}</span><span className="text-purple-400">&quot;email&quot;</span><span className="text-muted-foreground">: </span><span className="text-green-400">&quot;aarav@northwind.com&quot;</span><span className="text-muted-foreground">,</span>{"\n"}
                  <span className="text-muted-foreground">{"    "}</span><span className="text-purple-400">&quot;phone&quot;</span><span className="text-muted-foreground">: </span><span className="text-green-400">&quot;+919876543210&quot;</span><span className="text-muted-foreground">,</span>{"\n"}
                  <span className="text-muted-foreground">{"    "}</span><span className="text-purple-400">&quot;company&quot;</span><span className="text-muted-foreground">: </span><span className="text-green-400">&quot;Northwind Retail&quot;</span><span className="text-muted-foreground">,</span>{"\n"}
                  <span className="text-muted-foreground">{"    "}</span><span className="text-purple-400">&quot;interest&quot;</span><span className="text-muted-foreground">: </span><span className="text-green-400">&quot;Pro Plan&quot;</span><span className="text-muted-foreground">,</span>{"\n"}
                  <span className="text-muted-foreground">{"    "}</span><span className="text-purple-400">&quot;budget&quot;</span><span className="text-muted-foreground">: </span><span className="text-amber-400">120000</span>{"\n"}
                  <span className="text-muted-foreground">{"  }"}</span>{"\n"}
                  <span className="text-muted-foreground">{"}"}</span>
                </code>
              </pre>
            </div>

            {/* Field mapping */}
            <div className="mt-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Field Mapping</p>
              <div className="mt-2 space-y-1.5">
                {FIELD_MAPPINGS.map((m) => (
                  <div key={m.from} className="flex items-center gap-2 text-[11px]">
                    <span className="w-28 truncate rounded bg-[#0a0a10] px-2 py-1 font-mono text-purple-400">{m.from}</span>
                    <ArrowRight className="size-3 text-primary" />
                    <span className="rounded bg-primary/10 px-2 py-1 text-primary">{m.to}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Request log */}
        <div className="hidden w-60 flex-col lg:flex">
          <div className="flex items-center gap-2 border-b border-white/5 px-3 py-3">
            <Clock className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Recent Requests</span>
          </div>
          <div className="flex-1 overflow-hidden">
            {REQUEST_LOG.map((req, i) => {
              const cfg = statusConfig[req.status as keyof typeof statusConfig];
              return (
                <div key={i} className="flex items-center gap-2 border-b border-white/5 px-3 py-2.5">
                  <cfg.icon className={cn("size-3.5 shrink-0", cfg.color)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-foreground">{req.contact}</p>
                    <p className="text-[9px] text-muted-foreground">{req.source} · {req.time}</p>
                  </div>
                  <span className={cn("text-[9px]", cfg.color)}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-white/5 p-3">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Rate limit</span>
              <span className="text-foreground">60 req/min</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Assignment</span>
              <span className="text-foreground">Round-robin</span>
            </div>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}
