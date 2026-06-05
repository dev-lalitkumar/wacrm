import type { Metadata } from "next";
import { FeaturePageLayout } from "@/components/public/feature-page-layout";
import { FEATURE_PAGES } from "@/components/public/content";
import { InboxMockup } from "@/components/public/mockups/inbox-mockup";

const data = FEATURE_PAGES.find((p) => p.slug === "whatsapp")!;

export const metadata: Metadata = {
  title: data.pageTitle,
  description: data.metaDescription,
  alternates: { canonical: "/features/whatsapp" },
  openGraph: {
    title: `${data.pageTitle} — Tundla CRM`,
    description: data.metaDescription,
    url: "/features/whatsapp",
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
  name: "Tundla CRM — WhatsApp Business Integration",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: data.metaDescription,
  featureList: [
    "Shared WhatsApp team inbox",
    "WhatsApp message templates",
    "Interactive button and list messages",
    "Meta embedded signup",
    "Message delivery tracking",
    "Auto-contact creation from WhatsApp",
  ],
};

export default function WhatsAppFeaturePage() {
  return (
    <FeaturePageLayout
      eyebrow="WhatsApp Business"
      title={data.pageTitle}
      subtitle={data.pageSubtitle}
      heroMockup={<InboxMockup />}
      sections={data.sections}
      sectionMockups={[
        <InboxMockup key="inbox" />,
        <InboxMockup key="templates" />,
        <InboxMockup key="interactive" />,
        <InboxMockup key="signup" />,
      ]}
      secondaryFeatures={data.secondaryFeatures}
      relatedPages={data.relatedPages}
      ctaTitle="Ready to unify your WhatsApp conversations?"
      ctaSubtitle="Book a demo and see how Tundla turns your WhatsApp Business into a team-wide sales channel."
      jsonLd={jsonLd}
    />
  );
}
