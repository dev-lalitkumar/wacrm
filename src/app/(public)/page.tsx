import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Star,
  Shield,
  Lock,
  FileSearch,
  Globe2,
  MessageSquare,
  Mail,
  Webhook,
  FormInput,
  Check,
} from "lucide-react";
import { HeroDashboardMockup } from "@/components/public/mockups/hero-dashboard-mockup";
import { InboxMockup } from "@/components/public/mockups/inbox-mockup";
import { PipelineMockup } from "@/components/public/mockups/pipeline-mockup";
import { AutomationMockup } from "@/components/public/mockups/automation-mockup";
import { ReportsMockup } from "@/components/public/mockups/reports-mockup";
import { RoleSystemMockup } from "@/components/public/mockups/role-system-mockup";
import { buttonVariants } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import {
  FEATURE_PAGES,
  STATS,
  TESTIMONIALS,
  FAQS,
  HOME_HERO,
  HOME_STEPS,
  HOME_SHOWCASE_TABS,
} from "@/components/public/content";
import { FeatureCTA } from "@/components/public/feature-cta";

export const metadata: Metadata = {
  title: {
    absolute:
      "Tundla CRM — The All-in-One CRM for Modern Sales Teams",
  },
  description:
    "Capture leads from any source, engage on WhatsApp and email, manage pipelines, automate follow-ups, send proposals, and close deals — all from one fast workspace. Tundla CRM.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Tundla CRM — The All-in-One CRM for Modern Sales Teams",
    description:
      "Capture leads, engage on WhatsApp & email, and close deals from one fast workspace.",
    url: "/",
    siteName: "Tundla CRM",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tundla CRM — All-in-One CRM",
    description:
      "Capture leads, engage on WhatsApp & email, and close deals from one fast workspace.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Tundla CRM",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "The all-in-one CRM for modern sales teams — WhatsApp inbox, Gmail integration, sales pipelines, proposals, automations, chatbot flows, reports, webhooks, embeddable forms, and multi-channel notifications.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Shared WhatsApp Business inbox",
    "Gmail integration with email tracking",
    "Visual sales pipelines with drag-and-drop",
    "Proposal builder with client portal",
    "Trigger-based automations",
    "Visual WhatsApp chatbot builder",
    "8 built-in report types",
    "Custom webhooks for any lead source",
    "Embeddable lead capture forms",
    "Multi-channel notifications (in-app, email, WhatsApp)",
    "3-role access control with row-level security",
    "Product catalog management",
    "Click-to-call telephony",
    "WhatsApp broadcast campaigns",
    "Followup reminders with auto-seeding",
    "Contact tags and segmentation",
    "Custom fields for contacts and deals",
    "Full audit logging",
  ],
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      <Sparkles className="size-3.5" />
      {children}
    </span>
  );
}

/* Showcase tab mockups mapped by key */
const SHOWCASE_MOCKUPS: Record<string, React.ReactNode> = {
  inbox: <InboxMockup />,
  pipeline: <PipelineMockup />,
  automations: <AutomationMockup />,
  reports: <ReportsMockup />,
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center sm:pt-28">
        <div className="flex justify-center">
          <Eyebrow>{HOME_HERO.eyebrow}</Eyebrow>
        </div>
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          {HOME_HERO.title}
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
            {HOME_HERO.titleGradient}
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {HOME_HERO.subtitle}
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-12 px-7 text-base",
            )}
          >
            Sign in
          </Link>
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 text-green-400" />
          {HOME_HERO.badge}
        </p>

        <div className="relative mt-16">
          <div className="absolute -inset-x-10 -top-10 bottom-0 -z-10 bg-primary/20 blur-3xl" />
          <HeroDashboardMockup />
        </div>
      </section>

      {/* ── Social proof ──────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Trusted by fast-growing teams worldwide
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-12 gap-y-5 opacity-60">
          {[
            "Northwind",
            "Lumio Studio",
            "Saffron & Co.",
            "Vertex Labs",
            "Bluepeak",
            "Kanso",
          ].map((name) => (
            <span
              key={name}
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* ── Feature grid — 8 cards ────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Everything in one place</Eyebrow>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            One workspace for the whole customer journey
          </h2>
          <p className="mt-4 text-muted-foreground">
            From the first lead to the closed deal — Tundla keeps every
            conversation, contact, pipeline, and report in sync across every
            channel.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_PAGES.map((f) => (
            <Link
              key={f.slug}
              href={`/features/${f.slug}`}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition-all hover:-translate-y-1 hover:border-primary/40 hover:bg-white/[0.05]"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-foreground">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.shortDescription}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Learn more
                <ArrowRight className="size-3.5" />
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/features"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Explore all features
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Live in three simple steps
          </h2>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {HOME_STEPS.map((step, i) => (
            <div key={step.title} className="relative">
              <div className="flex items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-500 text-primary-foreground shadow-lg shadow-primary/30">
                  <step.icon className="size-5" />
                </span>
                <span className="text-5xl font-bold text-white/5">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature showcase — tabbed ─────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>See it in action</Eyebrow>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Powerful features, demonstrated
          </h2>
          <p className="mt-4 text-muted-foreground">
            Don&apos;t take our word for it — explore the actual product surfaces your
            team will work with every day.
          </p>
        </div>
        <div className="mt-12 space-y-16">
          {HOME_SHOWCASE_TABS.map((tab, i) => {
            const reversed = i % 2 === 1;
            return (
              <div
                key={tab.key}
                className="grid items-center gap-10 lg:grid-cols-2"
              >
                <div className={cn(reversed && "lg:order-2")}>
                  <h3 className="text-2xl font-bold tracking-tight text-foreground">
                    {tab.title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    {tab.description}
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {tab.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-3 text-sm text-foreground"
                      >
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                          <Check className="size-3" />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/features/${tab.key === "inbox" ? "whatsapp" : tab.key === "pipeline" ? "sales-pipeline" : tab.key}`}
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    Learn more
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
                <div className={cn(reversed && "lg:order-1")}>
                  <div className="relative">
                    <div className="absolute -inset-6 -z-10 rounded-3xl bg-primary/10 blur-2xl" />
                    {SHOWCASE_MOCKUPS[tab.key]}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-10 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold text-foreground sm:text-4xl">
                {s.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trust & Security ──────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/10 via-white/[0.02] to-transparent p-8 sm:p-12">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>Enterprise-ready</Eyebrow>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Security your team can trust
            </h2>
            <p className="mt-4 text-muted-foreground">
              Tundla is built with enterprise-grade security from day one.
              Role-based access, encrypted credentials, and a full audit trail
              keep your data safe.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Shield,
                title: "3-role RBAC",
                desc: "Admin, Manager, and Executive roles with row-level security on every record.",
              },
              {
                icon: Lock,
                title: "AES-256 encryption",
                desc: "All integration credentials and API keys encrypted at rest with AES-256-GCM.",
              },
              {
                icon: FileSearch,
                title: "Full audit log",
                desc: "Every action tracked — who changed what, when, and from where.",
              },
              {
                icon: Globe2,
                title: "GDPR-aligned",
                desc: "Data deletion portal, privacy policy, and user consent flows built in.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-white/5 bg-[#0a0a10]/50 p-5"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <item.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integrations row ──────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Works with the tools you already use
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-8">
          {[
            { icon: MessageSquare, label: "WhatsApp", color: "text-green-400" },
            { icon: Mail, label: "Gmail", color: "text-blue-400" },
            { icon: Globe2, label: "Facebook", color: "text-blue-500" },
            { icon: Webhook, label: "Webhooks", color: "text-purple-400" },
            { icon: FormInput, label: "Web Forms", color: "text-amber-400" },
            { icon: Globe2, label: "Any API", color: "text-cyan-400" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <span
                className={cn(
                  "flex size-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]",
                  item.color,
                )}
              >
                <item.icon className="size-6" />
              </span>
              <span className="text-xs font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Loved by sales teams</Eyebrow>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built for the way you actually sell
          </h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className="flex gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-indigo-500/30 text-xs font-semibold text-white">
                  {t.initials}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <div className="text-center">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Questions, answered
          </h2>
        </div>
        <Accordion className="mt-10">
          {FAQS.map((faq, i) => (
            <AccordionItem
              key={faq.q}
              value={String(i)}
              className="border-white/10"
            >
              <AccordionTrigger className="text-base text-foreground">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>{faq.a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* ── Closing CTA ───────────────────────────────── */}
      <FeatureCTA
        title="Ready to turn conversations into customers?"
        subtitle="See Tundla CRM in action. Book a personalized demo and we'll show you how to get your team live in a day."
      />
    </>
  );
}
