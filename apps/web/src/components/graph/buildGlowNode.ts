import * as THREE from "three";
import type { AgentSnapshot } from "@coord-ui/shared";

export const STATUS_GLOW: Record<string, number> = {
  active: 0x00ff88,
  idle: 0xff8c00,
  stale: 0xff8c00, // stale = effectively idle — same colour, no alarm
  unknown: 0x334466,
};

export const ROOM_COLOR = 0x7b6fff;
export const BACKLOG_COLOR = 0xffaa00; // amber — distinct from agent/room
const COORDINATOR_ACCENT = 0xffd166; // command accent; status glow remains separate

// Shared ring texture for radio-wave sprites — created once, reused per pane
let _ringTex: THREE.Texture | null = null;
export function getRingTexture(): THREE.Texture {
  if (_ringTex) return _ringTex;
  const SIZE = 128;
  const cv = document.createElement("canvas");
  cv.width = SIZE;
  cv.height = SIZE;
  const ctx = cv.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 5, 0, Math.PI * 2);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 6;
  ctx.stroke();
  _ringTex = new THREE.CanvasTexture(cv);
  return _ringTex;
}

export function buildGlowNode(
  hexColor: number,
  radius = 5,
  pulse = false,
  agentId?: string,
  roomId?: string
): THREE.Group {
  const group = new THREE.Group();

  const coreMat = new THREE.MeshBasicMaterial({ color: hexColor });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 20), coreMat));

  const halo1Mat = new THREE.MeshBasicMaterial({
    color: hexColor,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(
    new THREE.Mesh(new THREE.SphereGeometry(radius * 1.4, 16, 16), halo1Mat)
  );

  const halo2Mat = new THREE.MeshBasicMaterial({
    color: hexColor,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const halo2 = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 2.0, 12, 12),
    halo2Mat
  );
  if (pulse) halo2.userData.pulseHalo = true;
  if (roomId) halo2.userData.activityHalo = roomId;
  group.add(halo2);

  const light = new THREE.PointLight(hexColor, 1.5, radius * 8);
  group.add(light);

  // Composed material state. dim (focus-lock), highlight (hover) and a decaying
  // activity glow (0→1, brightest right after a message) all flow through one
  // render() so they never fight over the same material props.
  const BASE_HALO1 = 0.28;
  const BASE_HALO2 = 0.12;
  const BASE_LIGHT = 1.5;
  let dimmed = false;
  let highlighted = false;
  let activity = 0; // 0..1 — driven down each frame after a message
  const render = () => {
    if (dimmed) {
      coreMat.transparent = true;
      coreMat.opacity = 0.1;
      halo1Mat.opacity = 0.03;
      halo2Mat.opacity = 0.02;
      light.intensity = 0;
      group.scale.setScalar(1);
      return;
    }
    const hi = highlighted ? 1 : 0;
    coreMat.transparent = true;
    coreMat.opacity = 1;
    halo1Mat.opacity = BASE_HALO1 + hi * 0.14 + activity * 0.4;
    halo2Mat.opacity = BASE_HALO2 + hi * 0.08 + activity * 0.28;
    light.intensity = BASE_LIGHT + hi * 2.5 + activity * 4.5;
    group.scale.setScalar(highlighted ? 1.5 : 1 + activity * 0.3);
  };

  group.userData.setDimmed = (on: boolean) => {
    dimmed = on;
    render();
  };

  if (agentId) {
    group.userData.agentId = agentId;
    group.userData.setColor = (hex: number, isPulse: boolean) => {
      const c = new THREE.Color(hex);
      coreMat.color.set(c);
      halo1Mat.color.set(c);
      halo2Mat.color.set(c);
      light.color.set(c);
      halo2.userData.pulseHalo = isPulse;
    };
    group.userData.setHighlight = (on: boolean) => {
      highlighted = on;
      render();
    };
    // Decaying activity glow — called every frame with a 0..1 recency level.
    group.userData.setActivityGlow = (level: number) => {
      const l = level < 0 ? 0 : level > 1 ? 1 : level;
      if (l === activity) return;
      activity = l;
      render();
    };
  }

  return group;
}

export function isCoordinatorAgent(agent: AgentSnapshot): boolean {
  const role = agent.metadata?.role;
  if (typeof role === "string") {
    return role.toLowerCase() === "coordinator";
  }

  return /(^coord|-coordinator$)/i.test(agent.name);
}

export function addCoordinatorMarker(group: THREE.Group): void {
  const ringMat = new THREE.MeshBasicMaterial({
    color: COORDINATOR_ACCENT,
    transparent: true,
    opacity: 0.52,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const crownRing = new THREE.Mesh(
    new THREE.TorusGeometry(8.4, 0.28, 8, 72),
    ringMat
  );
  crownRing.rotation.x = Math.PI / 2;
  crownRing.userData.coordinatorMarker = true;
  group.add(crownRing);

  for (let i = 0; i < 3; i++) {
    const tickMat = new THREE.MeshBasicMaterial({
      color: COORDINATOR_ACCENT,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const tick = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.2, 3), tickMat);
    const angle = -Math.PI / 2 + i * (Math.PI / 5);
    tick.position.set(Math.cos(angle) * 8.8, 7.2, Math.sin(angle) * 8.8);
    tick.rotation.z = -angle;
    tick.userData.coordinatorMarker = true;
    group.add(tick);
  }

  const tag = makeTextSprite("◆ COORD", "#ffd166", 4.2, 0.86);
  tag.position.set(0, 15.5, 0);
  tag.userData.coordinatorMarker = true;
  group.add(tag);
}

export function makeTextSprite(
  text: string,
  color: string,
  worldH = 8,
  opacity = 1
): THREE.Sprite {
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d")!;
  const fontSize = 22;
  const font = `${fontSize}px "Share Tech Mono", monospace`;
  ctx.font = font;
  const pad = 10;
  const W = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const H = fontSize + pad;
  cv.width = W;
  cv.height = H;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H / 2);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set((W / H) * worldH, worldH, 1);
  return sprite;
}
