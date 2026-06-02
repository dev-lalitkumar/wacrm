import type { Metadata } from "next";
import { Mail, MessageSquare, Clock, ArrowRight } from "lucide-react";
import { ContactForm } from "@/components/public/contact-form";
import { SUPPORT_EMAIL } from "@/components/public/content";

export const metadata: Metadata = {
  title: "Contact & Demo",
  description:
    "Get in touch with the Tundla CRM team. Book a personalized demo or email us at support.crm@tundla.com — we'll help you get your team live.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact Tundla CRM",
    description: "Book a demo or reach our team — we're happy to help.",
    url: "/contact",
    siteName: "Tundla CRM",
    type: "website",
  },
};

const HIGHLIGHTS = [
  {
    icon: Mail,
    title: "Email us",
    text: SUPPORT_EMAIL,
    href: `mailto:${SUPPORT_EMAIL}`,
  },
  {
    icon: MessageSquare,
    title: "Book a demo",
    text: "See Tundla in action, tailored to your team.",
  },
  {
    icon: Clock,
    title: "Fast response",
    text: "We typically reply within one business day.",
  },
];

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-20 pb-24 sm:pt-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          We&apos;d love to hear from you
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Let&apos;s get your team selling on WhatsApp
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          Tell us a little about your team and we&apos;ll show you exactly how
          Tundla CRM can help — or just say hello.
        </p>
      </div>

      <div className="mt-14 grid gap-10 lg:grid-cols-5">
        {/* Info column */}
        <div className="space-y-4 lg:col-span-2">
          {HIGHLIGHTS.map((h) => {
            const inner = (
              <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-primary/30">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                  <h.icon className="size-5" />
                </span>
                <div>
                  <h3 className="flex items-center gap-1.5 font-semibold text-foreground">
                    {h.title}
                    {h.href && <ArrowRight className="size-3.5 text-muted-foreground" />}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{h.text}</p>
                </div>
              </div>
            );
            return h.href ? (
              <a key={h.title} href={h.href} className="block">
                {inner}
              </a>
            ) : (
              <div key={h.title}>{inner}</div>
            );
          })}
        </div>

        {/* Form column */}
        <div className="lg:col-span-3">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
