import { useEffect, useRef, useCallback, useState } from "react";
import ForceGraph3D, { type ForceGraph3DInstance } from "3d-force-graph";
import * as THREE from "three";
import { useBusStore } from "../store/bus.js";
import { NodeRadialMenu } from "./NodeRadialMenu.js";
import type {
  AgentSnapshot,
  RoomSnapshot,
  MessageSnapshot,
  PaneSnapshot,
  ProjectBacklog,
} from "@coord-ui/shared";

type NodeType = "agent" | "room" | "pane" | "backlog";

interface GraphNode {
  id: string;
  kind: NodeType;
  label: string;
  data: AgentSnapshot | RoomSnapshot | PaneSnapshot | ProjectBacklog;
  x?: number;
  y?: number;
  z?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  kind:
    | "membership"
    | "dm"
    | "pane-agent"
    | "pane-h"
    | "pane-v"
    | "backlog-agent";
}

const STATUS_GLOW: Record<string, number> = {
  active: 0x00ff88,
  idle: 0xff8c00,
  stale: 0xff8c00, // stale = effectively idle — same colour, no alarm
  unknown: 0x334466,
};

const ROOM_COLOR = 0x7b6fff;
const BACKLOG_COLOR = 0xffaa00; // amber — distinct from agent/room
const COORDINATOR_ACCENT = 0xffd166; // command accent; status glow remains separate

const SPEED_BASE = 0.004;
const SPEED_BOOST = 0.04;
const SPEED_DECAY = 0.15;

// How long an agent stays lit "active" green after a message (the agent "blink").
const RECENT_MSG_MS = 10_000;
// How long a message edge shows flowing directional particles (the chat "blink").
const EDGE_ACTIVE_MS = 8_000;
// Exponential decay constant (s) for the post-message brightness glow — the
// glow fades as e^(−secAgo/TAU) so the freshest message node is the brightest.
const ACTIVITY_GLOW_TAU = 2.5;

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

// Shared ring texture for radio-wave sprites — created once, reused per pane
let _ringTex: THREE.Texture | null = null;
function getRingTexture(): THREE.Texture {
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

function isCoordinatorAgent(agent: AgentSnapshot): boolean {
  const role = agent.metadata?.role;
  if (typeof role === "string") {
    return role.toLowerCase() === "coordinator";
  }

  return /(^coord|-coordinator$)/i.test(agent.name);
}

function addCoordinatorMarker(group: THREE.Group): void {
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

function nodeId(n: string | GraphNode): string {
  return typeof n === "object" ? n.id : n;
}

function makeTextSprite(
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
  const savedCameraRef = useRef<{
    pos: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string;
    kind: "agent" | "room";
    node3D: { x: number; y: number; z: number };
  } | null>(null);
  const lastMsgTimeRef = useRef<Map<string, number>>(new Map());
  // unix ms of last message per room id — drives halo ripple
  const roomActivityRef = useRef<Map<string, number>>(new Map());
  // unix ms of last message per agent id — drives burst rings
  const agentMsgTimestampRef = useRef<Map<string, number>>(new Map());
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
  const agentLabelSetters = useRef<Map<string, (visible: boolean) => void>>(
    new Map()
  );
  const nodeDimSetters = useRef<Map<string, (dimmed: boolean) => void>>(
    new Map()
  );
  const focusedNodeRef = useRef<string | null>(null);
  const refreshLinksRef = useRef<() => void>(() => {});
  // Persistent node-object cache keyed by id. d3-force stores layout state
  // (x/y/z/vx/vy/vz) directly on the node objects, so we MUST hand it the same
  // object across rebuilds or every update resets all positions to the origin.
  const nodeCacheRef = useRef<Map<string, GraphNode>>(new Map());
  const paneWaveState = useRef<
    Map<string, { color: number; period: number; visible: boolean }>
  >(new Map());

  const agentsMap = useBusStore((s) => s.agents);
  const roomsMap = useBusStore((s) => s.rooms);
  const panesMap = useBusStore((s) => s.panes);
  const messages = useBusStore((s) => s.messages);
  const nameFilter = useBusStore((s) => s.nameFilter);
  const paneSelection = useBusStore((s) => s.paneSelection);
  const backlogs = useBusStore((s) => s.backlogs);
  const fetchBacklogs = useBusStore((s) => s.fetchBacklogs);
  const setOpenBacklogProject = useBusStore((s) => s.setOpenBacklogProject);
  const agents = Object.values(agentsMap);
  const rooms = Object.values(roomsMap);
  const panes = Object.values(panesMap);
  const setSelection = useBusStore((s) => s.setSelection);
  const setPaneSelection = useBusStore((s) => s.setPaneSelection);
  const hoveredAgentId = useBusStore((s) => s.hoveredAgentId);
  const sidePanelWidth = useBusStore((s) => s.sidePanelWidth);
  const notificationPopup = useBusStore((s) => s.notificationPopup);
  const setNotificationOrigin = useBusStore((s) => s.setNotificationOrigin);

  // Fetch backlogs on mount and every 30 s so graph nodes stay in sync with running agents
  useEffect(() => {
    void fetchBacklogs();
    const interval = setInterval(() => {
      void fetchBacklogs();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchBacklogs]);

  // Always-current refs so color updater doesn't need store values as deps
  const agentsMapRef = useRef(agentsMap);
  agentsMapRef.current = agentsMap;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const applyNodeColors = useCallback(() => {
    // Build a per-agent latest-message timestamp map once per call
    const lastMsgAt = new Map<string, number>();
    for (const m of messagesRef.current) {
      const prev = lastMsgAt.get(m.from) ?? 0;
      if (m.timestamp > prev) lastMsgAt.set(m.from, m.timestamp);
    }
    const now = Date.now();
    for (const [id, setColor] of colorSetters.current) {
      const agent = agentsMapRef.current[id];
      if (!agent) continue;
      // Treat recent message activity as active regardless of status
      const recentMessage = (lastMsgAt.get(id) ?? 0) > now - RECENT_MSG_MS;
      const effectiveStatus = recentMessage ? "active" : agent.status;
      const hex = STATUS_GLOW[effectiveStatus] ?? STATUS_GLOW["unknown"]!;
      setColor(hex, effectiveStatus === "stale");
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

  // Resolve the active loud notification's sender node into viewport pixels.
  // NotificationLayer falls back to its center entry when this read-only lookup
  // cannot resolve a stable on-screen coordinate.
  useEffect(() => {
    if (!notificationPopup || notificationPopup.priority !== "loud") return;

    const popupId = notificationPopup.id;
    const senderId = notificationPopup.from;
    const rafId = requestAnimationFrame(() => {
      const graph = graphRef.current;
      const container = containerRef.current;
      if (!graph || !container) {
        setNotificationOrigin(popupId, null);
        return;
      }

      try {
        const gd = graph.graphData?.() as { nodes: GraphNode[] } | undefined;
        const node = gd?.nodes.find(
          (candidate) => candidate.kind === "agent" && candidate.id === senderId
        );
        if (!node || node.x == null) {
          setNotificationOrigin(popupId, null);
          return;
        }

        const coords = graph.graph2ScreenCoords(
          node.x,
          node.y ?? 0,
          node.z ?? 0
        ) as { x: number; y: number };
        const rect = container.getBoundingClientRect();
        const x = rect.left + coords.x;
        const y = rect.top + coords.y;
        const margin = 32;

        if (
          !Number.isFinite(x) ||
          !Number.isFinite(y) ||
          x < rect.left - margin ||
          x > rect.right + margin ||
          y < rect.top - margin ||
          y > rect.bottom + margin
        ) {
          setNotificationOrigin(popupId, null);
          return;
        }

        setNotificationOrigin(popupId, { x, y });
      } catch {
        setNotificationOrigin(popupId, null);
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [
    notificationPopup?.from,
    notificationPopup?.id,
    notificationPopup?.priority,
    setNotificationOrigin,
  ]);

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
      agentMsgTimestampRef.current.set(msg.from, now);
      if (msg.isDM && msg.to) agentMsgTimestampRef.current.set(msg.to, now);
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

    // Reuse the cached node object for an id if it exists so d3 keeps its
    // simulation state; only mutate the fields that can change.
    const cache = nodeCacheRef.current;
    const upsert = (
      id: string,
      kind: NodeType,
      label: string,
      data: GraphNode["data"]
    ): GraphNode => {
      const existing = cache.get(id);
      if (existing) {
        existing.label = label;
        existing.data = data;
        return existing;
      }
      const fresh: GraphNode = { id, kind, label, data };
      cache.set(id, fresh);
      return fresh;
    };

    const nodes: GraphNode[] = [
      ...agents.map((a) => upsert(a.id, "agent", a.name, a)),
      ...rooms.map((r) => upsert(r.id, "room", r.name, r)),
      ...panes
        .filter((p) => p.agentId && agentIds.has(p.agentId))
        .map((p) =>
          upsert(`pane:${p.id}`, "pane", `${p.session} ${p.command}`, p)
        ),
      ...backlogs.map((b) => {
        const shortName =
          b.project.split("/").filter(Boolean).pop() ?? b.project;
        return upsert(`backlog:${b.project}`, "backlog", shortName, b);
      }),
    ];

    // Drop cached objects for ids no longer present so the cache can't grow
    // unbounded as agents/panes come and go.
    const liveIds = new Set(nodes.map((n) => n.id));
    for (const id of cache.keys()) {
      if (!liveIds.has(id)) cache.delete(id);
    }
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

    // Backlog → agent edges (agents whose pane cwd resolves to this repo root)
    for (const backlog of backlogs) {
      for (const agentId of backlog.agentIds ?? []) {
        if (agentIds.has(agentId)) {
          links.push({
            source: `backlog:${backlog.project}`,
            target: agentId,
            kind: "backlog-agent",
          });
        }
      }
    }

    // Guard: drop any link whose endpoints aren't both present as nodes.
    // Pane nodes are filtered (only panes matched to a live agent are added),
    // but pane-adjacency links are generated for every pane in a window — so a
    // sibling pane that was filtered out leaves a dangling link. d3's link
    // force THROWS on a missing node id, which aborts the whole simulation tick
    // and freezes the layout collapsed at the origin (the "pileup"). Filtering
    // here guarantees a consistent graph no matter how links were generated.
    const nodeIds = new Set(nodes.map((n) => n.id));
    const safeLinks = links.filter(
      (l) => nodeIds.has(nodeId(l.source)) && nodeIds.has(nodeId(l.target))
    );

    return { nodes, links: safeLinks };
  }, [agents, rooms, panes, messages, backlogs]);

  // Force layout. Two concerns, solved independently:
  //   1) SPACING — moderate charge + link distance so connected nodes sit close
  //      but the glow halos (~20 units) don't overlap into a blob.
  //   2) CONTAINMENT — unlinked nodes (e.g. empty rooms with no members) feel
  //      only repulsion and drift to the edge of the world; the default center
  //      force only recenters the centroid, never an individual node. A soft
  //      spherical boundary fixes this WITHOUT collapsing clusters: it is zero
  //      inside BOUND_R and only pulls a node back once it strays past it, so
  //      the inner cluster (which lives well inside BOUND_R) is untouched. This
  //      is the key difference from a global gravity, which crushed everything.
  const BOUND_R = 170;
  const applyForceConfig = useCallback((graph: ForceGraph3DInstance) => {
    graph.d3Force("charge")?.strength(-150);
    graph.d3Force("link")?.distance((link: object) => {
      const l = link as GraphLink;
      return l.kind === "dm" ? 60 : 45;
    });

    const boundary = (alpha: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodes: any[] = (graph.graphData() as any).nodes ?? [];
      for (const n of nodes) {
        const x = n.x ?? 0,
          y = n.y ?? 0,
          z = n.z ?? 0;
        const d = Math.hypot(x, y, z);
        if (d > BOUND_R) {
          // Pull back proportionally to how far past the boundary it is.
          const pull = (alpha * 0.25 * (d - BOUND_R)) / d;
          n.vx = (n.vx ?? 0) - x * pull;
          n.vy = (n.vy ?? 0) - y * pull;
          n.vz = (n.vz ?? 0) - z * pull;
        }
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    graph.d3Force("boundary", boundary as any);
  }, []);

  // Init graph once
  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new ForceGraph3D(containerRef.current)
      // Transparent so the NexusOverlay rings/plasma show THROUGH from behind;
      // the app root provides the dark #000913 backdrop.
      .backgroundColor("rgba(0,0,0,0)")
      .nodeLabel("label")
      .nodeThreeObject((n: object) => {
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
          group.add(
            new THREE.Mesh(new THREE.SphereGeometry(8, 10, 10), glowMat)
          );

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
      })
      .linkColor((l: object) => {
        const link = l as GraphLink;
        const focused = focusedNodeRef.current;
        if (focused) {
          const src = nodeId(link.source as string | GraphNode);
          const tgt = nodeId(link.target as string | GraphNode);
          if (src !== focused && tgt !== focused)
            return "rgba(255,255,255,0.04)";
          // Connected edge — boost color
          if (link.kind === "dm") return "rgba(176,144,255,1.0)";
          if (link.kind === "pane-agent") return "rgba(0,255,65,1.0)";
          return "rgba(0,212,255,0.9)";
        }
        const kind = link.kind;
        if (kind === "dm") return "rgba(123,111,255,0.5)";
        if (kind === "pane-agent") return "rgba(0,255,65,0.6)";
        if (kind === "pane-h") return "rgba(0,255,65,0.25)";
        if (kind === "pane-v") return "rgba(0,200,50,0.18)";
        if (kind === "backlog-agent") return "rgba(255,170,0,0.3)";
        return "rgba(0,212,255,0.25)";
      })
      .linkOpacity(1.0)
      .linkWidth((l: object) => {
        const kind = (l as GraphLink).kind;
        if (kind === "dm") return 0.8;
        if (kind === "pane-agent") return 0.6;
        if (kind === "pane-h" || kind === "pane-v") return 0.3;
        if (kind === "backlog-agent") return 0.4;
        return 0.5;
      })
      .linkDirectionalParticles((l: object) => {
        const link = l as GraphLink;
        if (link.kind === "pane-h" || link.kind === "pane-v") return 0;
        if (link.kind === "backlog-agent") return 0;
        if (link.kind === "pane-agent") return 1;
        const key = graphLinkKey(link);
        const lastTs = lastMsgTimeRef.current.get(key);
        const isActive = !!lastTs && Date.now() - lastTs < EDGE_ACTIVE_MS;
        if (link.kind === "dm") return isActive ? 6 : 0;
        return isActive ? 4 : 0;
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
          // Snapshot current camera before zoom so we can restore on menu close
          const cam = graph.camera() as THREE.PerspectiveCamera;
          const ctrl = graph.controls() as { target: THREE.Vector3 };
          savedCameraRef.current = {
            pos: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
            target: { x: ctrl.target.x, y: ctrl.target.y, z: ctrl.target.z },
          };
          const dist = 120;
          const nx = node.x ?? 0,
            ny = node.y ?? 0,
            nz = node.z ?? 0;
          const mag = Math.hypot(nx, ny, nz) || 1;
          const ratio = 1 + dist / mag;
          graph.cameraPosition(
            { x: nx * ratio, y: ny * ratio, z: nz * ratio },
            { x: nx, y: ny, z: nz },
            600
          );
          // Focus lock — dim all other nodes + highlight direct edges
          focusedNodeRef.current = node.id;
          for (const [id, setDimmed] of nodeDimSetters.current) {
            setDimmed(id !== node.id);
          }
          refreshLinksRef.current();
          // For backlog nodes: single-click opens the panel; double-click also opens it
          if (node.kind === "backlog") {
            setOpenBacklogProject((node.data as ProjectBacklog).project);
          }
          // Open radial context menu (only for agent/room nodes)
          if (node.kind === "agent" || node.kind === "room") {
            setContextMenu({
              nodeId: node.id,
              kind: node.kind,
              node3D: { x: nx, y: ny, z: nz },
            });
          }
        } else {
          lastClickRef.current = { id: node.id, time: now };
          if (node.kind === "pane") {
            setPaneSelection(node.id.replace(/^pane:/, ""));
          } else if (node.kind === "backlog") {
            setOpenBacklogProject((node.data as ProjectBacklog).project);
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
      })
      .onBackgroundClick(() => {
        if (focusedNodeRef.current === null) return;
        focusedNodeRef.current = null;
        for (const setDimmed of nodeDimSetters.current.values())
          setDimmed(false);
        refreshLinksRef.current();
        setContextMenu(null);
        if (savedCameraRef.current) {
          const { pos, target } = savedCameraRef.current;
          graph.cameraPosition(pos, target, 600);
          savedCameraRef.current = null;
        }
      });

    applyForceConfig(graph);

    const scene = graph.scene();
    scene.add(new THREE.AmbientLight(0x001133, 0.5));
    scene.add(new THREE.HemisphereLight(0x002244, 0x000913, 0.4));

    // Holographic grid floor — faint cyan wireframe plane. Rendered behind the
    // nodes (renderOrder -1, depth test/write off) so it reads as a background
    // plane instead of slicing through the node cluster, which spans the grid's
    // y level.
    const sendToBack = (g: THREE.GridHelper) => {
      const m = g.material as THREE.Material;
      m.transparent = true;
      m.depthTest = false;
      m.depthWrite = false;
      g.renderOrder = -1;
    };

    const grid = new THREE.GridHelper(800, 32, 0x003344, 0x001a2a);
    grid.position.y = -120;
    sendToBack(grid);
    (grid.material as THREE.Material).opacity = 0.35;
    scene.add(grid);

    // Second finer grid for depth
    const gridFine = new THREE.GridHelper(800, 80, 0x001a33, 0x000d1a);
    gridFine.position.y = -120;
    sendToBack(gridFine);
    (gridFine.material as THREE.Material).opacity = 0.2;
    scene.add(gridFine);

    // Store refresh fn — re-passes linkColor to trigger a link re-render pass
    refreshLinksRef.current = () => {
      graph.linkColor(graph.linkColor());
    };

    // Auto-fit the camera the first time the layout settles, so the graph is
    // always framed on load regardless of its world size. Guarded so it fires
    // only once and never yanks the camera while the user is navigating.
    let didInitialFit = false;
    graph.onEngineStop(() => {
      if (didInitialFit) return;
      const nodeCount = (graph.graphData() as unknown as { nodes: GraphNode[] })
        .nodes.length;
      if (nodeCount === 0) return;
      didInitialFit = true;
      graph.zoomToFit(700, 80);
    });

    graphRef.current = graph;
    return () => {
      graph._destructor?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyForceConfig]);

  // Escape releases focus lock and closes context menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const hadMenu = contextMenu !== null;
      setContextMenu(null);
      if (focusedNodeRef.current !== null) {
        focusedNodeRef.current = null;
        for (const setDimmed of nodeDimSetters.current.values())
          setDimmed(false);
        refreshLinksRef.current();
      }
      if (hadMenu && savedCameraRef.current && graphRef.current) {
        const { pos, target } = savedCameraRef.current;

        graphRef.current.cameraPosition(pos, target, 600);
        savedCameraRef.current = null;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contextMenu]);

  // Stale node pulse
  useEffect(() => {
    const t0 = performance.now();
    let rafId: number;
    const tick = () => {
      if (graphRef.current) {
        const elapsed = (performance.now() - t0) / 1000;

        // Toggle agent labels + pane group labels based on camera proximity
        const camera = graphRef.current.camera() as THREE.PerspectiveCamera;
        const controls = graphRef.current.controls() as {
          target: THREE.Vector3;
        };
        const camDist = camera.position.distanceTo(controls.target);
        const showAgentLabels = camDist < 650;
        for (const setter of agentLabelSetters.current.values()) {
          setter(showAgentLabels);
        }
        // Show session group labels only when fairly close (zoomed in)
        const showGroupLabels = camDist < 400;
        graphRef.current.scene().traverse((obj: THREE.Object3D) => {
          if (obj.userData?.groupLabel) {
            obj.visible = showGroupLabels;
          }
        });

        graphRef.current.scene().traverse((obj: THREE.Object3D) => {
          // Decaying activity glow — brightest right after a message, fading
          // over the recency window so the most-recently-active node stands out.
          if (obj.userData?.setActivityGlow && obj.userData?.agentId) {
            const lastTs = agentMsgTimestampRef.current.get(
              obj.userData.agentId as string
            );
            let level = 0;
            if (lastTs) {
              const secAgo = (performance.now() - lastTs) / 1000;
              if (secAgo < RECENT_MSG_MS / 1000) {
                level = Math.exp(-secAgo / ACTIVITY_GLOW_TAU);
              }
            }
            (obj.userData.setActivityGlow as (n: number) => void)(
              level < 0.02 ? 0 : level
            );
          }
          if (obj.userData?.pulseHalo) {
            // Gentle slow fade — stale is idle, not an alarm
            (
              obj as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
            ).material.opacity =
              0.06 + Math.abs(Math.sin(elapsed * Math.PI * 0.2)) * 0.14;
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
          if (obj.userData?.agentRingWave) {
            const wave = obj as THREE.Sprite;
            const lastTs = agentMsgTimestampRef.current.get(
              obj.userData.agentId as string
            );
            const BURST_DURATION = 2.5; // seconds a burst lasts
            const PERIOD = 1.2;
            if (
              !lastTs ||
              (performance.now() - lastTs) / 1000 > BURST_DURATION
            ) {
              wave.material.opacity = 0;
            } else {
              const secAgo = (performance.now() - lastTs) / 1000;
              const phase =
                ((secAgo + (obj.userData.phaseOffset as number) * PERIOD) %
                  PERIOD) /
                PERIOD;
              const s = 10 + phase * 28;
              wave.scale.set(s, s, 1);
              const envelope = Math.max(0, 1 - secAgo / BURST_DURATION);
              wave.material.opacity = Math.max(0, (1 - phase) * 0.6 * envelope);
            }
          }
          if (obj.userData?.radioWave) {
            const wave = obj as THREE.Sprite;
            const state = paneWaveState.current.get(
              obj.userData.paneId as string
            );
            if (!state?.visible) {
              wave.material.opacity = 0;
              return;
            }
            const phase =
              ((elapsed + (obj.userData.phaseOffset as number) * state.period) %
                state.period) /
              state.period; // 0 → 1
            const s = 8 + phase * 18; // expand 8 → 26 world units
            wave.scale.set(s, s, 1);
            wave.material.opacity = Math.max(0, (1 - phase) * 0.55);
            wave.material.color.setHex(state.color);
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
          if (link.kind === "backlog-agent") return memberSet.has(tgt);
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

  // Re-colour nodes when messages arrive (recent activity implies active status)
  useEffect(() => {
    applyNodeColors();
  }, [messages.length, applyNodeColors]);

  // Push graph data only when the STRUCTURE changes (nodes/edges added or
  // removed). buildGraphData re-runs on every message (DM edges depend on
  // messages), and each graphData() call reheats the d3 simulation to full
  // alpha. Reheating on every chat message never lets the layout cool, so it
  // drifts apart or collapses over time. Gating on a structural signature lets
  // the simulation settle and stay put during pure chat activity.
  const structSigRef = useRef("");
  useEffect(() => {
    const data = buildGraphData();
    const sig =
      data.nodes
        .map((n) => n.id)
        .sort()
        .join(",") +
      "|" +
      data.links
        .map((l) => graphLinkKey(l))
        .sort()
        .join(",");
    if (sig !== structSigRef.current) {
      structSigRef.current = sig;
      graphRef.current?.graphData(data);
    }
    requestAnimationFrame(applyNodeColors);
  }, [buildGraphData, applyNodeColors]);

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

  const closeMenuAndRestore = useCallback(() => {
    setContextMenu(null);
    if (savedCameraRef.current && graphRef.current) {
      const { pos, target } = savedCameraRef.current;

      graphRef.current.cameraPosition(pos, target, 600);
      savedCameraRef.current = null;
    }
    // Release focus lock
    focusedNodeRef.current = null;
    for (const setDimmed of nodeDimSetters.current.values()) setDimmed(false);
    refreshLinksRef.current();
  }, []);

  // Close menu but keep camera zoomed + dim state active.
  // savedCameraRef stays intact so background click / Escape can still restore.
  const isolateAndClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
      />
      {contextMenu && (
        <NodeRadialMenu
          nodeId={contextMenu.nodeId}
          kind={contextMenu.kind}
          node3D={contextMenu.node3D}
          graphRef={graphRef}
          onClose={closeMenuAndRestore}
          onIsolate={isolateAndClose}
        />
      )}
      {/* Circular icon row — action buttons */}
      <div
        style={{
          position: "absolute",
          bottom: "52px",
          right: `${sidePanelWidth + 16}px`,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          zIndex: 10,
        }}
      >
        <CircleBtn onClick={fitToScreen} title="Fit to screen" icon="⊡" />
        <CircleBtn
          onClick={() => {
            if (!graphRef.current) return;
            graphRef.current.cameraPosition(
              { x: 0, y: 0, z: 300 },
              { x: 0, y: 0, z: 0 },
              800
            );
          }}
          title="Reset camera"
          icon="◎"
        />
        <CircleBtn
          onClick={() => {
            if (!graphRef.current) return;
            // Release any active focus lock
            focusedNodeRef.current = null;
            for (const setDimmed of nodeDimSetters.current.values())
              setDimmed(false);
            refreshLinksRef.current();
          }}
          title="Clear focus"
          icon="✕"
        />
      </div>
    </>
  );
}

function CircleBtn({
  onClick,
  title,
  icon,
}: {
  onClick: () => void;
  title: string;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: "38px",
        height: "38px",
        borderRadius: "50%",
        background: "rgba(0,8,20,0.85)",
        border: "1px solid rgba(0,212,255,0.35)",
        boxShadow:
          "0 0 10px rgba(0,212,255,0.12), inset 0 0 8px rgba(0,212,255,0.04)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(0,212,255,0.7)",
        fontSize: "15px",
        backdropFilter: "blur(6px)",
        transition: "border-color 0.15s, box-shadow 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        const b = e.currentTarget;
        b.style.borderColor = "rgba(0,212,255,0.85)";
        b.style.boxShadow =
          "0 0 18px rgba(0,212,255,0.45), inset 0 0 10px rgba(0,212,255,0.1)";
        b.style.color = "#00d4ff";
      }}
      onMouseLeave={(e) => {
        const b = e.currentTarget;
        b.style.borderColor = "rgba(0,212,255,0.35)";
        b.style.boxShadow =
          "0 0 10px rgba(0,212,255,0.12), inset 0 0 8px rgba(0,212,255,0.04)";
        b.style.color = "rgba(0,212,255,0.7)";
      }}
    >
      {icon}
    </button>
  );
}
