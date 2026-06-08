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
  kind: "membership" | "dm" | "pane-agent" | "pane-sibling";
}

const STATUS_GLOW: Record<string, number> = {
  active: 0x00ff88,
  idle: 0xff8c00,
  stale: 0xff3333,
  unknown: 0x334466,
};

const ROOM_COLOR = 0x7b6fff;
const PANE_COLOR = 0x00ff41; // classic terminal green

const SPEED_BASE = 0.0008;
const SPEED_BOOST = 0.014;
const SPEED_DECAY = 0.12;

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
  agentId?: string
): THREE.Group {
  const group = new THREE.Group();

  const coreMat = new THREE.MeshPhongMaterial({
    color: hexColor,
    emissive: hexColor,
    emissiveIntensity: 0.9,
    shininess: 120,
  });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 20), coreMat));

  const halo1Mat = new THREE.MeshBasicMaterial({
    color: hexColor,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(
    new THREE.Mesh(new THREE.SphereGeometry(radius * 1.7, 16, 16), halo1Mat)
  );

  const halo2Mat = new THREE.MeshBasicMaterial({
    color: hexColor,
    transparent: true,
    opacity: 0.07,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const halo2 = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 2.8, 12, 12),
    halo2Mat
  );
  if (pulse) halo2.userData.pulseHalo = true;
  group.add(halo2);

  const light = new THREE.PointLight(hexColor, 1.5, radius * 8);
  group.add(light);

  if (agentId) {
    group.userData.agentId = agentId;
    // Called when agent status changes — updates all materials in-place
    group.userData.setColor = (hex: number, isPulse: boolean) => {
      const c = new THREE.Color(hex);
      coreMat.color.set(c);
      coreMat.emissive.set(c);
      halo1Mat.color.set(c);
      halo2Mat.color.set(c);
      light.color.set(c);
      halo2.userData.pulseHalo = isPulse;
    };
  }

  return group;
}

function nodeId(n: string | GraphNode): string {
  return typeof n === "object" ? n.id : n;
}

export function Graph3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);
  const lastMsgTimeRef = useRef<Map<string, number>>(new Map());
  const prevMsgLenRef = useRef(0);
  // Direct registry of agent id → color/pulse setter — avoids relying on scene traversal
  const colorSetters = useRef<
    Map<string, (hex: number, pulse: boolean) => void>
  >(new Map());
  // Registry of raw pane id → selection indicator setter
  const paneSelSetters = useRef<Map<string, (selected: boolean) => void>>(
    new Map()
  );

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

  // Track last message timestamp per link for speed decay
  useEffect(() => {
    const newMsgs = messages.slice(prevMsgLenRef.current);
    prevMsgLenRef.current = messages.length;
    for (const msg of newMsgs) {
      lastMsgTimeRef.current.set(linkKey(msg), msg.timestamp);
    }
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
        links.push({ source: room.id, target: memberId, kind: "membership" });
      }
    }

    // DM edges — directed by last sender
    const dmLastMsg = new Map<string, MessageSnapshot>();
    for (const msg of messages) {
      if (!msg.isDM) continue;
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

    // Same-window sibling edges — group panes that share session:window
    const panesByWindow = new Map<string, string[]>();
    for (const pane of panes) {
      const wKey = `${pane.session}:${pane.window}`;
      const list = panesByWindow.get(wKey) ?? [];
      list.push(`pane:${pane.id}`);
      panesByWindow.set(wKey, list);
    }
    for (const siblings of panesByWindow.values()) {
      // Chain: 0→1→2→… (avoids N² edges in a window with many panes)
      for (let i = 1; i < siblings.length; i++) {
        links.push({
          source: siblings[i - 1]!,
          target: siblings[i]!,
          kind: "pane-sibling",
        });
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
        if (node.kind === "room") return buildGlowNode(ROOM_COLOR, 6);
        if (node.kind === "pane") {
          const pane = node.data as PaneSnapshot;
          const group = buildGlowNode(PANE_COLOR, 3.5);

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

          return group;
        }
        const agent = node.data as AgentSnapshot;
        const hex = STATUS_GLOW[agent.status] ?? STATUS_GLOW["unknown"]!;
        const group = buildGlowNode(hex, 5, agent.status === "stale", agent.id);
        // Register the color setter so applyNodeColors can reach it without scene traversal
        if (group.userData.setColor) {
          colorSetters.current.set(
            agent.id,
            group.userData.setColor as (hex: number, pulse: boolean) => void
          );
        }
        return group;
      })
      .linkColor((l: object) => {
        const kind = (l as GraphLink).kind;
        if (kind === "dm") return "rgba(123,111,255,0.5)";
        if (kind === "pane-agent") return "rgba(0,255,65,0.6)";
        if (kind === "pane-sibling") return "rgba(0,255,65,0.2)";
        return "rgba(0,212,255,0.25)";
      })
      .linkOpacity(0.7)
      .linkWidth((l: object) => {
        const kind = (l as GraphLink).kind;
        if (kind === "dm") return 0.8;
        if (kind === "pane-agent") return 0.6;
        if (kind === "pane-sibling") return 0.3;
        return 0.5;
      })
      .linkDirectionalParticles((l: object) => {
        const kind = (l as GraphLink).kind;
        return kind === "pane-sibling" ? 0 : 2;
      })
      .linkDirectionalParticleWidth(0.8)
      .linkDirectionalParticleColor((l: object) => {
        const kind = (l as GraphLink).kind;
        if (kind === "dm") return "#7b6fff";
        if (kind === "pane-agent") return "#00ff41";
        return "#00d4ff";
      })
      .linkDirectionalParticleSpeed((l: object) => {
        const key = graphLinkKey(l as GraphLink);
        const lastTs = lastMsgTimeRef.current.get(key);
        if (!lastTs) return SPEED_BASE;
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
          if (obj.userData?.selectionRing && obj.userData?.isSelected) {
            obj.rotation.z = elapsed * 1.4; // slow spin
            obj.rotation.x = Math.sin(elapsed * 0.7) * 0.4; // gentle tilt oscillation
          }
        });
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Filter
  useEffect(() => {
    if (!graphRef.current) return;
    const filter = nameFilter.toLowerCase();
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
  }, [nameFilter]);

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

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
