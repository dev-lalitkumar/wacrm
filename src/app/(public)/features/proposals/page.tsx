import type { Metadata } from "next";
import { FeaturePageLayout } from "@/components/public/feature-page-layout";
import { FEATURE_PAGES } from "@/components/public/content";
import { ProposalMockup } from "@/components/public/mockups/proposal-mockup";
import { CatalogMockup } from "@/components/public/mockups/catalog-mockup";

const data = FEATURE_PAGES.find((p) => p.slug === "proposals")!;

export const metadata: Metadata = {
  title: data.pageTitle,
  description: data.metaDescription,
  alternates: { canonical: "/features/proposals" },
  openGraph: {
    title: `${data.pageTitle} — Tundla CRM`,
    description: data.metaDescription,
    url: "/features/proposals",
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
  name: "Tundla CRM — Proposals & Product Catalog",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: data.metaDescription,
  featureList: [
    "Proposal builder with line items",
    "Client accept/reject portal",
    "Product catalog management",
    "Send proposals via email or WhatsApp",
    "PDF generation",
    "Proposal view and status tracking",
  ],
};

export default function ProposalsFeaturePage() {
  return (
    <FeaturePageLayout
      eyebrow="Proposals & Catalog"
      title={data.pageTitle}
      subtitle={data.pageSubtitle}
      heroMockup={<ProposalMockup />}
      sections={data.sections}
      sectionMockups={[
        <ProposalMockup key="builder" />,
        <ProposalMockup key="portal" />,
        <CatalogMockup key="catalog" />,
        <ProposalMockup key="send" />,
      ]}
      secondaryFeatures={data.secondaryFeatures}
      relatedPages={data.relatedPages}
      ctaTitle="Ready to send proposals that close?"
      ctaSubtitle="Build, send, and track proposals from your CRM — with real-time notifications when clients act."
      jsonLd={jsonLd}
    />
  );
}
