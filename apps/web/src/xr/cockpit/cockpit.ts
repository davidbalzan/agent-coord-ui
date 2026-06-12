import * as THREE from "three";
import type {
  AgentSnapshot,
  PaneSnapshot,
  RoomSnapshot,
} from "@coord-ui/shared";
import { useBusStore } from "../../store/bus.js";
import type { GraphNode } from "../../components/graph/backlogNodes.js";
import { createXrPanel, drawPanelText, XR_CYAN } from "./panel.js";

/**
 * The VR cockpit: world-space HUD stats panel, an EXIT VR button, and a node
 * info card shown on controller ray-select. Lives for one immersive session —
 * created on sessionstart, disposed on sessionend.
 */
export interface XrCockpit {
  group: THREE.Group;
  /** Meshes the controller ray may interact with (besides graph nodes). */
  uiTargets: THREE.Object3D[];
  /** Per-XR-frame: HUD refresh (throttled) + info-card billboarding. */
  update(camera: THREE.Camera): void;
  /** Controller trigger fired on an intersection (or empty space = null). */
  handleSelect(hit: THREE.Intersection | null): void;
  /** Controller ray currently pointing at an intersection (hover state). */
  handleHover(hit: THREE.Intersection | null): void;
  dispose(): void;
}

const STATUS_CSS: Record<string, string> = {
  active: "#00ff88",
  idle: "#ff8c00",
  stale: "#ff8c00",
  unknown: "#7a8db0",
};

const HUD_POS = new THREE.Vector3(-0.95, 1.55, -1.5);
const HUD_ROT_Y = 0.5; // angled toward the operator
const HUD_REFRESH_MS = 500;

function agoLabel(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

/** Walk up from a raycast hit to the force-graph node root, if any.
 *  three-forcegraph tags each node root with __graphObjType/__data. */
function findGraphNode(obj: THREE.Object3D): GraphNode | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    const tagged = cur as THREE.Object3D & {
      __graphObjType?: string;
      __data?: GraphNode;
    };
    if (tagged.__graphObjType === "node" && tagged.__data) return tagged.__data;
    cur = cur.parent;
  }
  return null;
}

export function createXrCockpit(endSession: () => void): XrCockpit {
  const group = new THREE.Group();

  // --- HUD stats panel -----------------------------------------------------
  const hud = createXrPanel(0.5, 0.36);
  hud.mesh.position.copy(HUD_POS);
  hud.mesh.rotation.y = HUD_ROT_Y;
  group.add(hud.mesh);

  // --- EXIT VR button ------------------------------------------------------
  const exitBtn = createXrPanel(0.34, 0.11);
  exitBtn.mesh.position.set(HUD_POS.x, HUD_POS.y - 0.27, HUD_POS.z);
  exitBtn.mesh.rotation.y = HUD_ROT_Y;
  exitBtn.mesh.name = "xr-exit-button";
  group.add(exitBtn.mesh);
  const drawExit = (hover: boolean) => {
    exitBtn.draw((ctx, w, h) => {
      ctx.font = `700 ${Math.round(h * 0.42)}px "Orbitron", monospace`;
      ctx.fillStyle = hover ? "#ffffff" : XR_CYAN;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⏏  EXIT VR", w / 2, h / 2);
      ctx.textAlign = "start";
    });
  };
  drawExit(false);
  let exitHover = false;

  // --- Node info card ------------------------------------------------------
  const infoCard = createXrPanel(0.44, 0.3);
  infoCard.mesh.visible = false;
  group.add(infoCard.mesh);

  const showInfoCard = (node: GraphNode, at: THREE.Vector3) => {
    const lines: { text: string; color?: string }[] = [];
    let title = node.label;
    if (node.kind === "agent") {
      const a = node.data as AgentSnapshot;
      lines.push(
        { text: `status: ${a.status}`, color: STATUS_CSS[a.status] },
        { text: `rooms: ${a.rooms.join(", ") || "—"}` },
        { text: `last seen: ${agoLabel(a.lastSeen)}` }
      );
    } else if (node.kind === "room") {
      const r = node.data as RoomSnapshot;
      title = `#${r.name}`;
      if (r.topic) lines.push({ text: r.topic.slice(0, 38), color: XR_CYAN });
      lines.push({ text: `members: ${r.members.length}` });
      for (const m of r.members.slice(0, 4)) lines.push({ text: `  · ${m}` });
      if (r.members.length > 4)
        lines.push({ text: `  … +${r.members.length - 4}` });
    } else if (node.kind === "pane") {
      const p = node.data as PaneSnapshot;
      lines.push(
        { text: `agent: ${p.agentId ?? "—"}` },
        { text: `activity: ${agoLabel(p.lastActivity)}` }
      );
    } else {
      lines.push({ text: `kind: ${node.kind}` });
    }
    infoCard.draw((ctx, w) => drawPanelText(ctx, w, title, lines));
    infoCard.mesh.position.copy(at);
    infoCard.mesh.position.y += 0.16;
    infoCard.mesh.visible = true;
  };

  // --- Per-frame -----------------------------------------------------------
  let lastHudDraw = 0;
  const drawHud = () => {
    const s = useBusStore.getState();
    const agents = Object.values(s.agents);
    const counts = { active: 0, idle: 0, stale: 0 };
    for (const a of agents)
      if (a.status in counts) counts[a.status as keyof typeof counts]++;
    const last = s.messages[s.messages.length - 1];
    hud.draw((ctx, w) =>
      drawPanelText(ctx, w, "Nexus · Agent Matrix", [
        { text: `agents  ${agents.length}` },
        { text: `  active ${counts.active}`, color: STATUS_CSS["active"] },
        {
          text: `  idle ${counts.idle} · stale ${counts.stale}`,
          color: STATUS_CSS["idle"],
        },
        { text: `rooms   ${Object.keys(s.rooms).length}` },
        { text: `msgs    ${s.messages.length}` },
        last
          ? {
              text: `last: ${last.from} → ${last.to}`.slice(0, 36),
              color: XR_CYAN,
            }
          : { text: "last: —" },
      ])
    );
  };
  drawHud();

  return {
    group,
    uiTargets: [exitBtn.mesh],
    update(camera) {
      const now = performance.now();
      if (now - lastHudDraw > HUD_REFRESH_MS) {
        lastHudDraw = now;
        drawHud();
      }
      if (infoCard.mesh.visible) {
        // Billboard the card toward the operator
        infoCard.mesh.lookAt(camera.getWorldPosition(new THREE.Vector3()));
      }
    },
    handleSelect(hit) {
      if (!hit) {
        infoCard.mesh.visible = false;
        return;
      }
      if (hit.object === exitBtn.mesh) {
        endSession();
        return;
      }
      const node = findGraphNode(hit.object);
      if (node) {
        showInfoCard(node, hit.point.clone());
      } else {
        infoCard.mesh.visible = false;
      }
    },
    handleHover(hit) {
      const over = hit?.object === exitBtn.mesh;
      if (over !== exitHover) {
        exitHover = over;
        drawExit(over);
      }
    },
    dispose() {
      hud.dispose();
      exitBtn.dispose();
      infoCard.dispose();
      group.removeFromParent();
    },
  };
}
