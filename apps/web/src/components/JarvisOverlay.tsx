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
      {/* Plasma glow blobs — slow drift, very subtle */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
        <div
          style={{
            ...blob,
            width: 800,
            height: 600,
            top: "15%",
            left: "20%",
            background:
              "radial-gradient(ellipse, rgba(0,180,255,0.7) 0%, transparent 65%)",
            animation: "plasma-a 18s ease-in-out infinite",
          }}
        />
        <div
          style={{
            ...blob,
            width: 600,
            height: 500,
            top: "35%",
            left: "45%",
            background:
              "radial-gradient(ellipse, rgba(0,80,220,0.65) 0%, transparent 65%)",
            animation: "plasma-b 22s ease-in-out infinite",
          }}
        />
        <div
          style={{
            ...blob,
            width: 500,
            height: 700,
            top: "5%",
            left: "50%",
            background:
              "radial-gradient(ellipse, rgba(80,0,220,0.5) 0%, transparent 65%)",
            animation: "plasma-c 26s ease-in-out infinite",
          }}
        />
      </div>

      {/* Concentric ring SVG */}
      <svg
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -54%)",
          width: "900px",
          height: "900px",
          opacity: 0.45,
        }}
        viewBox="0 0 900 900"
      >
        <defs>
          <radialGradient id="ringFade" cx="50%" cy="50%" r="50%">
            <stop offset="30%" stopColor="#000913" stopOpacity="0" />
            <stop offset="100%" stopColor="#000913" stopOpacity="0.75" />
          </radialGradient>
        </defs>

        <circle
          cx="450"
          cy="450"
          r="420"
          fill="none"
          stroke="rgba(0,212,255,0.10)"
          strokeWidth="1"
          strokeDasharray="4 14"
        />
        <circle
          cx="450"
          cy="450"
          r="370"
          fill="none"
          stroke="rgba(0,212,255,0.15)"
          strokeWidth="1.5"
          strokeDasharray="24 8"
        />
        <circle
          cx="450"
          cy="450"
          r="310"
          fill="none"
          stroke="rgba(0,212,255,0.10)"
          strokeWidth="1"
        />
        <circle
          cx="450"
          cy="450"
          r="260"
          fill="none"
          stroke="rgba(0,212,255,0.18)"
          strokeWidth="1"
          strokeDasharray="2 18"
        />
        <circle
          cx="450"
          cy="450"
          r="200"
          fill="none"
          stroke="rgba(0,212,255,0.08)"
          strokeWidth="2"
          strokeDasharray="60 20"
        />

        <line
          x1="450"
          y1="50"
          x2="450"
          y2="150"
          stroke="rgba(0,212,255,0.12)"
          strokeWidth="1"
        />
        <line
          x1="450"
          y1="750"
          x2="450"
          y2="850"
          stroke="rgba(0,212,255,0.12)"
          strokeWidth="1"
        />
        <line
          x1="50"
          y1="450"
          x2="150"
          y2="450"
          stroke="rgba(0,212,255,0.12)"
          strokeWidth="1"
        />
        <line
          x1="750"
          y1="450"
          x2="850"
          y2="450"
          stroke="rgba(0,212,255,0.12)"
          strokeWidth="1"
        />

        {[45, 135, 225, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={450 + Math.cos(rad) * 340}
              y1={450 + Math.sin(rad) * 340}
              x2={450 + Math.cos(rad) * 390}
              y2={450 + Math.sin(rad) * 390}
              stroke="rgba(0,212,255,0.2)"
              strokeWidth="1.5"
            />
          );
        })}

        <circle cx="450" cy="450" r="450" fill="url(#ringFade)" />
      </svg>

      <style>{`
        @keyframes plasma-a {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(-60px, 40px) scale(1.08); }
          66%      { transform: translate(40px, -30px) scale(0.94); }
        }
        @keyframes plasma-b {
          0%,100% { transform: translate(0,0) scale(1); }
          40%      { transform: translate(50px, -50px) scale(1.12); }
          70%      { transform: translate(-40px, 30px) scale(0.96); }
        }
        @keyframes plasma-c {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(-30px, 60px) scale(1.06); }
        }
      `}</style>
    </div>
  );
}

const blob: React.CSSProperties = {
  position: "absolute",
  filter: "blur(80px)",
  borderRadius: "50%",
};
