import type { MetadataRoute } from "next";

// PWA web manifest for Tundla CRM. Next.js serves this at /manifest.webmanifest
// and injects the <link rel="manifest"> tag automatically. Icons live in
// public/ (android-chrome-*.png); the brand mark is the black "T" square.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tundla CRM",
    short_name: "Tundla",
    description:
      "The WhatsApp-first CRM for modern sales teams — inbox, broadcasts, pipelines, and Meta lead capture in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
