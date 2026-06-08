import { useEffect, useRef, useCallback } from "react";
import ForceGraph3D from "3d-force-graph";
import * as THREE from "three";
import { useBusStore } from "../store/bus.js";
import type {
  AgentSnapshot,
  RoomSnapshot,
  MessageSnapshot,
  PaneSnapshot,
} from "@coord-ui/shared";

type NodeType = "agent" | "room" | "pane";

interface GraphNode {
  id: string;
  kind: NodeType;
  label: string;
  data: AgentSnapshot | RoomSnapshot | PaneSnapshot;
  x?: number;
  y?: number;
  z?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  kind: "membership" | "dm" | "pane-agent" | "pane-h" | "pane-v";
}

const STATUS_GLOW: Record<string, number> = {
  active: 0x00ff88,
  idle: 0xff8c00,
  stale: 0xff3333,
  unknown: 0x334466,
};

const ROOM_COLOR = 0x7b6fff;

const SPEED_BASE = 0.004;
const SPEED_BOOST = 0.04;
const SPEED_DECAY = 0.15;

function linkKey(msg: MessageSnapshot): string {
  return msg.isDM
    ? `dm:${[msg.from, msg.to].sort().join(":")}`
    : `room:${msg.to}:${msg.from}`;
}

function graphLinkKey(l: GraphLink): string {
  const src = typeof l.source === "object" ? l.source.id : l.source;
  const tgt = typeof l.target === "object" ? l.target.id : l.target;
  return l.kind === "dm"
    ? `dm:${[src, tgt].sort().join(":")}`
    : `room:${src}:${tgt}`;
}

function buildGlowNode(
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
      group.scale.setScalar(on ? 1.5 : 1.0);
      halo1Mat.opacity = on ? 0.42 : 0.18;
      halo2Mat.opacity = on ? 0.2 : 0.07;
      light.intensity = on ? 4.0 : 1.5;
    };
  }

  return group;
}

function nodeId(n: string | GraphNode): string {
  return typeof n === "object" ? n.id : n;
}

// Helpers: do two panes share horizontal or vertical overlap (for adjacency test)
function overlapsH(a: PaneSnapshot, b: PaneSnapshot): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width;
}
function overlapsV(a: PaneSnapshot, b: PaneSnapshot): boolean {
  return a.top < b.top + b.height && b.top < a.top + a.height;
}

export function Graph3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);
  const lastMsgTimeRef = useRef<Map<string, number>>(new Map());
  // unix ms of last message per room id — drives halo ripple
  const roomActivityRef = useRef<Map<string, number>>(new Map());
  const prevMsgLenRef = useRef(0);
  const colorSetters = useRef<
    Map<string, (hex: number, pulse: boolean) => void>
  >(new Map());
  const highlightSetters = useRef<Map<string, (on: boolean) => void>>(
    new Map()
  );
  const paneSelSetters = useRef<Map<string, (selected: boolean) => void>>(
    new Map()
  );
  const paneActivitySetters = useRef<
    Map<string, (lastActivity: number) => void>
  >(new Map());

  const agentsMap = useBusStore((s) => s.agents);
  const roomsMap = useBusStore((s) => s.rooms);
  const panesMap = useBusStore((s) => s.panes);
  const messages = useBusStore((s) => s.messages);
  const nameFilter = useBusStore((s) => s.nameFilter);
  const paneSelection = useBusStore((s) => s.paneSelection);
  const agents = Object.values(agentsMap);
  const rooms = Object.values(roomsMap);
  const panes = Object.values(panesMap);
  const setSelection = useBusStore((s) => s.setSelection);
  const setPaneSelection = useBusStore((s) => s.setPaneSelection);
  const hoveredAgentId = useBusStore((s) => s.hoveredAgentId);
  const sidePanelWidth = useBusStore((s) => s.sidePanelWidth);

  // Always-current ref so color updater doesn't need agentsMap as a dep
  const agentsMapRef = useRef(agentsMap);
  agentsMapRef.current = agentsMap;

  const applyNodeColors = useCallback(() => {
    for (const [id, setColor] of colorSetters.current) {
      const agent = agentsMapRef.current[id];
      if (!agent) continue;
      const hex = STATUS_GLOW[agent.status] ?? STATUS_GLOW["unknown"]!;
      setColor(hex, agent.status === "stale");
    }
  }, []);

  // Keep pane selection ring in sync
  useEffect(() => {
    for (const [id, setSelected] of paneSelSetters.current) {
      setSelected(id === paneSelection);
    }
  }, [paneSelection]);

  // Highlight hovered agent node and fly camera toward it
  useEffect(() => {
    for (const setter of highlightSetters.current.values()) setter(false);
    if (!hoveredAgentId || !graphRef.current) return;
    highlightSetters.current.get(hoveredAgentId)?.(true);
    const gd = graphRef.current.graphData() as { nodes: GraphNode[] };
    const node = gd.nodes.find((n) => n.id === hoveredAgentId);
    if (!node || node.x == null) return;
    const nx = node.x,
      ny = node.y ?? 0,
      nz = node.z ?? 0;
    const dist = 80;
    const mag = Math.hypot(nx, ny, nz) || 1;
    const ratio = 1 + dist / mag;
    graphRef.current.cameraPosition(
      { x: nx * ratio, y: ny * ratio, z: nz * ratio },
      { x: nx, y: ny, z: nz },
      600
    );
  }, [hoveredAgentId]);

  // Emit particle bursts on new messages — skip historical (full_state) messages
  useEffect(() => {
    const newMsgs = messages.slice(prevMsgLenRef.current);
    prevMsgLenRef.current = messages.length;
    if (!newMsgs.length || !graphRef.current) return;

    const now = Date.now();
    // Only react to messages sent in the last 15 s — filters out full_state history
    const fresh = newMsgs.filter((m) => now - m.timestamp < 15_000);
    if (!fresh.length) return;

    // Update timestamps immediately; emit particles in next frame so topology
    // rebuild (which runs after this effect due to declaration order) can add
    // any new DM edge before we try to find it.
    for (const msg of fresh) {
      lastMsgTimeRef.current.set(linkKey(msg), now);
      if (!msg.isDM) roomActivityRef.current.set(msg.to, now);
    }
    requestAnimationFrame(() => {
      if (!graphRef.current) return;
      const gd = graphRef.current.graphData?.() as
        | { links: GraphLink[] }
        | undefined;
      if (!gd) return;
      for (const msg of fresh) {
        const link = gd.links.find((l) => graphLinkKey(l) === linkKey(msg));
        if (link) {
          try {
            graphRef.current.emitParticle(link);
          } catch {
            /* not yet mounted */
          }
        }
      }
    });
  }, [messages]);

  const buildGraphData = useCallback(() => {
    const agentIds = new Set(agents.map((a) => a.id));
    const nodes: GraphNode[] = [
      ...agents.map((a) => ({
        id: a.id,
        kind: "agent" as const,
        label: a.name,
        data: a,
      })),
      ...rooms.map((r) => ({
        id: r.id,
        kind: "room" as const,
        label: r.name,
        data: r,
      })),
      ...panes.map((p) => ({
        id: `pane:${p.id}`,
        kind: "pane" as const,
        label: `${p.session} ${p.command}`,
        data: p,
      })),
    ];
    const links: GraphLink[] = [];

    for (const room of rooms) {
      for (const memberId of room.members) {
        if (agentIds.has(memberId)) {
          links.push({ source: room.id, target: memberId, kind: "membership" });
        }
      }
    }

    // DM edges — directed by last sender
    const dmLastMsg = new Map<string, MessageSnapshot>();
    for (const msg of messages) {
      if (!msg.isDM) continue;
      if (!agentIds.has(msg.from) || !agentIds.has(msg.to)) continue;
      const key = [msg.from, msg.to].sort().join(":");
      const prev = dmLastMsg.get(key);
      if (!prev || msg.timestamp > prev.timestamp) dmLastMsg.set(key, msg);
    }
    for (const msg of dmLastMsg.values()) {
      links.push({ source: msg.from, target: msg.to, kind: "dm" });
    }

    // Pane → agent edges (if matched by content scan)
    for (const pane of panes) {
      if (pane.agentId && agentIds.has(pane.agentId)) {
        links.push({
          source: `pane:${pane.id}`,
          target: pane.agentId,
          kind: "pane-agent",
        });
      }
    }

    // Pane adjacency edges — use tmux geometry to detect true horizontal/vertical splits
    const panesByWindow = new Map<string, PaneSnapshot[]>();
    for (const pane of panes) {
      const wKey = `${pane.session}:${pane.window}`;
      const list = panesByWindow.get(wKey) ?? [];
      list.push(pane);
      panesByWindow.set(wKey, list);
    }
    for (const siblings of panesByWindow.values()) {
      for (let i = 0; i < siblings.length; i++) {
        for (let j = i + 1; j < siblings.length; j++) {
          const a = siblings[i]!;
          const b = siblings[j]!;
          // Horizontal split: a's right edge touches b's left edge (or vice versa)
          const aRight = a.left + a.width;
          const bRight = b.left + b.width;
          const isHAdj =
            (Math.abs(aRight - b.left) <= 1 && overlapsV(a, b)) ||
            (Math.abs(bRight - a.left) <= 1 && overlapsV(a, b));
          // Vertical split: a's bottom edge touches b's top edge (or vice versa)
          const aBottom = a.top + a.height;
          const bBottom = b.top + b.height;
          const isVAdj =
            (Math.abs(aBottom - b.top) <= 1 && overlapsH(a, b)) ||
            (Math.abs(bBottom - a.top) <= 1 && overlapsH(a, b));
          if (isHAdj) {
            links.push({
              source: `pane:${a.id}`,
              target: `pane:${b.id}`,
              kind: "pane-h",
            });
          } else if (isVAdj) {
            links.push({
              source: `pane:${a.id}`,
              target: `pane:${b.id}`,
              kind: "pane-v",
            });
          }
        }
      }
    }

    return { nodes, links };
  }, [agents, rooms, panes, messages]);

  // Init graph once
  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new ForceGraph3D(containerRef.current)
      .backgroundColor("#000913")
      .nodeLabel("label")
      .nodeThreeObject((n: object) => {
        const node = n as GraphNode;
        if (node.kind === "room")
          return buildGlowNode(ROOM_COLOR, 6, false, undefined, node.id);
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

          // Activity indicator dot — top-right corner of the icon
          const dotMat = new THREE.MeshBasicMaterial({
            color: 0x00ff41,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const dotGlowMat = new THREE.MeshBasicMaterial({
            color: 0x00ff41,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.7, 8, 8),
            dotMat
          );
          const dotGlow = new THREE.Mesh(
            new THREE.SphereGeometry(1.4, 8, 8),
            dotGlowMat
          );
          dot.position.set(3.6, 3.6, 0.5);
          dotGlow.position.set(3.6, 3.6, 0.5);
          dotGlow.userData.paneActivityGlow = true;
          group.add(dotGlow);
          group.add(dot);

          const dotLight = new THREE.PointLight(0x00ff41, 0, 5);
          dotLight.position.set(3.6, 3.6, 1);
          group.add(dotLight);

          paneActivitySetters.current.set(pane.id, (lastActivity: number) => {
            const ago = (Date.now() - lastActivity) / 1000;
            const color = ago < 5 ? 0x00ff41 : ago < 30 ? 0xff8c00 : 0x334455;
            const opacity = ago < 5 ? 1.0 : ago < 30 ? 0.8 : 0.3;
            const c = new THREE.Color(color);
            dotMat.color.set(c);
            dotMat.opacity = opacity;
            dotGlowMat.color.set(c);
            dotGlowMat.opacity = ago < 5 ? 0.45 : ago < 30 ? 0.3 : 0.1;
            dotLight.color.set(c);
            dotLight.intensity = ago < 5 ? 2.0 : ago < 30 ? 1.0 : 0;
          });

          // Seed with current activity
          const ago0 = (Date.now() - pane.lastActivity) / 1000;
          const initColor =
            ago0 < 5 ? 0x00ff41 : ago0 < 30 ? 0xff8c00 : 0x334455;
          const initOpacity = ago0 < 5 ? 1.0 : ago0 < 30 ? 0.8 : 0.3;
          const ic = new THREE.Color(initColor);
          dotMat.color.set(ic);
          dotMat.opacity = initOpacity;
          dotGlowMat.color.set(ic);
          dotGlowMat.opacity = ago0 < 5 ? 0.45 : ago0 < 30 ? 0.3 : 0.1;
          dotLight.color.set(ic);
          dotLight.intensity = ago0 < 5 ? 2.0 : ago0 < 30 ? 1.0 : 0;

          return group;
        }
        const agent = node.data as AgentSnapshot;
        const hex = STATUS_GLOW[agent.status] ?? STATUS_GLOW["unknown"]!;
        const group = buildGlowNode(hex, 5, agent.status === "stale", agent.id);
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
        return group;
      })
      .linkColor((l: object) => {
        const kind = (l as GraphLink).kind;
        if (kind === "dm") return "rgba(123,111,255,0.5)";
        if (kind === "pane-agent") return "rgba(0,255,65,0.6)";
        if (kind === "pane-h") return "rgba(0,255,65,0.25)";
        if (kind === "pane-v") return "rgba(0,200,50,0.18)";
        return "rgba(0,212,255,0.25)";
      })
      .linkOpacity(0.7)
      .linkWidth((l: object) => {
        const kind = (l as GraphLink).kind;
        if (kind === "dm") return 0.8;
        if (kind === "pane-agent") return 0.6;
        if (kind === "pane-h" || kind === "pane-v") return 0.3;
        return 0.5;
      })
      .linkDirectionalParticles((l: object) => {
        const link = l as GraphLink;
        if (link.kind === "pane-h" || link.kind === "pane-v") return 0;
        if (link.kind === "pane-agent") return 1;
        const key = graphLinkKey(link);
        const lastTs = lastMsgTimeRef.current.get(key);
        const isActive = !!lastTs && Date.now() - lastTs < 30_000;
        if (link.kind === "dm") return isActive ? 6 : 1;
        // membership: ambient 1 particle, burst on activity
        return isActive ? 4 : 1;
      })
      .linkDirectionalParticleWidth((l: object) => {
        const kind = (l as GraphLink).kind;
        if (kind === "dm") return 2.0;
        if (kind === "pane-agent") return 0.8;
        return 1.2;
      })
      .linkDirectionalParticleColor((l: object) => {
        const kind = (l as GraphLink).kind;
        if (kind === "dm") return "#b090ff";
        if (kind === "pane-agent") return "#00ff41";
        return "#00d4ff";
      })
      .linkDirectionalParticleSpeed((l: object) => {
        const link = l as GraphLink;
        const key = graphLinkKey(link);
        const lastTs = lastMsgTimeRef.current.get(key);
        if (!lastTs)
          return link.kind === "dm"
            ? 0.0005
            : link.kind === "membership"
              ? 0.001
              : SPEED_BASE;
        const secAgo = (Date.now() - lastTs) / 1000;
        return SPEED_BASE + SPEED_BOOST * Math.exp(-SPEED_DECAY * secAgo);
      })
      .onNodeClick((n: object) => {
        const node = n as GraphNode;
        const now = Date.now();
        const last = lastClickRef.current;

        if (last?.id === node.id && now - last.time < 400) {
          lastClickRef.current = null;
          const dist = 60;
          const nx = node.x ?? 0,
            ny = node.y ?? 0,
            nz = node.z ?? 0;
          const mag = Math.hypot(nx, ny, nz) || 1;
          const ratio = 1 + dist / mag;
          graph.cameraPosition(
            { x: nx * ratio, y: ny * ratio, z: nz * ratio },
            { x: nx, y: ny, z: nz },
            1200
          );
        } else {
          lastClickRef.current = { id: node.id, time: now };
          if (node.kind === "pane") {
            setPaneSelection(node.id.replace(/^pane:/, ""));
          } else {
            setSelection({
              kind: node.kind === "room" ? "room" : "agent",
              id: node.id,
            });
          }
        }
      })
      .onLinkClick((l: object) => {
        const link = l as GraphLink;
        if (link.kind === "membership") {
          setSelection({ kind: "room", id: nodeId(link.source) });
        } else if (link.kind === "dm") {
          setSelection({ kind: "agent", id: nodeId(link.source) });
        }
      });

    // Stronger repulsion so nodes spread out and don't overlap
    graph.d3Force("charge")?.strength(-300);
    // Shorter link rest length so connected nodes stay in view
    graph.d3Force("link")?.distance((link: object) => {
      const l = link as GraphLink;
      if (l.kind === "membership") return 80;
      if (l.kind === "dm") return 60;
      return 40;
    });

    const scene = graph.scene();
    scene.add(new THREE.AmbientLight(0x001133, 0.5));
    scene.add(new THREE.HemisphereLight(0x002244, 0x000913, 0.4));

    graphRef.current = graph;
    return () => {
      graph._destructor?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stale node pulse
  useEffect(() => {
    const t0 = performance.now();
    let rafId: number;
    const tick = () => {
      if (graphRef.current) {
        const elapsed = (performance.now() - t0) / 1000;
        graphRef.current.scene().traverse((obj: THREE.Object3D) => {
          if (obj.userData?.pulseHalo) {
            (
              obj as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
            ).material.opacity =
              0.04 + Math.abs(Math.sin(elapsed * Math.PI * 1.5)) * 0.22;
          }
          if (obj.userData?.activityHalo) {
            const lastTs = roomActivityRef.current.get(
              obj.userData.activityHalo as string
            );
            const mesh = obj as THREE.Mesh<
              THREE.BufferGeometry,
              THREE.MeshBasicMaterial
            >;
            if (lastTs) {
              const secAgo = (performance.now() - lastTs) / 1000;
              // decaying ripple: sin wave * exponential envelope, ~4 s duration
              const ripple = Math.max(
                0,
                Math.sin(secAgo * Math.PI * 2.5) * Math.exp(-secAgo * 1.2)
              );
              mesh.material.opacity = 0.12 + ripple * 0.55;
            } else {
              mesh.material.opacity = 0.12;
            }
          }
          if (obj.userData?.selectionRing && obj.userData?.isSelected) {
            obj.rotation.z = elapsed * 1.4; // slow spin
            obj.rotation.x = Math.sin(elapsed * 0.7) * 0.4; // gentle tilt oscillation
          }
          if (obj.userData?.paneActivityGlow) {
            const mesh = obj as THREE.Mesh<
              THREE.BufferGeometry,
              THREE.MeshBasicMaterial
            >;
            // Pulse the glow only when recently active (green dot, < 5s)
            const baseOpacity = mesh.material.opacity;
            if (baseOpacity > 0.35) {
              mesh.material.opacity =
                0.3 + Math.abs(Math.sin(elapsed * Math.PI * 2)) * 0.2;
            }
          }
        });
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Push live activity timestamps to pane dots whenever panes update
  useEffect(() => {
    for (const pane of panes) {
      paneActivitySetters.current.get(pane.id)?.(pane.lastActivity);
    }
  }, [panes]);

  // Filter
  useEffect(() => {
    if (!graphRef.current) return;
    const filter = nameFilter.toLowerCase().trim();

    // Exact room match → room-scoped view: show only that room + its members
    const matchedRoom = filter
      ? rooms.find((r) => r.id.toLowerCase() === filter)
      : null;

    if (matchedRoom) {
      const memberSet = new Set(matchedRoom.members);
      // Also show pane nodes whose agentId belongs to a visible member
      const visiblePaneIds = new Set(
        panes
          .filter((p) => p.agentId && memberSet.has(p.agentId))
          .map((p) => `pane:${p.id}`)
      );
      graphRef.current
        .nodeVisibility((n: object) => {
          const node = n as GraphNode;
          return (
            node.id === matchedRoom.id ||
            memberSet.has(node.id) ||
            visiblePaneIds.has(node.id)
          );
        })
        .linkVisibility((l: object) => {
          const link = l as GraphLink;
          const src = nodeId(link.source as string | GraphNode);
          const tgt = nodeId(link.target as string | GraphNode);
          if (link.kind === "membership")
            return src === matchedRoom.id || tgt === matchedRoom.id;
          if (link.kind === "dm")
            return memberSet.has(src) && memberSet.has(tgt);
          // pane-agent link: show if the agent end is a member
          if (link.kind === "pane-agent")
            return memberSet.has(src) || memberSet.has(tgt);
          // pane split links: show if both pane ends are visible
          if (link.kind === "pane-h" || link.kind === "pane-v")
            return visiblePaneIds.has(src) && visiblePaneIds.has(tgt);
          return false;
        });
      return;
    }

    // Partial text filter
    graphRef.current
      .nodeVisibility((n: object) => {
        if (!filter) return true;
        return (n as GraphNode).label.toLowerCase().includes(filter);
      })
      .linkVisibility((l: object) => {
        if (!filter) return true;
        const link = l as GraphLink;
        const srcLabel =
          typeof link.source === "object"
            ? (link.source as GraphNode).label
            : link.source;
        const tgtLabel =
          typeof link.target === "object"
            ? (link.target as GraphNode).label
            : link.target;
        return (
          srcLabel.toLowerCase().includes(filter) ||
          tgtLabel.toLowerCase().includes(filter)
        );
      });
  }, [nameFilter, rooms, panes]);

  // Topology signature — only the structure that determines nodes/links, not status
  const topoSig = [
    agents
      .map((a) => a.id)
      .sort()
      .join(","),
    rooms
      .map((r) => `${r.id}:${[...r.members].sort().join("+")}`)
      .sort()
      .join(","),
    panes
      .map((p) => `${p.id}:${p.agentId ?? ""}`)
      .sort()
      .join(","),
    messages
      .filter((m) => m.isDM)
      .map((m) => `${m.from}→${m.to}`)
      .sort()
      .join(","),
  ].join("|");
  const topoSigRef = useRef("");

  // Rebuild graph only on structural changes — status changes skip this and go straight to applyNodeColors
  useEffect(() => {
    if (topoSig === topoSigRef.current) {
      applyNodeColors();
      return;
    }
    topoSigRef.current = topoSig;
    graphRef.current?.graphData(buildGraphData());
    requestAnimationFrame(applyNodeColors);
  }, [topoSig, buildGraphData, applyNodeColors]);

  const sidePanelWidthRef = useRef(sidePanelWidth);
  sidePanelWidthRef.current = sidePanelWidth;

  const fitToScreen = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.zoomToFit(800, 60);

    // After the fit animation settles, pan left so the panel doesn't obscure nodes
    const panelW = sidePanelWidthRef.current;
    if (panelW <= 0) return;
    setTimeout(() => {
      const g = graphRef.current;
      if (!g) return;
      const camera = g.camera() as THREE.PerspectiveCamera;
      const controls = g.controls() as { target: THREE.Vector3 };
      const dist = camera.position.distanceTo(controls.target);
      const canvasH = containerRef.current?.clientHeight ?? window.innerHeight;
      const worldPerPx =
        (2 * dist * Math.tan(((camera.fov * Math.PI) / 180) * 0.5)) / canvasH;
      const shift = (panelW / 2) * worldPerPx;

      const right = new THREE.Vector3()
        .crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up)
        .normalize()
        .multiplyScalar(-shift); // negative = shift view leftward

      g.cameraPosition(
        {
          x: camera.position.x + right.x,
          y: camera.position.y + right.y,
          z: camera.position.z + right.z,
        },
        {
          x: controls.target.x + right.x,
          y: controls.target.y + right.y,
          z: controls.target.z + right.z,
        },
        0
      );
    }, 850);
  }, []);

  return (
    <>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      <button
        onClick={fitToScreen}
        title="Fit all to screen"
        style={{
          position: "absolute",
          bottom: "20px",
          right: `${sidePanelWidth + 20}px`,
          width: "36px",
          height: "36px",
          background: "rgba(0,8,20,0.85)",
          border: "1px solid rgba(0,212,255,0.35)",
          borderRadius: "6px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(0,212,255,0.75)",
          fontSize: "16px",
          boxShadow: "0 0 12px rgba(0,212,255,0.15)",
          transition: "border-color 0.15s, color 0.15s, box-shadow 0.15s",
          zIndex: 10,
          backdropFilter: "blur(4px)",
        }}
        onMouseEnter={(e) => {
          const b = e.currentTarget;
          b.style.borderColor = "rgba(0,212,255,0.8)";
          b.style.color = "#00d4ff";
          b.style.boxShadow = "0 0 16px rgba(0,212,255,0.4)";
        }}
        onMouseLeave={(e) => {
          const b = e.currentTarget;
          b.style.borderColor = "rgba(0,212,255,0.35)";
          b.style.color = "rgba(0,212,255,0.75)";
          b.style.boxShadow = "0 0 12px rgba(0,212,255,0.15)";
        }}
      >
        ⊡
      </button>
    </>
  );
}
