import type { Metadata } from "next";
import { FeaturePageLayout } from "@/components/public/feature-page-layout";
import { FEATURE_PAGES } from "@/components/public/content";
import { BroadcastMockup } from "@/components/public/mockups/broadcast-mockup";
import { WebhookMockup } from "@/components/public/mockups/webhook-mockup";
import { FormMockup } from "@/components/public/mockups/form-mockup";
import { NotificationMockup } from "@/components/public/mockups/notification-mockup";

const data = FEATURE_PAGES.find((p) => p.slug === "integrations")!;

export const metadata: Metadata = {
  title: data.pageTitle,
  description: data.metaDescription,
  alternates: { canonical: "/features/integrations" },
  openGraph: {
    title: `${data.pageTitle} — Tundla CRM`,
    description: data.metaDescription,
    url: "/features/integrations",
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
  name: "Tundla CRM — Integrations & Multichannel Tools",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: data.metaDescription,
  featureList: [
    "WhatsApp broadcast campaigns",
    "Custom webhooks for any platform",
    "Scheduled lead fetch sources",
    "Embeddable lead capture forms",
    "Multi-channel notifications",
    "3-role access control",
  ],
};

export default function IntegrationsFeaturePage() {
  return (
    <FeaturePageLayout
      eyebrow="Integrations"
      title={data.pageTitle}
      subtitle={data.pageSubtitle}
      heroMockup={<WebhookMockup />}
      sections={data.sections}
      sectionMockups={[
        <BroadcastMockup key="broadcast" />,
        <WebhookMockup key="webhook" />,
        <WebhookMockup key="fetch" />,
        <FormMockup key="form" />,
      ]}
      secondaryFeatures={data.secondaryFeatures}
      relatedPages={data.relatedPages}
      ctaTitle="Ready to connect every lead source?"
      ctaSubtitle="Plug in any platform, embed forms, and keep your team notified across every channel."
      jsonLd={jsonLd}
    />
  );
}
