import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Tundla brand mark — a black rounded square with a bold white "T",
 * matching the favicon. Rendered as inline SVG so it stays crisp at any
 * size and is independent of the active theme. A faint ring keeps the
 * black square legible on dark backgrounds.
 *
 * Reused across the public header/footer, auth pages, and the in-app
 * sidebar fallback. Pass `href` to wrap the logo in a link.
 */
export function LogoMark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[22%] bg-black ring-1 ring-white/15",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Top bar of the T */}
        <rect x="9" y="12" width="30" height="8.5" rx="4.25" fill="white" />
        {/* Stem of the T */}
        <rect x="19.75" y="12" width="8.5" height="26" rx="4.25" fill="white" />
      </svg>
    </span>
  );
}

export function Logo({
  size = 36,
  showWordmark = true,
  href,
  className,
  wordmarkClassName,
}: {
  size?: number;
  showWordmark?: boolean;
  href?: string;
  className?: string;
  wordmarkClassName?: string;
}) {
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {showWordmark && (
        <span
          className={cn(
            "text-lg font-semibold tracking-tight text-foreground",
            wordmarkClassName,
          )}
        >
          Tundla<span className="text-muted-foreground"> CRM</span>
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center" aria-label="Tundla CRM home">
        {content}
      </Link>
    );
  }

  return content;
}
