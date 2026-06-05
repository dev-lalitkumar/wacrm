import type { Metadata } from "next";
import { FeaturePageLayout } from "@/components/public/feature-page-layout";
import { FEATURE_PAGES } from "@/components/public/content";
import { GmailMockup, GmailComposeMockup } from "@/components/public/mockups/gmail-mockup";

const data = FEATURE_PAGES.find((p) => p.slug === "gmail")!;

export const metadata: Metadata = {
  title: data.pageTitle,
  description: data.metaDescription,
  alternates: { canonical: "/features/gmail" },
  openGraph: {
    title: `${data.pageTitle} — Tundla CRM`,
    description: data.metaDescription,
    url: "/features/gmail",
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
  name: "Tundla CRM — Gmail Integration",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: data.metaDescription,
  featureList: [
    "Send emails from CRM via Gmail",
    "Email open and delivery tracking",
    "Inbound email monitoring",
    "Secure Google OAuth connection",
    "Email linked to contacts and deals",
  ],
};

export default function GmailFeaturePage() {
  return (
    <FeaturePageLayout
      eyebrow="Gmail Integration"
      title={data.pageTitle}
      subtitle={data.pageSubtitle}
      heroMockup={<GmailMockup />}
      sections={data.sections}
      sectionMockups={[
        <GmailComposeMockup key="compose" />,
        <GmailMockup key="inbox" />,
        <GmailMockup key="oauth" />,
      ]}
      secondaryFeatures={data.secondaryFeatures}
      relatedPages={data.relatedPages}
      ctaTitle="Ready to bring email into your CRM?"
      ctaSubtitle="Connect Gmail in one click and start sending tracked emails alongside your WhatsApp conversations."
      jsonLd={jsonLd}
    />
  );
}
