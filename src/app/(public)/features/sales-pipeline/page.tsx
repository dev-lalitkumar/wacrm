import type { Metadata } from "next";
import { FeaturePageLayout } from "@/components/public/feature-page-layout";
import { FEATURE_PAGES } from "@/components/public/content";
import { PipelineMockup } from "@/components/public/mockups/pipeline-mockup";

const data = FEATURE_PAGES.find((p) => p.slug === "sales-pipeline")!;

export const metadata: Metadata = {
  title: data.pageTitle,
  description: data.metaDescription,
  alternates: { canonical: "/features/sales-pipeline" },
  openGraph: {
    title: `${data.pageTitle} — Tundla CRM`,
    description: data.metaDescription,
    url: "/features/sales-pipeline",
    siteName: "Tundla CRM",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${data.pageTitle} — Tundla CRM`,
    description: data.metaDescription,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Tundla CRM — Visual Sales Pipeline",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: data.metaDescription,
  featureList: [
    "Drag-and-drop Kanban board",
    "Custom pipeline stages",
    "Deal value and close date tracking",
    "Followup reminders with auto-seeding",
    "Win/loss reason tracking",
    "Closed deals archive",
  ],
};

export default function SalesPipelineFeaturePage() {
  return (
    <FeaturePageLayout
      eyebrow="Sales Pipeline"
      title={data.pageTitle}
      subtitle={data.pageSubtitle}
      heroMockup={<PipelineMockup />}
      sections={data.sections}
      sectionMockups={[
        <PipelineMockup key="kanban" />,
        <PipelineMockup key="followups" />,
        <PipelineMockup key="tracking" />,
        <PipelineMockup key="closed" />,
      ]}
      secondaryFeatures={data.secondaryFeatures}
      relatedPages={data.relatedPages}
      ctaTitle="Ready to visualize your sales?"
      ctaSubtitle="Book a demo and see how a Kanban pipeline with smart reminders keeps your team closing deals."
      jsonLd={jsonLd}
    />
  );
}
