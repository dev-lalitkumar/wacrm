import {
  Phone,
  PhoneCall,
  PhoneOff,
  Clock,
  Mic,
  MicOff,
  Volume2,
  User,
} from "lucide-react";
import { MockupFrame } from "./mockup-frame";
import { cn } from "@/lib/utils";

const CALL_LOG = [
  { name: "Aarav Mehta", time: "11:30 AM", duration: "4:23", status: "completed" as const, outcome: "Connected" },
  { name: "Sofia Rossi", time: "11:15 AM", duration: "0:00", status: "no_answer" as const, outcome: "No Answer" },
  { name: "Liam O'Connor", time: "10:45 AM", duration: "6:12", status: "completed" as const, outcome: "Callback" },
  { name: "Priya Nair", time: "10:20 AM", duration: "2:48", status: "completed" as const, outcome: "Interested" },
  { name: "Noah Williams", time: "9:55 AM", duration: "0:00", status: "busy" as const, outcome: "Busy" },
];

const statusColors = {
  completed: "text-green-400",
  no_answer: "text-amber-400",
  busy: "text-red-400",
};

export function TelephonyMockup({ className }: { className?: string }) {
  return (
    <MockupFrame url="app.crm.tundla.com/contacts/aarav-mehta" className={className}>
      <div className="flex h-[420px] text-left">
        {/* Active call / contact card */}
        <div className="flex flex-1 flex-col border-r border-white/5">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
            <PhoneCall className="size-4 text-green-400" />
            <span className="text-sm font-medium text-foreground">Active Call</span>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center p-6">
            <span className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-indigo-500/30 text-2xl font-semibold text-white">
              AM
            </span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Aarav Mehta</h3>
            <p className="text-sm text-muted-foreground">Northwind Retail</p>
            <p className="mt-1 text-xs text-muted-foreground">+91 98765 43210</p>

            <div className="mt-4 flex items-center gap-2 rounded-full bg-green-500/10 px-4 py-2">
              <span className="size-2 animate-pulse rounded-full bg-green-500" />
              <span className="font-mono text-lg font-medium text-green-400">04:23</span>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10">
                <Mic className="size-5" />
              </button>
              <button className="flex size-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 transition-colors hover:bg-red-600">
                <PhoneOff className="size-6" />
              </button>
              <button className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10">
                <Volume2 className="size-5" />
              </button>
            </div>

            <div className="mt-6 w-full max-w-xs">
              <p className="text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Deal Context</p>
              <div className="mt-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Deal</span>
                  <span className="text-foreground">Pro Plan — Northwind</span>
                </div>
                <div className="mt-1 flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Value</span>
                  <span className="text-foreground">₹1.2L</span>
                </div>
                <div className="mt-1 flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Stage</span>
                  <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-400">New Lead</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Call log */}
        <div className="hidden w-60 flex-col lg:flex">
          <div className="flex items-center gap-2 border-b border-white/5 px-3 py-3">
            <Clock className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Today&apos;s Calls</span>
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-muted-foreground">5</span>
          </div>
          <div className="flex-1 overflow-hidden">
            {CALL_LOG.map((call, i) => (
              <div key={i} className="flex items-center gap-2.5 border-b border-white/5 px-3 py-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-indigo-500/30 text-[9px] font-semibold text-white">
                  {call.name.split(" ").map((n) => n[0]).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-foreground">{call.name}</p>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                    <span>{call.time}</span>
                    {call.duration !== "0:00" && <span>{call.duration}</span>}
                  </div>
                </div>
                <span className={cn("text-[9px] font-medium", statusColors[call.status])}>
                  {call.outcome}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 p-3">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Total calls</span>
              <span className="text-foreground">5</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Connected</span>
              <span className="text-green-400">3 (60%)</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Avg. duration</span>
              <span className="text-foreground">4:28</span>
            </div>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}
