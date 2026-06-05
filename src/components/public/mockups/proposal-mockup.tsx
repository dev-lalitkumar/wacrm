import {
  FileText,
  CheckCircle2,
  XCircle,
  Eye,
  Send,
  Download,
} from "lucide-react";
import { MockupFrame } from "./mockup-frame";
import { cn } from "@/lib/utils";

const LINE_ITEMS = [
  { name: "Pro Plan — Annual", qty: 12, unit: "seats", price: 999, discount: 10 },
  { name: "Onboarding Package", qty: 1, unit: "unit", price: 15000, discount: 0 },
  { name: "WhatsApp API Setup", qty: 1, unit: "unit", price: 5000, discount: 0 },
];

export function ProposalMockup({ className }: { className?: string }) {
  const subtotal = LINE_ITEMS.reduce((sum, item) => {
    const lineTotal = item.qty * item.price;
    return sum + lineTotal - lineTotal * (item.discount / 100);
  }, 0);
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;

  return (
    <MockupFrame url="app.crm.tundla.com/proposals/new" className={className}>
      <div className="flex h-[460px] text-left">
        {/* Builder side */}
        <div className="flex flex-1 flex-col border-r border-white/5">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Proposal Builder</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">Draft</span>
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-4">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Title</label>
                <p className="mt-1 text-sm text-foreground">Pro Plan — Northwind Retail</p>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Contact</label>
                  <p className="mt-1 text-sm text-foreground">Aarav Mehta</p>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Valid Until</label>
                  <p className="mt-1 text-sm text-foreground">Jun 30, 2026</p>
                </div>
              </div>

              {/* Line items table */}
              <div className="mt-2 rounded-lg border border-white/5">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="hidden px-2 py-2 text-right sm:table-cell">Price</th>
                      <th className="hidden px-2 py-2 text-right sm:table-cell">Disc.</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LINE_ITEMS.map((item) => {
                      const lineTotal = item.qty * item.price;
                      const afterDiscount = lineTotal - lineTotal * (item.discount / 100);
                      return (
                        <tr key={item.name} className="border-b border-white/5">
                          <td className="px-3 py-2 text-[11px] text-foreground">{item.name}</td>
                          <td className="px-2 py-2 text-right text-[11px] text-muted-foreground">{item.qty}</td>
                          <td className="hidden px-2 py-2 text-right text-[11px] text-muted-foreground sm:table-cell">{"₹"}{item.price.toLocaleString()}</td>
                          <td className="hidden px-2 py-2 text-right text-[11px] text-muted-foreground sm:table-cell">{item.discount}%</td>
                          <td className="px-3 py-2 text-right text-[11px] font-medium text-foreground">{"₹"}{afterDiscount.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="space-y-1 border-t border-white/5 px-3 py-2 text-right">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{"₹"}{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>GST (18%)</span>
                    <span>{"₹"}{tax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-1 text-sm font-semibold text-foreground">
                    <span>Total</span>
                    <span>{"₹"}{total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-white/5 px-4 py-3">
            <button className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
              <Send className="size-3" />
              Send via WhatsApp
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-muted-foreground">
              <Download className="size-3" />
              PDF
            </button>
          </div>
        </div>

        {/* Client preview side */}
        <div className="hidden w-64 flex-col bg-white/[0.01] lg:flex">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
            <Eye className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Client Preview</span>
          </div>
          <div className="flex-1 p-4">
            <div className="rounded-xl border border-white/10 bg-[#0a0a10] p-4">
              <div className="text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/20">
                  <FileText className="size-5 text-primary" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">Pro Plan — Northwind Retail</h3>
                <p className="mt-1 text-[10px] text-muted-foreground">from Tundla CRM</p>
                <p className="mt-3 text-2xl font-bold text-foreground">{"₹"}{total.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Valid until Jun 30, 2026</p>
              </div>
              <div className="mt-4 space-y-1.5">
                {LINE_ITEMS.map((item) => (
                  <div key={item.name} className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="text-foreground">x{item.qty}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-500 py-2 text-xs font-medium text-white">
                  <CheckCircle2 className="size-3" />
                  Accept
                </button>
                <button className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/10 py-2 text-xs text-muted-foreground">
                  <XCircle className="size-3" />
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}
