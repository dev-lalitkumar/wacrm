import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FEATURE_PAGES } from "@/components/public/content";
import { FeatureCTA } from "@/components/public/feature-cta";
import { RoleSystemMockup } from "@/components/public/mockups/role-system-mockup";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Explore every feature in Tundla CRM: WhatsApp inbox, Gmail integration, sales pipelines, proposals, automations, chatbot flows, reports, webhooks, embeddable forms, and multi-channel notifications.",
  alternates: { canonical: "/features" },
  openGraph: {
    title: "Tundla CRM Features — Everything Your Sales Team Needs",
    description:
      "WhatsApp inbox, Gmail, pipelines, proposals, automations, reports, webhooks, forms, and more — all in one CRM.",
    url: "/features",
    siteName: "Tundla CRM",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tundla CRM Features",
    description:
      "WhatsApp, Gmail, pipelines, proposals, automations, reports, and more — all in one CRM.",
  },
};

export default function FeaturesOverviewPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-12 text-center sm:pt-24">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="size-3.5" />
          All Features
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Everything your team needs to{" "}
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
            sell smarter
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          From first contact to closed deal — Tundla CRM gives you a unified
          workspace for conversations, pipelines, proposals, automations,
          reports, and integrations across every channel.
        </p>
      </section>

      {/* Feature page grid */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_PAGES.map((feature) => (
            <Link
              key={feature.slug}
              href={`/features/${feature.slug}`}
              className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition-all hover:-translate-y-1 hover:border-primary/40 hover:bg-white/[0.05]"
            >
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-primary/25">
                <feature.icon className="size-6" />
              </span>
              <h2 className="mt-5 text-lg font-semibold text-foreground">
                {feature.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {feature.shortDescription}
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary">
                Learn more
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Security & roles section */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" />
            Security & Team
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Enterprise-grade access control
          </h2>
          <p className="mt-4 text-muted-foreground">
            Three roles with row-level security ensure every team member sees
            exactly what they need — nothing more, nothing less.
          </p>
        </div>
        <div className="mt-10">
          <RoleSystemMockup />
        </div>
      </section>

      {/* Quick stats */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            { value: "20+", label: "Built-in features" },
            { value: "8", label: "Report types" },
            { value: "16", label: "Notification events" },
            { value: "3", label: "Role levels" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-foreground sm:text-4xl">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <FeatureCTA
        title="See everything in action"
        subtitle="Book a personalized demo and we'll walk you through every feature with your real data."
      />
    </>
  );
}
