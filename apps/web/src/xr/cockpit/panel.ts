import * as THREE from "three";

/**
 * World-space NEXUS-styled panel: a canvas texture on a plane, drawn with the
 * same visual language as the DOM panels (dark glass, cyan border, corner
 * brackets, mono type). DOM does not exist inside an immersive session, so
 * every VR surface renders through one of these.
 */
export interface XrPanel {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** Redraw: chrome is painted first, then `fn` over it. Pixel space. */
  draw(
    fn?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  ): void;
  dispose(): void;
}

export const XR_FONT_MONO = '"Share Tech Mono", "Courier New", monospace';
export const XR_FONT_DISPLAY = '"Orbitron", "Share Tech Mono", monospace';
export const XR_CYAN = "#00d4ff";
export const XR_DIM = "rgba(0, 212, 255, 0.55)";

const PX_PER_M = 1024;

export function createXrPanel(widthM: number, heightM: number): XrPanel {
  const w = Math.round(widthM * PX_PER_M);
  const h = Math.round(heightM * PX_PER_M);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(widthM, heightM),
    material
  );
  mesh.renderOrder = 10; // over graph glow sprites

  const drawChrome = () => {
    ctx.clearRect(0, 0, w, h);
    // Glass body
    ctx.fillStyle = "rgba(0, 8, 20, 0.88)";
    ctx.fillRect(0, 0, w, h);
    // Border
    ctx.strokeStyle = "rgba(0, 212, 255, 0.45)";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
    // Corner brackets
    ctx.strokeStyle = XR_CYAN;
    ctx.lineWidth = 5;
    const b = Math.min(w, h) * 0.08;
    for (const [cx, cy, dx, dy] of [
      [0, 0, 1, 1],
      [w, 0, -1, 1],
      [0, h, 1, -1],
      [w, h, -1, -1],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * b, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * b);
      ctx.stroke();
    }
  };

  return {
    mesh,
    draw(fn) {
      drawChrome();
      fn?.(ctx, w, h);
      texture.needsUpdate = true;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}

/** Convenience: draw a heading + mono body lines onto a panel context. */
export function drawPanelText(
  ctx: CanvasRenderingContext2D,
  w: number,
  title: string,
  lines: { text: string; color?: string }[]
): void {
  const pad = w * 0.06;
  ctx.font = `700 ${Math.round(w * 0.055)}px ${XR_FONT_DISPLAY}`;
  ctx.fillStyle = XR_CYAN;
  ctx.textBaseline = "top";
  ctx.fillText(title.toUpperCase(), pad, pad);
  ctx.fillStyle = XR_DIM;
  ctx.fillRect(pad, pad + w * 0.085, w - pad * 2, 2);

  const lineSize = Math.round(w * 0.042);
  ctx.font = `${lineSize}px ${XR_FONT_MONO}`;
  let y = pad + w * 0.13;
  for (const line of lines) {
    ctx.fillStyle = line.color ?? "rgba(220, 240, 255, 0.85)";
    ctx.fillText(line.text, pad, y);
    y += lineSize * 1.55;
  }
}
