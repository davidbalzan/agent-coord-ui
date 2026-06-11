import * as THREE from "three";
import type {
  AgentSnapshot,
  PaneSnapshot,
  ProjectBacklog,
} from "@coord-ui/shared";
import type { GraphNode } from "./backlogNodes.js";
import { FONT_MONO } from "../../theme/tokens.js";

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
  const font = `${fontSize}px ${FONT_MONO}`;
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

interface RefLike<T> {
  current: T;
}

interface CreateNodeThreeObjectArgs {
  nodeDimSetters: RefLike<Map<string, (dimmed: boolean) => void>>;
  paneSelSetters: RefLike<Map<string, (selected: boolean) => void>>;
  paneActivitySetters: RefLike<Map<string, (lastActivity: number) => void>>;
  paneWaveState: RefLike<
    Map<string, { color: number; period: number; visible: boolean }>
  >;
  colorSetters: RefLike<Map<string, (hex: number, pulse: boolean) => void>>;
  highlightSetters: RefLike<Map<string, (on: boolean) => void>>;
  agentLabelSetters: RefLike<Map<string, (visible: boolean) => void>>;
}

export function createNodeThreeObject({
  nodeDimSetters,
  paneSelSetters,
  paneActivitySetters,
  paneWaveState,
  colorSetters,
  highlightSetters,
  agentLabelSetters,
}: CreateNodeThreeObjectArgs): (n: object) => THREE.Object3D {
  return (n: object) => {
    const node = n as GraphNode;
    if (node.kind === "room") {
      const group = buildGlowNode(ROOM_COLOR, 6, false, undefined, node.id);
      const label = makeTextSprite(`#${node.label}`, "#b090ff", 10);
      label.position.set(0, 16, 0);
      group.add(label);
      nodeDimSetters.current.set(
        node.id,
        group.userData.setDimmed as (d: boolean) => void
      );
      return group;
    }
    if (node.kind === "pane") {
      const pane = node.data as PaneSnapshot;
      const group = new THREE.Group();

      // Canvas sprite — terminal >_ icon
      const SIZE = 64;
      const cv = document.createElement("canvas");
      cv.width = SIZE;
      cv.height = SIZE;
      const ctx = cv.getContext("2d")!;
      // rounded rect background
      const r = 10;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(SIZE - r, 0);
      ctx.quadraticCurveTo(SIZE, 0, SIZE, r);
      ctx.lineTo(SIZE, SIZE - r);
      ctx.quadraticCurveTo(SIZE, SIZE, SIZE - r, SIZE);
      ctx.lineTo(r, SIZE);
      ctx.quadraticCurveTo(0, SIZE, 0, SIZE - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fillStyle = "rgba(0,20,10,0.85)";
      ctx.fill();
      ctx.strokeStyle = "#00ff41";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // >_ text
      ctx.font = "bold 22px monospace";
      ctx.fillStyle = "#00ff41";
      ctx.shadowColor = "#00ff41";
      ctx.shadowBlur = 8;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(">_", SIZE / 2, SIZE / 2);

      const tex = new THREE.CanvasTexture(cv);
      const spriteMat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(8, 8, 1);
      group.add(sprite);

      // Selection indicator — rotating torus ring, hidden until selected
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ff41,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(7, 0.35, 8, 40),
        ringMat
      );
      ring.userData.selectionRing = true;
      group.add(ring);

      // Outer glow ring (larger, more diffuse)
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0x00ff41,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const outer = new THREE.Mesh(
        new THREE.TorusGeometry(9.5, 0.15, 8, 40),
        outerMat
      );
      outer.userData.selectionRing = true;
      group.add(outer);

      paneSelSetters.current.set(pane.id, (selected: boolean) => {
        ringMat.opacity = selected ? 0.9 : 0;
        outerMat.opacity = selected ? 0.35 : 0;
        ring.userData.isSelected = selected;
        outer.userData.isSelected = selected;
      });

      // Radio-wave rings — 3 camera-facing sprites, staggered phase
      for (let i = 0; i < 3; i++) {
        const mat = new THREE.SpriteMaterial({
          map: getRingTexture(),
          transparent: true,
          opacity: 0,
          color: new THREE.Color(0x00ff41),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const wave = new THREE.Sprite(mat);
        wave.scale.set(8, 8, 1);
        wave.userData.radioWave = true;
        wave.userData.paneId = pane.id;
        wave.userData.phaseOffset = i / 3; // 0, 0.33, 0.66
        group.add(wave);
      }

      // Dim setter for pane nodes — dims the icon sprite
      nodeDimSetters.current.set(`pane:${pane.id}`, (dimmed: boolean) => {
        group.traverse((child) => {
          if (child instanceof THREE.Sprite && !child.userData.radioWave) {
            child.material.opacity = dimmed ? 0.08 : 1.0;
          }
        });
      });

      paneActivitySetters.current.set(pane.id, (lastActivity: number) => {
        const ago = (Date.now() - lastActivity) / 1000;
        paneWaveState.current.set(
          pane.id,
          ago < 5
            ? { color: 0x00ff41, period: 1.6, visible: true }
            : ago < 30
              ? { color: 0xff8c00, period: 2.8, visible: true }
              : { color: 0x334455, period: 3.5, visible: false }
        );
      });

      // Seed initial state
      const ago0 = (Date.now() - pane.lastActivity) / 1000;
      paneWaveState.current.set(
        pane.id,
        ago0 < 5
          ? { color: 0x00ff41, period: 1.6, visible: true }
          : ago0 < 30
            ? { color: 0xff8c00, period: 2.8, visible: true }
            : { color: 0x334455, period: 3.5, visible: false }
      );

      // Session group label — shows which tmux session this pane belongs to.
      // Positioned below the icon; hidden until camera is close enough (the
      // agentLabelSetters proximity check in the animation loop also drives
      // this one via the same visible flag stored in userData).
      const sessionLabel = makeTextSprite(
        `[${pane.session}:${pane.window}]`,
        "#44cc88",
        4,
        0.55
      );
      sessionLabel.position.set(0, -13, 0);
      sessionLabel.userData.groupLabel = true;
      group.add(sessionLabel);

      return group;
    }
    if (node.kind === "backlog") {
      const group = new THREE.Group();

      // Document icon: canvas sprite with amber glyph
      const SIZE = 64;
      const cv = document.createElement("canvas");
      cv.width = SIZE;
      cv.height = SIZE;
      const ctx = cv.getContext("2d")!;
      // Rounded rect background
      const r = 8;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(SIZE - r - 12, 0); // leave room for folded corner
      ctx.lineTo(SIZE - 12, r);
      ctx.lineTo(SIZE - 12, SIZE - r);
      ctx.quadraticCurveTo(SIZE - 12, SIZE, SIZE - 12 - r, SIZE);
      ctx.lineTo(r, SIZE);
      ctx.quadraticCurveTo(0, SIZE, 0, SIZE - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fillStyle = "rgba(30,16,0,0.88)";
      ctx.fill();
      ctx.strokeStyle = "#ffaa00";
      ctx.lineWidth = 2;
      ctx.stroke();
      // Folded corner
      ctx.beginPath();
      ctx.moveTo(SIZE - 12 - 10, 0);
      ctx.lineTo(SIZE - 12 - 10, 10);
      ctx.lineTo(SIZE - 12, 10);
      ctx.strokeStyle = "rgba(255,170,0,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Text lines (document content suggestion)
      ctx.fillStyle = "rgba(255,170,0,0.55)";
      for (let i = 0; i < 3; i++) {
        const y = 22 + i * 12;
        const w = i === 2 ? 20 : 30;
        ctx.fillRect(8, y, w, 3);
      }
      // Checkmark bullet on first line
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "#ffaa00";
      ctx.shadowColor = "#ffaa00";
      ctx.shadowBlur = 6;
      ctx.fillText("✓", 8, 21);

      const tex = new THREE.CanvasTexture(cv);
      const spriteMat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(10, 10, 1);
      group.add(sprite);

      // Amber ambient glow
      const glowMat = new THREE.MeshBasicMaterial({
        color: BACKLOG_COLOR,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      group.add(new THREE.Mesh(new THREE.SphereGeometry(8, 10, 10), glowMat));

      const light = new THREE.PointLight(BACKLOG_COLOR, 0.8, 40);
      group.add(light);

      // Label
      const label = makeTextSprite(node.label, "#ffaa00", 7, 0.75);
      label.position.set(0, 14, 0);
      group.add(label);

      nodeDimSetters.current.set(
        `backlog:${(node.data as ProjectBacklog).project}`,
        (dimmed: boolean) => {
          sprite.material.opacity = dimmed ? 0.08 : 1;
          glowMat.opacity = dimmed ? 0.02 : 0.12;
          light.intensity = dimmed ? 0 : 0.8;
        }
      );

      return group;
    }
    const agent = node.data as AgentSnapshot;
    const hex = STATUS_GLOW[agent.status] ?? STATUS_GLOW["unknown"]!;
    const group = buildGlowNode(hex, 5, agent.status === "stale", agent.id);
    const isCoordinator = isCoordinatorAgent(agent);
    if (isCoordinator) addCoordinatorMarker(group);
    if (group.userData.setColor) {
      colorSetters.current.set(
        agent.id,
        group.userData.setColor as (hex: number, pulse: boolean) => void
      );
    }
    if (group.userData.setHighlight) {
      highlightSetters.current.set(
        agent.id,
        group.userData.setHighlight as (on: boolean) => void
      );
    }
    nodeDimSetters.current.set(
      agent.id,
      group.userData.setDimmed as (d: boolean) => void
    );
    // Subtle agent label — smaller and dimmer than channel names
    const agentLabel = makeTextSprite(agent.name, "#8fffc4", 5, 0.6);
    agentLabel.position.set(0, isCoordinator ? 20.5 : 10, 0);
    group.add(agentLabel);
    agentLabelSetters.current.set(agent.id, (v: boolean) => {
      agentLabel.visible = v;
    });

    // Burst rings — 3 expanding ring sprites, triggered by message activity
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.SpriteMaterial({
        map: getRingTexture(),
        transparent: true,
        opacity: 0,
        color: new THREE.Color(hex),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Sprite(mat);
      ring.scale.set(10, 10, 1);
      ring.userData.agentRingWave = true;
      ring.userData.agentId = agent.id;
      ring.userData.phaseOffset = i / 3;
      group.add(ring);
    }

    return group;
  };
}
