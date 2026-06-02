import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://crm.tundla.com';

// Allow crawling of the public marketing + legal pages; disallow the authed
// app, auth screens, API routes, and shared proposal links.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/inbox',
        '/contacts',
        '/pipelines',
        '/closed-deals',
        '/broadcasts',
        '/automations',
        '/flows',
        '/catalog',
        '/proposals',
        '/reports',
        '/settings',
        '/wa-dashboard',
        '/login',
        '/signup',
        '/forgot-password',
        '/change-password',
        '/api/',
        '/p/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
