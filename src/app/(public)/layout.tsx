import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuroraBackground } from "@/components/public/aurora-background";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";

// Public marketing pages SHOULD be indexed (the root layout defaults to
// noindex for the authed app). This override re-enables indexing for every
// page rendered inside the (public) route group.
export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
  },
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <AuroraBackground />
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
