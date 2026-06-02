/**
 * Ambient "violet aurora" backdrop for the public marketing pages.
 *
 * Pure CSS — three blurred radial-gradient blobs that drift slowly behind
 * the content, plus a faint dotted grid and a top glow. Fixed to the
 * viewport and pointer-events-none so it never interferes with the UI.
 * Animation is disabled under `prefers-reduced-motion`.
 *
 * Self-contained: keyframes are declared in a scoped <style> tag so the
 * global stylesheet/theme system is untouched.
 */
export function AuroraBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#07070b]"
    >
      {/* Dotted grid */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, rgba(255,255,255,0.18) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)",
        }}
      />

      {/* Aurora blobs */}
      <div className="aurora-blob aurora-blob--1" />
      <div className="aurora-blob aurora-blob--2" />
      <div className="aurora-blob aurora-blob--3" />

      {/* Bottom fade into the page background */}
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#07070b] to-transparent" />

      <style>{`
        .aurora-blob {
          position: absolute;
          border-radius: 9999px;
          filter: blur(80px);
          opacity: 0.55;
          will-change: transform;
        }
        .aurora-blob--1 {
          top: -10%;
          left: 50%;
          width: 46rem;
          height: 46rem;
          transform: translateX(-50%);
          background: radial-gradient(circle at center, rgba(124,58,237,0.55), transparent 70%);
          animation: aurora-drift-1 18s ease-in-out infinite alternate;
        }
        .aurora-blob--2 {
          top: 6%;
          left: 8%;
          width: 32rem;
          height: 32rem;
          background: radial-gradient(circle at center, rgba(99,102,241,0.45), transparent 70%);
          animation: aurora-drift-2 22s ease-in-out infinite alternate;
        }
        .aurora-blob--3 {
          top: 4%;
          right: 6%;
          width: 30rem;
          height: 30rem;
          background: radial-gradient(circle at center, rgba(168,85,247,0.40), transparent 70%);
          animation: aurora-drift-3 26s ease-in-out infinite alternate;
        }
        @keyframes aurora-drift-1 {
          from { transform: translateX(-50%) translateY(0) scale(1); }
          to   { transform: translateX(-50%) translateY(40px) scale(1.08); }
        }
        @keyframes aurora-drift-2 {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(60px, 30px) scale(1.12); }
        }
        @keyframes aurora-drift-3 {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(-50px, 40px) scale(1.1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .aurora-blob { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
