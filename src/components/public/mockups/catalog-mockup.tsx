import {
  ShoppingBag,
  Search,
  Plus,
  Package,
} from "lucide-react";
import { MockupFrame } from "./mockup-frame";
import { cn } from "@/lib/utils";

const PRODUCTS = [
  { name: "Pro Plan — Monthly", category: "Subscription", price: "₹999", unit: "/seat/mo", color: "from-violet-500/30 to-indigo-500/20", active: true },
  { name: "Pro Plan — Annual", category: "Subscription", price: "₹9,499", unit: "/seat/yr", color: "from-blue-500/30 to-cyan-500/20", active: true },
  { name: "Enterprise Plan", category: "Subscription", price: "₹2,499", unit: "/seat/mo", color: "from-amber-500/30 to-orange-500/20", active: true },
  { name: "Onboarding Package", category: "Service", price: "₹15,000", unit: "one-time", color: "from-green-500/30 to-emerald-500/20", active: true },
  { name: "WhatsApp API Setup", category: "Service", price: "₹5,000", unit: "one-time", color: "from-teal-500/30 to-cyan-500/20", active: true },
  { name: "Custom Integration", category: "Service", price: "₹25,000", unit: "one-time", color: "from-pink-500/30 to-rose-500/20", active: false },
];

export function CatalogMockup({ className }: { className?: string }) {
  return (
    <MockupFrame url="app.crm.tundla.com/catalog" className={className}>
      <div className="flex h-[420px] flex-col text-left">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Product Catalog</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-muted-foreground">6 items</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-muted-foreground">
              <Search className="size-3" />
              Search…
            </div>
            <button className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground">
              <Plus className="size-3" />
              Add Product
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PRODUCTS.map((product) => (
              <div
                key={product.name}
                className={cn(
                  "group rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-all hover:-translate-y-0.5 hover:border-primary/30",
                  !product.active && "opacity-50",
                )}
              >
                <div className={cn("flex size-12 items-center justify-center rounded-lg bg-gradient-to-br", product.color)}>
                  <Package className="size-6 text-white/80" />
                </div>
                <h3 className="mt-3 text-[12px] font-medium text-foreground">{product.name}</h3>
                <span className="mt-0.5 inline-block rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-muted-foreground">{product.category}</span>
                <div className="mt-2 flex items-baseline gap-0.5">
                  <span className="text-lg font-bold text-foreground">{product.price}</span>
                  <span className="text-[10px] text-muted-foreground">{product.unit}</span>
                </div>
                {!product.active && (
                  <span className="mt-1.5 inline-block rounded-full bg-zinc-500/20 px-2 py-0.5 text-[9px] text-zinc-400">Inactive</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}
