import { create } from "zustand";
import type {
  AgentSnapshot,
  RoomSnapshot,
  MessageSnapshot,
  PaneSnapshot,
  AgentPreset,
  TerminalGroup,
  ProjectBacklog,
} from "@coord-ui/shared";
import { busSocket } from "../lib/ws.js";

export type SelectionKind = "agent" | "room" | "dm-edge" | "pane";

export interface Selection {
  kind: SelectionKind;
  id: string; // agentId, roomId, or "agentA:agentB"
}

export interface LauncherPrefill {
  paneKind: "split-window" | "new-window" | "new-session";
  paneTarget?: string;
  presetId?: string;
}

export interface SpawnProgressRecord {
  agentId: string;
  step: string;
  paneId?: string;
  message?: string;
  error?: string;
}

interface BusState {
  agents: Record<string, AgentSnapshot>;
  rooms: Record<string, RoomSnapshot>;
  messages: MessageSnapshot[];
  panes: Record<string, PaneSnapshot>;
  paneAnsi: Record<string, string>; // paneId → latest ANSI output
  selection: Selection | null; // agent / room panel (right side)
  paneSelection: string | null; // raw pane ID — independent of selection
  nameFilter: string;
  hoveredAgentId: string | null;
  sidePanelWidth: number; // 0 when closed
  presets: AgentPreset[];
  spawnProgress: Record<string, SpawnProgressRecord>; // keyed by agentId
  launcherOpen: boolean;
  launcherPrefill: LauncherPrefill | null;
  backlogs: ProjectBacklog[];
  openBacklogProject: string | null; // project path of the backlog panel currently open
  setSelection: (s: Selection | null) => void;
  setPaneSelection: (id: string | null) => void;
  setNameFilter: (f: string) => void;
  setHoveredAgentId: (id: string | null) => void;
  setSidePanelWidth: (w: number) => void;
  setLauncherOpen: (v: boolean) => void;
  setLauncherPrefill: (v: LauncherPrefill | null) => void;
  setOpenBacklogProject: (project: string | null) => void;
  fetchBacklogs: () => Promise<void>;
  saveBacklogQueue: (
    project: string,
    items: import("@coord-ui/shared").BacklogQueueItem[]
  ) => Promise<void>;
  sendMessage: (to: string, body: string, isDM: boolean) => void;
  sendPaneKeys: (paneId: string, keys: string) => void;
  requestPaneOutput: (paneId: string) => void;
  fetchPresets: () => Promise<void>;
  spawnAgent: (
    presetId: string,
    agentId: string,
    paneKind?: string,
    paneTarget?: string
  ) => void;
  teardownAgent: (agentId: string, paneId: string) => void;
  clearSpawnProgress: (agentId: string) => void;
}

export const useBusStore = create<BusState>((set) => {
  // Wire WS events into the store
  busSocket.on((event) => {
    switch (event.type) {
      case "full_state":
        set({
          agents: Object.fromEntries(
            event.agents.map((a: AgentSnapshot) => [a.id, a])
          ),
          rooms: Object.fromEntries(
            event.rooms.map((r: RoomSnapshot) => [r.id, r])
          ),
          messages: event.messages ?? [],
          panes: Object.fromEntries(
            (event.panes ?? []).map((p: PaneSnapshot) => [p.id, p])
          ),
        });
        break;
      case "agent_join":
        set((s) => ({
          agents: { ...s.agents, [event.agent.id]: event.agent },
        }));
        break;
      case "agent_leave":
        set((s) => {
          const agents = { ...s.agents };
          delete agents[event.agentId];
          return { agents };
        });
        break;
      case "agent_update":
        set((s) => ({
          agents: {
            ...s.agents,
            [event.agentId]: { ...s.agents[event.agentId], ...event.patch },
          },
        }));
        break;
      case "room_update":
        set((s) => ({ rooms: { ...s.rooms, [event.room.id]: event.room } }));
        break;
      case "message":
        set((s) => ({ messages: [...s.messages, event.msg] }));
        break;
      case "pane_update":
        set((s) => ({ panes: { ...s.panes, [event.pane.id]: event.pane } }));
        break;
      case "pane_remove":
        set((s) => {
          const panes = { ...s.panes };
          const paneAnsi = { ...s.paneAnsi };
          delete panes[event.paneId];
          delete paneAnsi[event.paneId];
          return { panes, paneAnsi };
        });
        break;
      case "pane_output":
        set((s) => ({
          paneAnsi: { ...s.paneAnsi, [event.paneId]: event.ansi },
        }));
        break;
      case "spawn_progress":
        set((s) => ({
          spawnProgress: {
            ...s.spawnProgress,
            [event.agentId]: {
              agentId: event.agentId,
              step: event.step,
              paneId: event.paneId,
              message: event.message,
              error: event.error,
            },
          },
        }));
        break;
    }
  });

  busSocket.connect();

  return {
    agents: {},
    rooms: {},
    messages: [],
    panes: {},
    paneAnsi: {},
    selection: null,
    paneSelection: null,
    nameFilter: "",
    hoveredAgentId: null,
    sidePanelWidth: 0,
    presets: [],
    spawnProgress: {},
    launcherOpen: false,
    launcherPrefill: null,
    backlogs: [],
    openBacklogProject: null,
    setSelection: (selection) => set({ selection }),
    setPaneSelection: (paneSelection) => set({ paneSelection }),
    setNameFilter: (nameFilter) => set({ nameFilter }),
    setHoveredAgentId: (hoveredAgentId) => set({ hoveredAgentId }),
    setSidePanelWidth: (sidePanelWidth) => set({ sidePanelWidth }),
    setLauncherOpen: (launcherOpen) => set({ launcherOpen }),
    setLauncherPrefill: (launcherPrefill) => set({ launcherPrefill }),
    setOpenBacklogProject: (openBacklogProject) => set({ openBacklogProject }),
    fetchBacklogs: async () => {
      const res = await fetch("/api/backlogs");
      if (res.ok) {
        const data = (await res.json()) as ProjectBacklog[];
        set({ backlogs: data });
      }
    },
    saveBacklogQueue: async (project, items) => {
      const projectId = encodeURIComponent(project);
      const res = await fetch(`/api/backlogs/${projectId}/queue`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue: items }),
      });
      if (res.ok) {
        const updated = (await res.json()) as ProjectBacklog;
        set((s) => ({
          backlogs: s.backlogs.map((b) =>
            b.project === project ? { ...updated, agentIds: b.agentIds } : b
          ),
        }));
      }
    },
    sendMessage: (to, body, isDM) => {
      busSocket.send({ type: "send_message", to, body, isDM });
    },
    sendPaneKeys: (paneId, keys) => {
      busSocket.send({ type: "pane_send_keys", paneId, keys });
    },
    requestPaneOutput: (paneId) => {
      busSocket.send({ type: "pane_request_output", paneId });
    },
    fetchPresets: async () => {
      const res = await fetch("/api/agents/presets");
      if (res.ok) {
        const data = (await res.json()) as AgentPreset[];
        set({ presets: data });
      }
    },
    spawnAgent: (presetId, agentId, paneKind, paneTarget) => {
      busSocket.send({
        type: "spawn_agent",
        presetId,
        agentId,
        paneKind,
        paneTarget,
      });
    },
    teardownAgent: (agentId, paneId) => {
      busSocket.send({ type: "teardown_agent", agentId, paneId });
    },
    clearSpawnProgress: (agentId) => {
      set((s) => {
        const spawnProgress = { ...s.spawnProgress };
        delete spawnProgress[agentId];
        return { spawnProgress };
      });
    },
  };
});

// Shallow selectors — use with useShallow() to avoid infinite re-render loops
export const selectAgentIds = (s: BusState) => Object.keys(s.agents);
export const selectRoomIds = (s: BusState) => Object.keys(s.rooms);

// Derived helpers (call inside components)
export const agentList = (s: BusState) => Object.values(s.agents);
export const roomList = (s: BusState) => Object.values(s.rooms);
export const dmMessages = (s: BusState, a: string, b: string) =>
  s.messages.filter(
    (m) =>
      m.isDM && ((m.from === a && m.to === b) || (m.from === b && m.to === a))
  );
export const roomMessages = (s: BusState, roomId: string) =>
  s.messages.filter((m) => !m.isDM && m.to === roomId);

/** Derive TerminalGroup list from pane session metadata. */
export const terminalGroups = (s: BusState): TerminalGroup[] => {
  const map = new Map<string, string[]>();
  for (const pane of Object.values(s.panes)) {
    const list = map.get(pane.session) ?? [];
    list.push(pane.id);
    map.set(pane.session, list);
  }
  return Array.from(map.entries()).map(([session, paneIds]) => ({
    id: session,
    label: session,
    paneIds,
  }));
};
