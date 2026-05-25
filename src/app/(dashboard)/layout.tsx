import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "./dashboard-shell";
import { getAuthedCaller } from "@/lib/auth/require-role";

// Server layout whose only job is to declare "do not index" metadata
// for the authed app. robots.ts already disallows these paths at the
// crawler-level and middleware redirects unauthenticated visitors, so
// this is belt-and-suspenders — but SEO-critical if a URL ever leaks
// via a link shared externally.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Forced password-change gate. Server-side so the redirect runs
  // before any dashboard chrome / data fetches kick in. Middleware
  // would also work, but it'd cost a DB roundtrip per request; here
  // we already need the profile to render the shell.
  const caller = await getAuthedCaller();
  if (caller?.mustChangePassword) {
    redirect("/change-password");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
