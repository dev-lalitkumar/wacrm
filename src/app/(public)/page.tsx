import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Plug,
  MessagesSquare,
  TrendingUp,
  ShieldCheck,
  Zap,
  Star,
} from "lucide-react";
import { AppMockup } from "@/components/public/app-mockup";
import { buttonVariants } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { FEATURES, STATS, TESTIMONIALS, FAQS } from "@/components/public/content";

export const metadata: Metadata = {
  // `absolute` bypasses the root "%s — Tundla CRM" template so the homepage
  // title isn't doubled up with the brand suffix.
  title: { absolute: "Tundla CRM — The WhatsApp-first CRM for modern sales teams" },
  description:
    "Capture leads from Meta ads, talk to customers on WhatsApp, and close deals from a single fast workspace. Pipelines, broadcasts, automations, and proposals — all in Tundla CRM.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Tundla CRM — The WhatsApp-first CRM for modern sales teams",
    description:
      "Capture leads, talk on WhatsApp, and close deals from one fast workspace.",
    url: "/",
    siteName: "Tundla CRM",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tundla CRM — The WhatsApp-first CRM",
    description:
      "Capture leads, talk on WhatsApp, and close deals from one fast workspace.",
  },
};

const STEPS = [
  {
    icon: Plug,
    title: "Connect your channels",
    text: "Link your WhatsApp Business number and Facebook Pages in minutes. Leads and chats start flowing in automatically.",
  },
  {
    icon: MessagesSquare,
    title: "Talk and qualify",
    text: "Reply from a shared inbox, drop deals into pipelines, and let automations handle the follow-ups for you.",
  },
  {
    icon: TrendingUp,
    title: "Close and grow",
    text: "Send proposals, track every stage, and watch revenue climb with reports that actually tell you what's working.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Tundla CRM",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "The WhatsApp-first CRM for modern sales teams — shared inbox, sales pipelines, broadcasts, Meta lead capture, automations, and proposals.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      <Sparkles className="size-3.5" />
      {children}
    </span>
  );
}

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
          <Eyebrow>WhatsApp + Meta, built in</Eyebrow>
        </div>
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          The WhatsApp-first CRM for
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
            {" "}modern sales teams
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Capture leads from Facebook & Instagram ads, talk to customers on
          WhatsApp, and close deals — all from one fast, beautiful workspace.
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
          No credit card required · Set up in a day
        </p>

        <div className="relative mt-16">
          <div className="absolute -inset-x-10 -top-10 bottom-0 -z-10 bg-primary/20 blur-3xl" />
          <AppMockup />
        </div>
      </section>

      {/* ── Social proof ──────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Trusted by fast-growing teams worldwide
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-12 gap-y-5 opacity-60">
          {["Northwind", "Lumio Studio", "Saffron & Co.", "Vertex Labs", "Bluepeak", "Kanso"].map(
            (name) => (
              <span key={name} className="text-lg font-semibold tracking-tight text-foreground">
                {name}
              </span>
            ),
          )}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Everything in one place</Eyebrow>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            One workspace for the whole customer journey
          </h2>
          <p className="mt-4 text-muted-foreground">
            From the first ad click to the closed deal — Tundla keeps every
            conversation, contact, and pipeline in sync.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition-all hover:-translate-y-1 hover:border-primary/40 hover:bg-white/[0.05]"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.blurb}</p>
            </div>
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
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative">
              <div className="flex items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-500 text-primary-foreground shadow-lg shadow-primary/30">
                  <step.icon className="size-5" />
                </span>
                <span className="text-5xl font-bold text-white/5">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WhatsApp / Meta spotlight ─────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/10 via-white/[0.02] to-transparent p-8 sm:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Eyebrow>Native Meta integration</Eyebrow>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Turn ad clicks into WhatsApp conversations
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Connect Facebook Lead Ads and your WhatsApp Business number once.
                New leads land in your pipeline instantly and get an automated
                welcome message before they cool off.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Instant Facebook & Instagram lead sync",
                  "Automated WhatsApp welcome flows",
                  "WhatsApp Business coexistence support",
                  "Every lead tied to a deal and owner",
                ].map((point) => (
                  <li key={point} className="flex items-center gap-3 text-sm text-foreground">
                    <span className="flex size-5 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                      <Zap className="size-3" />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <AppMockup className="lg:scale-105" />
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-10 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold text-foreground sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
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
        <div className="mt-14 grid gap-6 md:grid-cols-3">
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
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-indigo-500/30 text-xs font-semibold text-white">
                  {t.initials}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
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
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 via-indigo-500/10 to-transparent px-8 py-16 text-center sm:px-16">
          <div className="absolute -top-20 left-1/2 -z-10 size-72 -translate-x-1/2 rounded-full bg-primary/30 blur-3xl" />
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ready to turn conversations into customers?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            See Tundla CRM in action. Book a personalized demo and we&apos;ll
            show you how to get your team live in a day.
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
