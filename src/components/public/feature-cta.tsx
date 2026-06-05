import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FeatureCTA({
  title = "Ready to see it in action?",
  subtitle = "Book a guided demo and we'll tailor Tundla CRM to the way your team sells.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 via-indigo-500/10 to-transparent px-8 py-16 text-center sm:px-16">
        <div className="absolute -top-20 left-1/2 -z-10 size-72 -translate-x-1/2 rounded-full bg-primary/30 blur-3xl" />
        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          {subtitle}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/contact"
            className={cn(
              buttonVariants({ variant: "default" }),
              "h-12 gap-2 px-7 text-base shadow-xl shadow-primary/25",
            )}
          >
            Book a demo
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-12 px-7 text-base",
            )}
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
