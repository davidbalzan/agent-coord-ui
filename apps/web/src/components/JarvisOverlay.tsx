// Decorative JARVIS-style overlay: concentric rings + radar sweep.
// Pointer-events: none — purely visual, sits behind panels.
export function JarvisOverlay() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      {/* Concentric ring SVG — centered in the canvas */}
      <svg
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -54%)",
          width: "900px",
          height: "900px",
          marginLeft: "-450px",
          marginTop: "-450px",
          opacity: 0.55,
        }}
        viewBox="0 0 900 900"
      >
        <defs>
          <radialGradient id="ringFade" cx="50%" cy="50%" r="50%">
            <stop offset="30%" stopColor="#000913" stopOpacity="0" />
            <stop offset="100%" stopColor="#000913" stopOpacity="0.7" />
          </radialGradient>
        </defs>

        {/* Ring 1 — outermost, fine dashes */}
        <circle
          cx="450"
          cy="450"
          r="420"
          fill="none"
          stroke="rgba(0,212,255,0.12)"
          strokeWidth="1"
          strokeDasharray="4 14"
        />

        {/* Ring 2 — segmented */}
        <circle
          cx="450"
          cy="450"
          r="370"
          fill="none"
          stroke="rgba(0,212,255,0.18)"
          strokeWidth="1.5"
          strokeDasharray="24 8"
        />

        {/* Ring 3 — solid thin */}
        <circle
          cx="450"
          cy="450"
          r="310"
          fill="none"
          stroke="rgba(0,212,255,0.14)"
          strokeWidth="1"
        />

        {/* Ring 4 — tick marks */}
        <circle
          cx="450"
          cy="450"
          r="260"
          fill="none"
          stroke="rgba(0,212,255,0.22)"
          strokeWidth="1"
          strokeDasharray="2 18"
        />

        {/* Ring 5 — inner accent */}
        <circle
          cx="450"
          cy="450"
          r="200"
          fill="none"
          stroke="rgba(0,212,255,0.1)"
          strokeWidth="2"
          strokeDasharray="60 20"
        />

        {/* Cross-hair lines */}
        <line
          x1="450"
          y1="50"
          x2="450"
          y2="150"
          stroke="rgba(0,212,255,0.15)"
          strokeWidth="1"
        />
        <line
          x1="450"
          y1="750"
          x2="450"
          y2="850"
          stroke="rgba(0,212,255,0.15)"
          strokeWidth="1"
        />
        <line
          x1="50"
          y1="450"
          x2="150"
          y2="450"
          stroke="rgba(0,212,255,0.15)"
          strokeWidth="1"
        />
        <line
          x1="750"
          y1="450"
          x2="850"
          y2="450"
          stroke="rgba(0,212,255,0.15)"
          strokeWidth="1"
        />

        {/* Diagonal accent marks at 45° */}
        {[45, 135, 225, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const r1 = 340,
            r2 = 390;
          return (
            <line
              key={deg}
              x1={450 + Math.cos(rad) * r1}
              y1={450 + Math.sin(rad) * r1}
              x2={450 + Math.cos(rad) * r2}
              y2={450 + Math.sin(rad) * r2}
              stroke="rgba(0,212,255,0.25)"
              strokeWidth="1.5"
            />
          );
        })}

        {/* Fade mask so edges blend into the dark background */}
        <circle cx="450" cy="450" r="450" fill="url(#ringFade)" />
      </svg>

      {/* Radar sweep — CSS rotating div with conic gradient */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "620px",
          height: "620px",
          marginLeft: "-310px",
          marginTop: "-340px",
          borderRadius: "50%",
          animation: "jarvis-radar 10s linear infinite",
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(0,212,255,0.07) 40deg, rgba(0,212,255,0.03) 70deg, transparent 90deg)",
        }}
      />

      {/* Radar sweep leading edge line */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "310px",
          height: "1px",
          marginTop: "-340px",
          transformOrigin: "0% 50%",
          animation: "jarvis-radar 10s linear infinite",
          background:
            "linear-gradient(to right, rgba(0,212,255,0.6), transparent)",
        }}
      />

      <style>{`
        @keyframes jarvis-radar {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
