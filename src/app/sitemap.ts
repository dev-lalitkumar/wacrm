import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://crm.tundla.com';

// Public, indexable URLs only. Authed app routes (/dashboard, /inbox, …) and
// API routes are intentionally excluded and disallowed in robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  }[] = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/features', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/features/whatsapp', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/features/gmail', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/features/leads-contacts', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/features/sales-pipeline', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/features/proposals', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/features/automations', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/features/reports', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/features/integrations', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/data-deletion', priority: 0.3, changeFrequency: 'yearly' },
  ];

  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
