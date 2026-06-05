import type { Metadata } from "next";
import { FeaturePageLayout } from "@/components/public/feature-page-layout";
import { FEATURE_PAGES } from "@/components/public/content";
import { AutomationMockup } from "@/components/public/mockups/automation-mockup";
import { FlowMockup } from "@/components/public/mockups/flow-mockup";

const data = FEATURE_PAGES.find((p) => p.slug === "automations")!;

export const metadata: Metadata = {
  title: data.pageTitle,
  description: data.metaDescription,
  alternates: { canonical: "/features/automations" },
  openGraph: {
    title: `${data.pageTitle} — Tundla CRM`,
    description: data.metaDescription,
    url: "/features/automations",
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
  name: "Tundla CRM — Automations & Conversational Flows",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: data.metaDescription,
  featureList: [
    "Trigger-based automation rules",
    "Visual WhatsApp chatbot builder",
    "Condition branching with logic",
    "Execution logs and debugging",
    "Keyword and schedule triggers",
    "Round-robin lead assignment",
  ],
};

export default function AutomationsFeaturePage() {
  return (
    <FeaturePageLayout
      eyebrow="Automations & Flows"
      title={data.pageTitle}
      subtitle={data.pageSubtitle}
      heroMockup={<AutomationMockup />}
      sections={data.sections}
      sectionMockups={[
        <AutomationMockup key="trigger" />,
        <FlowMockup key="chatbot" />,
        <AutomationMockup key="condition" />,
        <AutomationMockup key="logs" />,
      ]}
      secondaryFeatures={data.secondaryFeatures}
      relatedPages={data.relatedPages}
      ctaTitle="Ready to automate your sales process?"
      ctaSubtitle="See how trigger-based rules and visual chatbots keep your pipeline moving while you sleep."
      jsonLd={jsonLd}
    />
  );
}
