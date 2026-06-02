import { ImageResponse } from "next/og";

// Branded Open Graph image for the public pages — rendered at build time.
// Satori supports flexbox + a subset of CSS; keep layout simple.
export const alt = "Tundla CRM — The WhatsApp-first CRM for modern sales teams";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background:
            "linear-gradient(135deg, #07070b 0%, #1a0b33 55%, #2a1259 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 96,
              height: 96,
              borderRadius: 22,
              background: "#000",
              border: "1px solid rgba(255,255,255,0.15)",
              fontSize: 64,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            T
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>
            Tundla <span style={{ color: "#a78bfa", marginLeft: 12 }}>CRM</span>
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            marginTop: 56,
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1.1,
            maxWidth: 900,
            letterSpacing: -1,
          }}
        >
          The WhatsApp-first CRM for modern sales teams
        </div>

        {/* Subline */}
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 30,
            color: "rgba(255,255,255,0.7)",
            maxWidth: 820,
          }}
        >
          Capture leads, talk on WhatsApp, and close deals — all in one place.
        </div>
      </div>
    ),
    { ...size },
  );
}
