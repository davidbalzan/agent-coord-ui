import type {
  AgentSnapshot,
  MessageSnapshot,
  PaneSnapshot,
  ProjectBacklog,
  RoomSnapshot,
} from "@coord-ui/shared";

export type NodeType = "agent" | "room" | "pane" | "backlog";

export interface GraphNode {
  id: string;
  kind: NodeType;
  label: string;
  data: AgentSnapshot | RoomSnapshot | PaneSnapshot | ProjectBacklog;
  x?: number;
  y?: number;
  z?: number;
}

export interface GraphLink {
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

interface BuildGraphDataArgs {
  agents: AgentSnapshot[];
  rooms: RoomSnapshot[];
  panes: PaneSnapshot[];
  messages: MessageSnapshot[];
  backlogs: ProjectBacklog[];
  cache: Map<string, GraphNode>;
}

export function linkKey(msg: MessageSnapshot): string {
  return msg.isDM
    ? `dm:${[msg.from, msg.to].sort().join(":")}`
    : `room:${msg.to}:${msg.from}`;
}

export function graphLinkKey(l: GraphLink): string {
  const src = typeof l.source === "object" ? l.source.id : l.source;
  const tgt = typeof l.target === "object" ? l.target.id : l.target;
  return l.kind === "dm"
    ? `dm:${[src, tgt].sort().join(":")}`
    : `room:${src}:${tgt}`;
}

export function nodeId(n: string | GraphNode): string {
  return typeof n === "object" ? n.id : n;
}

// Helpers: do two panes share horizontal or vertical overlap (for adjacency test)
function overlapsH(a: PaneSnapshot, b: PaneSnapshot): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width;
}

function overlapsV(a: PaneSnapshot, b: PaneSnapshot): boolean {
  return a.top < b.top + b.height && b.top < a.top + a.height;
}

export function buildGraphData({
  agents,
  rooms,
  panes,
  messages,
  backlogs,
  cache,
}: BuildGraphDataArgs): { nodes: GraphNode[]; links: GraphLink[] } {
  const agentIds = new Set(agents.map((a) => a.id));

  // Reuse the cached node object for an id if it exists so d3 keeps its
  // simulation state; only mutate the fields that can change.
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
      const shortName = b.project.split("/").filter(Boolean).pop() ?? b.project;
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
}
