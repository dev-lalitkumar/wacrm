import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { FeatureCTA } from "./feature-cta";
import { FEATURE_NAV_ITEMS } from "./content";
import type { FeatureSection } from "./content/feature-pages";
import type { LucideIcon } from "lucide-react";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      <Sparkles className="size-3.5" />
      {children}
    </span>
  );
}

export function FeaturePageLayout({
  eyebrow,
  title,
  subtitle,
  heroMockup,
  sections,
  sectionMockups,
  secondaryFeatures,
  relatedPages,
  ctaTitle,
  ctaSubtitle,
  jsonLd,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  heroMockup: React.ReactNode;
  sections: FeatureSection[];
  sectionMockups: React.ReactNode[];
  secondaryFeatures?: { icon: LucideIcon; title: string; blurb: string }[];
  relatedPages?: string[];
  ctaTitle?: string;
  ctaSubtitle?: string;
  jsonLd?: Record<string, unknown>;
}) {
  const related = relatedPages
    ?.map((slug) => FEATURE_NAV_ITEMS.find((f) => f.slug === slug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-12 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <div className="relative mt-14">
          <div className="absolute -inset-x-10 -top-10 bottom-0 -z-10 bg-primary/15 blur-3xl" />
          {heroMockup}
        </div>
      </section>

      {/* Alternating detail sections */}
      <div className="mx-auto max-w-6xl space-y-24 px-6 py-12">
        {sections.map((section, i) => {
          const reversed = i % 2 === 1;
          return (
            <section
              key={section.title}
              className="grid items-center gap-10 lg:grid-cols-2"
            >
              <div className={cn(reversed && "lg:order-2")}>
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
                  <section.icon className="size-6" />
                </span>
                <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {section.title}
                </h2>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  {section.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {section.points.map((point) => (
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
              </div>
              <div className={cn(reversed && "lg:order-1")}>
                <div className="relative">
                  <div className="absolute -inset-6 -z-10 rounded-3xl bg-primary/10 blur-2xl" />
                  {sectionMockups[i]}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Secondary features */}
      {secondaryFeatures && secondaryFeatures.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-5 sm:grid-cols-3">
            {secondaryFeatures.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.blurb}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related features */}
      {related && related.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="text-center text-xl font-semibold text-foreground">
            Works great with
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {related.map((r) => {
              const Icon = r.icon;
              return (
                <Link
                  key={r.slug}
                  href={`/features/${r.slug}`}
                  className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white/[0.05]"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {r.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.description}
                    </p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <FeatureCTA title={ctaTitle} subtitle={ctaSubtitle} />
    </>
  );
}
