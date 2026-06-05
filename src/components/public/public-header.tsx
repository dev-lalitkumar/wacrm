"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, ChevronDown } from "lucide-react";
import { Logo } from "./logo";
import { FeatureNavDropdown } from "./feature-nav-dropdown";
import { FEATURE_NAV_ITEMS } from "./content";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const [featuresExpanded, setFeaturesExpanded] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#07070b]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo href="/" size={34} />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          <FeatureNavDropdown />
          <Link
            href="/contact"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Contact
          </Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost" }), "h-9 px-4")}
          >
            Sign in
          </Link>
          <Link
            href="/contact"
            className={cn(
              buttonVariants({ variant: "default" }),
              "h-9 px-4 shadow-lg shadow-primary/20",
            )}
          >
            Book a demo
          </Link>
        </div>

        {/* Mobile menu */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-9",
              )}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-72 border-white/10 bg-[#0a0a0f] text-foreground"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex flex-col gap-1 px-2 pt-8">
                <Logo size={32} className="mb-6 px-2" />

                {/* Features accordion */}
                <button
                  onClick={() => setFeaturesExpanded((v) => !v)}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-base font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  Features
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      featuresExpanded && "rotate-180",
                    )}
                  />
                </button>
                {featuresExpanded && (
                  <div className="ml-3 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                    {FEATURE_NAV_ITEMS.map((item) => (
                      <Link
                        key={item.slug}
                        href={`/features/${item.slug}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                      >
                        <item.icon className="size-4" />
                        {item.title}
                      </Link>
                    ))}
                    <Link
                      href="/features"
                      onClick={() => setOpen(false)}
                      className="mt-1 rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      See all features
                    </Link>
                  </div>
                )}

                <Link
                  href="/contact"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-base font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  Contact
                </Link>

                <div className="mt-6 flex flex-col gap-3 px-1">
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "h-10",
                    )}
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/contact"
                    onClick={() => setOpen(false)}
                    className={cn(
                      buttonVariants({ variant: "default" }),
                      "h-10",
                    )}
                  >
                    Book a demo
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
