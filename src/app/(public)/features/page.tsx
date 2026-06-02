import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { AppMockup } from "@/components/public/app-mockup";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FEATURES, SECONDARY_FEATURES } from "@/components/public/content";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Explore Tundla CRM: a shared WhatsApp inbox, visual sales pipelines, broadcasts, Meta lead capture, automations, proposals, catalog, reports, and multi-channel notifications.",
  alternates: { canonical: "/features" },
  openGraph: {
    title: "Tundla CRM Features",
    description:
      "Shared WhatsApp inbox, pipelines, broadcasts, Meta lead capture, automations, and more.",
    url: "/features",
    siteName: "Tundla CRM",
    type: "website",
  },
};

export default function FeaturesPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-12 text-center sm:pt-24">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Features
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Everything your team needs to sell on WhatsApp
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Tundla CRM unifies conversations, contacts, deals, and campaigns — so
          nothing slips through the cracks between the first message and the
          closed deal.
        </p>
      </section>

      {/* Alternating detail sections */}
      <div className="mx-auto max-w-6xl space-y-24 px-6 py-12">
        {FEATURES.map((f, i) => {
          const reversed = i % 2 === 1;
          return (
            <section
              key={f.title}
              className="grid items-center gap-10 lg:grid-cols-2"
            >
              <div className={cn(reversed && "lg:order-2")}>
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
                  <f.icon className="size-6" />
                </span>
                <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {f.title}
                </h2>
                <p className="mt-4 leading-relaxed text-muted-foreground">{f.detail}</p>
                <ul className="mt-6 space-y-3">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-center gap-3 text-sm text-foreground">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-primary">
                        <Check className="size-3" />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={cn(reversed && "lg:order-1")}>
                <div className="relative">
                  <div className="absolute -inset-6 -z-10 rounded-3xl bg-primary/10 blur-2xl" />
                  <AppMockup />
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Secondary features grid */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-5 sm:grid-cols-3">
          {SECONDARY_FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 via-indigo-500/10 to-transparent px-8 py-16 text-center sm:px-16">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            See it on your own data
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Book a guided demo and we&apos;ll tailor Tundla CRM to the way your
            team sells.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/contact"
              className={cn(
                buttonVariants({ variant: "default" }),
                "h-12 gap-2 px-7 text-base shadow-xl shadow-primary/25",
              )}
            >
              Book a demo
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "outline" }), "h-12 px-7 text-base")}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
