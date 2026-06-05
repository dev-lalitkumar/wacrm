import type { Metadata } from "next";
import { FeaturePageLayout } from "@/components/public/feature-page-layout";
import { FEATURE_PAGES } from "@/components/public/content";
import { ContactTableMockup } from "@/components/public/mockups/contact-table-mockup";
import { TelephonyMockup } from "@/components/public/mockups/telephony-mockup";

const data = FEATURE_PAGES.find((p) => p.slug === "leads-contacts")!;

export const metadata: Metadata = {
  title: data.pageTitle,
  description: data.metaDescription,
  alternates: { canonical: "/features/leads-contacts" },
  openGraph: {
    title: `${data.pageTitle} — Tundla CRM`,
    description: data.metaDescription,
    url: "/features/leads-contacts",
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
  name: "Tundla CRM — Lead & Contact Management",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: data.metaDescription,
  featureList: [
    "Lead status tracking",
    "Custom fields for contacts and deals",
    "Tags and segmentation",
    "Click-to-call telephony",
    "Contact merge and deduplication",
    "Bulk actions",
  ],
};

export default function LeadsContactsFeaturePage() {
  return (
    <FeaturePageLayout
      eyebrow="Leads & Contacts"
      title={data.pageTitle}
      subtitle={data.pageSubtitle}
      heroMockup={<ContactTableMockup />}
      sections={data.sections}
      sectionMockups={[
        <ContactTableMockup key="status" />,
        <ContactTableMockup key="fields" />,
        <ContactTableMockup key="tags" />,
        <TelephonyMockup key="telephony" />,
      ]}
      secondaryFeatures={data.secondaryFeatures}
      relatedPages={data.relatedPages}
      ctaTitle="Ready to organize every lead?"
      ctaSubtitle="See how Tundla keeps your contacts clean, segmented, and ready to convert."
      jsonLd={jsonLd}
    />
  );
}
