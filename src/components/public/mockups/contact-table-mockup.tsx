import {
  Search,
  Filter,
  MoreHorizontal,
  Phone,
  Mail,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import { MockupFrame } from "./mockup-frame";
import { MockupNavRail } from "./mockup-nav-rail";
import { cn } from "@/lib/utils";

type Contact = {
  name: string;
  initials: string;
  email: string;
  phone: string;
  company: string;
  status: "New" | "Contacted" | "Qualified" | "Unqualified" | "Junk";
  tags: string[];
  source: string;
};

const statusColors: Record<string, string> = {
  New: "bg-blue-500/20 text-blue-400",
  Contacted: "bg-amber-500/20 text-amber-400",
  Qualified: "bg-green-500/20 text-green-400",
  Unqualified: "bg-red-500/20 text-red-400",
  Junk: "bg-zinc-500/20 text-zinc-400",
};

const CONTACTS: Contact[] = [
  { name: "Aarav Mehta", initials: "AM", email: "aarav@northwind.com", phone: "+91 98765 43210", company: "Northwind Retail", status: "Qualified", tags: ["Enterprise", "Hot"], source: "Meta Ads" },
  { name: "Sofia Rossi", initials: "SR", email: "sofia@lumio.studio", phone: "+39 345 678 9012", company: "Lumio Studio", status: "New", tags: ["Startup"], source: "Website Form" },
  { name: "Liam O'Connor", initials: "LO", email: "liam@vertex.io", phone: "+1 555 234 5678", company: "Vertex Labs", status: "Contacted", tags: ["SaaS"], source: "WhatsApp" },
  { name: "Priya Nair", initials: "PN", email: "priya@saffron.co", phone: "+91 87654 32100", company: "Saffron & Co.", status: "Qualified", tags: ["D2C", "Warm"], source: "Webhook" },
  { name: "Noah Williams", initials: "NW", email: "noah@bluepeak.com", phone: "+1 555 876 5432", company: "Bluepeak", status: "New", tags: ["Agency"], source: "Meta Ads" },
  { name: "Meera Joshi", initials: "MJ", email: "meera@kanso.in", phone: "+91 76543 21098", company: "Kanso Digital", status: "Contacted", tags: ["SMB"], source: "Direct" },
];

export function ContactTableMockup({ className }: { className?: string }) {
  return (
    <MockupFrame url="app.crm.tundla.com/contacts" className={className}>
      <div className="flex h-[440px] text-left">
        <MockupNavRail activeIndex={3} />

        <div className="flex flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-muted-foreground">
                <Search className="size-3.5" />
                Search contacts…
              </div>
              <button className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-muted-foreground">
                <Filter className="size-3" />
                Filters
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">6 contacts</span>
              <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">+ Add</button>
            </div>
          </div>

          {/* Bulk action bar */}
          <div className="flex items-center gap-3 border-b border-primary/30 bg-primary/5 px-4 py-2">
            <input type="checkbox" checked readOnly className="size-3.5 rounded border-white/20 accent-primary" />
            <span className="text-xs text-primary">2 selected</span>
            <div className="flex items-center gap-2">
              <button className="rounded bg-white/5 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">Assign</button>
              <button className="rounded bg-white/5 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">Tag</button>
              <button className="rounded bg-white/5 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">Status</button>
              <button className="rounded bg-white/5 px-2 py-1 text-[10px] text-red-400/70 hover:text-red-400">Delete</button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="w-8 px-4 py-2"><input type="checkbox" className="size-3 rounded accent-primary" /></th>
                  <th className="px-2 py-2">Contact</th>
                  <th className="hidden px-2 py-2 lg:table-cell">Status</th>
                  <th className="hidden px-2 py-2 md:table-cell">Tags</th>
                  <th className="hidden px-2 py-2 lg:table-cell">Source</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {CONTACTS.map((c, i) => (
                  <tr key={c.name} className={cn("border-b border-white/5 transition-colors hover:bg-white/[0.02]", (i === 0 || i === 3) && "bg-primary/[0.03]")}>
                    <td className="px-4 py-2.5">
                      <input type="checkbox" checked={i === 0 || i === 3} readOnly className="size-3 rounded accent-primary" />
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-indigo-500/30 text-[10px] font-semibold text-white">{c.initials}</span>
                        <div>
                          <p className="text-[12px] font-medium text-foreground">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">{c.company}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-2 py-2.5 lg:table-cell">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", statusColors[c.status])}>{c.status}</span>
                    </td>
                    <td className="hidden px-2 py-2.5 md:table-cell">
                      <div className="flex gap-1">
                        {c.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-muted-foreground">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="hidden px-2 py-2.5 lg:table-cell">
                      <span className="text-[11px] text-muted-foreground">{c.source}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      <MoreHorizontal className="size-4 text-muted-foreground/50" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}
