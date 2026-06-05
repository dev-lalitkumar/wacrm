import { GripVertical, Clock, User } from "lucide-react";
import { MockupFrame } from "./mockup-frame";
import { MockupNavRail } from "./mockup-nav-rail";
import { cn } from "@/lib/utils";

type Deal = {
  name: string;
  company: string;
  value: string;
  initials: string;
  daysOld: number;
  owner: string;
};

type Stage = {
  name: string;
  color: string;
  total: string;
  deals: Deal[];
};

const STAGES: Stage[] = [
  {
    name: "New Lead",
    color: "bg-blue-500",
    total: "₹2.4L",
    deals: [
      { name: "Aarav Mehta", company: "Northwind Retail", value: "₹1.2L", initials: "AM", daysOld: 2, owner: "Rahul" },
      { name: "Sofia Rossi", company: "Lumio Studio", value: "₹1.2L", initials: "SR", daysOld: 1, owner: "Priya" },
    ],
  },
  {
    name: "Qualified",
    color: "bg-amber-500",
    total: "₹4.5L",
    deals: [
      { name: "Liam O'Connor", company: "Vertex Labs", value: "₹2.8L", initials: "LO", daysOld: 5, owner: "Rahul" },
      { name: "Priya Nair", company: "Saffron & Co.", value: "₹1.7L", initials: "PN", daysOld: 8, owner: "Ankit" },
    ],
  },
  {
    name: "Proposal Sent",
    color: "bg-purple-500",
    total: "₹3.6L",
    deals: [
      { name: "Noah Williams", company: "Bluepeak", value: "₹3.6L", initials: "NW", daysOld: 3, owner: "Priya" },
    ],
  },
  {
    name: "Negotiation",
    color: "bg-green-500",
    total: "₹5.1L",
    deals: [
      { name: "Meera Joshi", company: "Kanso Digital", value: "₹5.1L", initials: "MJ", daysOld: 12, owner: "Rahul" },
    ],
  },
];

export function PipelineMockup({ className }: { className?: string }) {
  return (
    <MockupFrame url="app.crm.tundla.com/pipelines" className={className}>
      <div className="flex h-[440px] text-left">
        <MockupNavRail activeIndex={1} />

        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">Sales Pipeline</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-muted-foreground">6 deals</span>
            </div>
            <span className="text-sm font-medium text-primary">₹15.6L total</span>
          </div>

          <div className="flex flex-1 gap-3 overflow-x-auto p-3">
            {STAGES.map((stage) => (
              <div key={stage.name} className="flex w-52 shrink-0 flex-col rounded-xl border border-white/5 bg-white/[0.02]">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", stage.color)} />
                    <span className="text-xs font-medium text-foreground">{stage.name}</span>
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">{stage.total}</span>
                </div>
                <div className="flex-1 space-y-2 px-2 pb-2">
                  {stage.deals.map((deal) => (
                    <div key={deal.name} className="group cursor-grab rounded-lg border border-white/5 bg-[#0a0a10] p-2.5 transition-all hover:border-primary/30 hover:bg-white/[0.03]">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-indigo-500/30 text-[10px] font-semibold text-white">
                            {deal.initials}
                          </span>
                          <div>
                            <p className="text-[12px] font-medium text-foreground">{deal.name}</p>
                            <p className="text-[10px] text-muted-foreground">{deal.company}</p>
                          </div>
                        </div>
                        <GripVertical className="size-3.5 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-foreground">{deal.value}</span>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                            <Clock className="size-3" />
                            {deal.daysOld}d
                          </span>
                          <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                            <User className="size-3" />
                            {deal.owner}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}
