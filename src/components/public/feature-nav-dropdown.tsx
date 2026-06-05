"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { FEATURE_NAV_ITEMS } from "./content";
import { cn } from "@/lib/utils";

export function FeatureNavDropdown() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        Features
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute -left-4 top-full z-50 pt-3">
          <div className="w-[540px] rounded-xl border border-white/10 bg-[#0c0c12]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-1">
              {FEATURE_NAV_ITEMS.map((item) => (
                <Link
                  key={item.slug}
                  href={`/features/${item.slug}`}
                  onClick={() => setOpen(false)}
                  className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-white/5"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-primary/25">
                    <item.icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-3 border-t border-white/5 pt-3">
              <Link
                href="/features"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              >
                See all features
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
