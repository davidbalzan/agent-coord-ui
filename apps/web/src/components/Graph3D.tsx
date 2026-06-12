import { useEffect, useRef, useCallback, useState } from "react";
import ForceGraph3D from "3d-force-graph";
import * as THREE from "three";
import { useBusStore } from "../store/bus.js";
import { NodeRadialMenu } from "./NodeRadialMenu.js";
import {
  buildGraphData as buildGraphDataModel,
  graphLinkKey,
  linkKey,
  nodeId,
  type GraphLink,
  type GraphNode,
} from "./graph/backlogNodes.js";
import { STATUS_GLOW, createNodeThreeObject } from "./graph/buildGlowNode.js";
import { startGraphAnimationLoop } from "./graph/animationLoop.js";
import { applyForceConfig } from "./graph/forces.js";
import { setXrGraphHandle } from "../xr/graphHandle.js";
import type { XrGraphHandle } from "../xr/enterXr.js";
import {
  closeMenuAndRestore as closeGraphMenuAndRestore,
  createBackgroundClickHandler,
  createEscapeFocusHandler,
  createLinkClickHandler,
  createNodeClickHandler,
  fitToScreen as fitGraphToScreen,
  releaseFocusLock,
  type ContextMenuState,
} from "./graph/interactions.js";

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

export function Graph3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);
  const savedCameraRef = useRef<{
    pos: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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

    // Update timestamps immediately; emit particles on the next macrotask so
    // topology rebuild (which runs after this effect due to declaration order)
    // can add any new DM edge before we try to find it. setTimeout rather than
    // rAF so emission still fires while an immersive XR session is presenting
    // (window rAF can be throttled then); both run after all effects commit.
    for (const msg of fresh) {
      lastMsgTimeRef.current.set(linkKey(msg), now);
      if (!msg.isDM) roomActivityRef.current.set(msg.to, now);
      agentMsgTimestampRef.current.set(msg.from, now);
      if (msg.isDM && msg.to) agentMsgTimestampRef.current.set(msg.to, now);
    }
    setTimeout(() => {
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
    }, 0);
  }, [messages]);

  const buildGraphData = useCallback(() => {
    return buildGraphDataModel({
      agents,
      rooms,
      panes,
      messages,
      backlogs,
      cache: nodeCacheRef.current,
    });
  }, [agents, rooms, panes, messages, backlogs]);

  // Init graph once
  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new ForceGraph3D(containerRef.current)
      // Transparent so the NexusOverlay rings/plasma show THROUGH from behind;
      // the app root provides the dark #000913 backdrop.
      .backgroundColor("rgba(0,0,0,0)")
      .nodeLabel("label")
      .nodeThreeObject(
        createNodeThreeObject({
          nodeDimSetters,
          paneSelSetters,
          paneActivitySetters,
          paneWaveState,
          colorSetters,
          highlightSetters,
          agentLabelSetters,
        })
      )
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
      .onNodeClick(
        createNodeClickHandler({
          graphRef,
          lastClickRef,
          savedCameraRef,
          focusedNodeRef,
          nodeDimSetters,
          refreshLinksRef,
          setOpenBacklogProject,
          setContextMenu,
          setPaneSelection,
          setSelection,
        })
      )
      .onLinkClick(createLinkClickHandler({ setSelection }))
      .onBackgroundClick(
        createBackgroundClickHandler({
          graphRef,
          focusedNodeRef,
          nodeDimSetters,
          refreshLinksRef,
          setContextMenu,
          savedCameraRef,
        })
      );

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
    // Expose the instance to the lazy XR entry (?xr) — read-only registry,
    // no effect on the desktop path.
    setXrGraphHandle(graph as unknown as XrGraphHandle);
    return () => {
      setXrGraphHandle(null);
      graph._destructor?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape releases focus lock and closes context menu
  useEffect(() => {
    const onKey = createEscapeFocusHandler({
      graphRef,
      contextMenu,
      setContextMenu,
      focusedNodeRef,
      nodeDimSetters,
      refreshLinksRef,
      savedCameraRef,
    });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contextMenu]);

  // Stale node pulse
  useEffect(() => {
    return startGraphAnimationLoop({
      graphRef,
      agentLabelSetters,
      agentMsgTimestampRef,
      roomActivityRef,
      paneWaveState,
      recentMsgMs: RECENT_MSG_MS,
      activityGlowTau: ACTIVITY_GLOW_TAU,
    });
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
    // setTimeout rather than rAF so recolour still runs in an XR session
    // (window rAF throttled) — same post-effects ordering either way.
    setTimeout(applyNodeColors, 0);
  }, [buildGraphData, applyNodeColors]);

  const sidePanelWidthRef = useRef(sidePanelWidth);
  sidePanelWidthRef.current = sidePanelWidth;

  const fitToScreen = useCallback(() => {
    fitGraphToScreen({ graphRef, sidePanelWidthRef, containerRef });
  }, []);

  const closeMenuAndRestore = useCallback(() => {
    closeGraphMenuAndRestore({
      graphRef,
      setContextMenu,
      savedCameraRef,
      focusedNodeRef,
      nodeDimSetters,
      refreshLinksRef,
    });
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
            releaseFocusLock({
              focusedNodeRef,
              nodeDimSetters,
              refreshLinksRef,
            });
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
