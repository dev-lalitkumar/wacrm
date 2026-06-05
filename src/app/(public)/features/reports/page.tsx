import type { Metadata } from "next";
import { FeaturePageLayout } from "@/components/public/feature-page-layout";
import { FEATURE_PAGES } from "@/components/public/content";
import { ReportsMockup } from "@/components/public/mockups/reports-mockup";

const data = FEATURE_PAGES.find((p) => p.slug === "reports")!;

export const metadata: Metadata = {
  title: data.pageTitle,
  description: data.metaDescription,
  alternates: { canonical: "/features/reports" },
  openGraph: {
    title: `${data.pageTitle} — Tundla CRM`,
    description: data.metaDescription,
    url: "/features/reports",
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
  name: "Tundla CRM — Reports & Analytics Dashboard",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: data.metaDescription,
  featureList: [
    "Deal conversion funnel",
    "Revenue forecast reports",
    "Source ROI analysis",
    "Deal velocity tracking",
    "Team performance dashboards",
    "Role-scoped data access",
  ],
};

export default function ReportsFeaturePage() {
  return (
    <FeaturePageLayout
      eyebrow="Reports & Analytics"
      title={data.pageTitle}
      subtitle={data.pageSubtitle}
      heroMockup={<ReportsMockup />}
      sections={data.sections}
      sectionMockups={[
        <ReportsMockup key="funnel" />,
        <ReportsMockup key="forecast" />,
        <ReportsMockup key="source" />,
        <ReportsMockup key="team" />,
      ]}
      secondaryFeatures={data.secondaryFeatures}
      relatedPages={data.relatedPages}
      ctaTitle="Ready to see what's working?"
      ctaSubtitle="Get instant visibility into your sales performance with dashboards that update in real time."
      jsonLd={jsonLd}
    />
  );
}
