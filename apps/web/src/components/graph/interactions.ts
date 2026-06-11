import * as THREE from "three";
import type { ProjectBacklog } from "@coord-ui/shared";
import { nodeId, type GraphLink, type GraphNode } from "./backlogNodes.js";

interface RefLike<T> {
  current: T;
}

interface GraphInteractionRuntime {
  camera(): THREE.PerspectiveCamera;
  cameraPosition(
    position: { x: number; y: number; z: number },
    lookAt?: { x: number; y: number; z: number },
    ms?: number
  ): void;
  controls(): { target: THREE.Vector3 };
  zoomToFit(ms?: number, px?: number): void;
}

interface SavedCamera {
  pos: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export interface ContextMenuState {
  nodeId: string;
  kind: "agent" | "room";
  node3D: { x: number; y: number; z: number };
}

interface FocusRefs {
  focusedNodeRef: RefLike<string | null>;
  nodeDimSetters: RefLike<Map<string, (dimmed: boolean) => void>>;
  refreshLinksRef: RefLike<() => void>;
}

interface SavedCameraRef {
  savedCameraRef: RefLike<SavedCamera | null>;
}

export function releaseFocusLock({
  focusedNodeRef,
  nodeDimSetters,
  refreshLinksRef,
}: FocusRefs): void {
  focusedNodeRef.current = null;
  for (const setDimmed of nodeDimSetters.current.values()) setDimmed(false);
  refreshLinksRef.current();
}

function restoreSavedCamera({
  graph,
  savedCameraRef,
}: { graph: GraphInteractionRuntime | null } & SavedCameraRef): void {
  if (savedCameraRef.current && graph) {
    const { pos, target } = savedCameraRef.current;
    graph.cameraPosition(pos, target, 600);
    savedCameraRef.current = null;
  }
}

export function createNodeClickHandler({
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
}: {
  graphRef: RefLike<GraphInteractionRuntime | null>;
  lastClickRef: RefLike<{ id: string; time: number } | null>;
  setOpenBacklogProject: (project: string) => void;
  setContextMenu: (value: ContextMenuState | null) => void;
  setPaneSelection: (paneId: string) => void;
  setSelection: (selection: { kind: "room" | "agent"; id: string }) => void;
} & FocusRefs &
  SavedCameraRef): (n: object) => void {
  return (n: object) => {
    const graph = graphRef.current;
    if (!graph) return;
    const node = n as GraphNode;
    const now = Date.now();
    const last = lastClickRef.current;

    if (last?.id === node.id && now - last.time < 400) {
      lastClickRef.current = null;
      // Snapshot current camera before zoom so we can restore on menu close
      const cam = graph.camera();
      const ctrl = graph.controls();
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
  };
}

export function createLinkClickHandler({
  setSelection,
}: {
  setSelection: (selection: { kind: "room" | "agent"; id: string }) => void;
}): (l: object) => void {
  return (l: object) => {
    const link = l as GraphLink;
    if (link.kind === "membership") {
      setSelection({ kind: "room", id: nodeId(link.source) });
    } else if (link.kind === "dm") {
      setSelection({ kind: "agent", id: nodeId(link.source) });
    }
  };
}

export function createBackgroundClickHandler({
  graphRef,
  focusedNodeRef,
  nodeDimSetters,
  refreshLinksRef,
  setContextMenu,
  savedCameraRef,
}: {
  graphRef: RefLike<GraphInteractionRuntime | null>;
  setContextMenu: (value: ContextMenuState | null) => void;
} & FocusRefs &
  SavedCameraRef): () => void {
  return () => {
    const graph = graphRef.current;
    if (!graph) return;
    if (focusedNodeRef.current === null) return;
    releaseFocusLock({ focusedNodeRef, nodeDimSetters, refreshLinksRef });
    setContextMenu(null);
    restoreSavedCamera({ graph, savedCameraRef });
  };
}

export function createEscapeFocusHandler({
  graphRef,
  contextMenu,
  setContextMenu,
  focusedNodeRef,
  nodeDimSetters,
  refreshLinksRef,
  savedCameraRef,
}: {
  graphRef: RefLike<GraphInteractionRuntime | null>;
  contextMenu: ContextMenuState | null;
  setContextMenu: (value: ContextMenuState | null) => void;
} & FocusRefs &
  SavedCameraRef): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    const hadMenu = contextMenu !== null;
    setContextMenu(null);
    if (focusedNodeRef.current !== null) {
      releaseFocusLock({ focusedNodeRef, nodeDimSetters, refreshLinksRef });
    }
    if (hadMenu) {
      restoreSavedCamera({ graph: graphRef.current, savedCameraRef });
    }
  };
}

export function fitToScreen({
  graphRef,
  sidePanelWidthRef,
  containerRef,
}: {
  graphRef: RefLike<GraphInteractionRuntime | null>;
  sidePanelWidthRef: RefLike<number>;
  containerRef: RefLike<HTMLDivElement | null>;
}): void {
  const graph = graphRef.current;
  if (!graph) return;
  graph.zoomToFit(800, 60);

  // After the fit animation settles, pan left so the panel doesn't obscure nodes
  const panelW = sidePanelWidthRef.current;
  if (panelW <= 0) return;
  setTimeout(() => {
    const g = graphRef.current;
    if (!g) return;
    const camera = g.camera();
    const controls = g.controls();
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
}

export function closeMenuAndRestore({
  graphRef,
  setContextMenu,
  savedCameraRef,
  focusedNodeRef,
  nodeDimSetters,
  refreshLinksRef,
}: {
  graphRef: RefLike<GraphInteractionRuntime | null>;
  setContextMenu: (value: ContextMenuState | null) => void;
} & FocusRefs &
  SavedCameraRef): void {
  setContextMenu(null);
  restoreSavedCamera({ graph: graphRef.current, savedCameraRef });
  // Release focus lock
  releaseFocusLock({ focusedNodeRef, nodeDimSetters, refreshLinksRef });
}
