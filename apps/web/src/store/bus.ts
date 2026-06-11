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
import {
  DAVID_ID,
  buildDavidThreads,
  globalUnreadCount,
  loadReadState,
  saveReadState,
} from "../lib/inbox.js";
import {
  classifyPriority,
  extractPrefix,
  type BusPrefix,
  type Priority,
} from "../lib/notificationPriority.js";
export type { DmThread } from "../lib/inbox.js";

const RESOLVED_LS_KEY = "coord-ui:resolved-decisions";

function loadResolvedDecisions(): Record<string, string> {
  try {
    const raw = localStorage.getItem(RESOLVED_LS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveResolvedDecisions(state: Record<string, string>): void {
  try {
    localStorage.setItem(RESOLVED_LS_KEY, JSON.stringify(state));
  } catch {
    // storage quota or unavailable — silent
  }
}

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

export interface NotificationItem {
  id: string;
  messageId: string;
  from: string;
  body: string;
  timestamp: number;
  priority: Priority;
  prefix: BusPrefix | null;
  origin?: NotificationOrigin;
}

export interface NotificationOrigin {
  x: number;
  y: number;
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
  inboxOpen: boolean;
  activeInboxThread: string | null; // counterpart agent id currently viewed
  readState: Record<string, number>; // counterpart → last-read timestamp
  resolvedDecisions: Record<string, string>; // messageId → chosen option text
  // Notifications slice — kept separate from inbox/read-state for concurrent Task 5 work.
  notificationPopup: NotificationItem | null;
  notificationQueue: NotificationItem[];
  notificationDockItems: NotificationItem[];
  notificationLastSeenMessageId: string | null;
  notificationLastSeenMessageCount: number;
  setSelection: (s: Selection | null) => void;
  setPaneSelection: (id: string | null) => void;
  setNameFilter: (f: string) => void;
  setHoveredAgentId: (id: string | null) => void;
  setSidePanelWidth: (w: number) => void;
  setLauncherOpen: (v: boolean) => void;
  setLauncherPrefill: (v: LauncherPrefill | null) => void;
  setOpenBacklogProject: (project: string | null) => void;
  setInboxOpen: (v: boolean) => void;
  setActiveInboxThread: (counterpart: string | null) => void;
  markThreadRead: (counterpart: string) => void;
  addResolvedDecision: (messageId: string, chosenOption: string) => void;
  moveNotificationToDock: (id: string) => void;
  dismissNotification: (id: string) => void;
  actNotification: (id: string) => void;
  setNotificationOrigin: (
    id: string,
    origin: NotificationOrigin | null
  ) => void;
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

function isIncomingDavidDm(msg: MessageSnapshot) {
  return msg.isDM && msg.to === DAVID_ID && msg.from !== DAVID_ID;
}

function buildNotification(msg: MessageSnapshot): NotificationItem {
  return {
    id: msg.id,
    messageId: msg.id,
    from: msg.from,
    body: msg.body,
    timestamp: msg.timestamp,
    priority: classifyPriority(msg.body),
    prefix: extractPrefix(msg.body),
  };
}

function hasNotification(s: BusState, id: string) {
  return (
    s.notificationPopup?.id === id ||
    s.notificationQueue.some((item) => item.id === id) ||
    s.notificationDockItems.some((item) => item.id === id)
  );
}

function enqueueNotification(s: BusState, item: NotificationItem) {
  if (hasNotification(s, item.id)) return {};

  if (item.priority === "loud") {
    if (s.notificationPopup) {
      return { notificationQueue: [...s.notificationQueue, item] };
    }
    return { notificationPopup: item };
  }

  return { notificationDockItems: [item, ...s.notificationDockItems] };
}

function clearNotification(s: BusState, id: string) {
  const isPopup = s.notificationPopup?.id === id;
  const [nextPopup, ...remainingQueue] = s.notificationQueue;

  return {
    notificationPopup: isPopup ? (nextPopup ?? null) : s.notificationPopup,
    notificationQueue: isPopup
      ? remainingQueue
      : s.notificationQueue.filter((item) => item.id !== id),
    notificationDockItems: s.notificationDockItems.filter(
      (item) => item.id !== id
    ),
  };
}

function withNotificationOrigin(
  item: NotificationItem,
  origin: NotificationOrigin | null
): NotificationItem {
  if (!origin) {
    const { origin: _origin, ...rest } = item;
    return rest;
  }
  return { ...item, origin };
}

export const useBusStore = create<BusState>((set) => {
  // Wire WS events into the store
  busSocket.on((event) => {
    switch (event.type) {
      case "full_state": {
        const messages = event.messages ?? [];
        set({
          agents: Object.fromEntries(
            event.agents.map((a: AgentSnapshot) => [a.id, a])
          ),
          rooms: Object.fromEntries(
            event.rooms.map((r: RoomSnapshot) => [r.id, r])
          ),
          messages,
          panes: Object.fromEntries(
            (event.panes ?? []).map((p: PaneSnapshot) => [p.id, p])
          ),
          notificationLastSeenMessageId:
            messages[messages.length - 1]?.id ?? null,
          notificationLastSeenMessageCount: messages.length,
        });
        break;
      }
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
        set((s) => {
          const messages = [...s.messages, event.msg];
          const base = {
            messages,
            notificationLastSeenMessageId: event.msg.id,
            notificationLastSeenMessageCount: messages.length,
          };

          if (event.msg.id === s.notificationLastSeenMessageId) return base;
          if (!isIncomingDavidDm(event.msg)) return base;

          return {
            ...base,
            ...enqueueNotification(s, buildNotification(event.msg)),
          };
        });
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
    inboxOpen: false,
    activeInboxThread: null,
    readState: loadReadState(),
    resolvedDecisions: loadResolvedDecisions(),
    notificationPopup: null,
    notificationQueue: [],
    notificationDockItems: [],
    notificationLastSeenMessageId: null,
    notificationLastSeenMessageCount: 0,
    setSelection: (selection) => set({ selection }),
    setPaneSelection: (paneSelection) => set({ paneSelection }),
    setNameFilter: (nameFilter) => set({ nameFilter }),
    setHoveredAgentId: (hoveredAgentId) => set({ hoveredAgentId }),
    setSidePanelWidth: (sidePanelWidth) => set({ sidePanelWidth }),
    setLauncherOpen: (launcherOpen) => set({ launcherOpen }),
    setLauncherPrefill: (launcherPrefill) => set({ launcherPrefill }),
    setOpenBacklogProject: (openBacklogProject) => set({ openBacklogProject }),
    setInboxOpen: (inboxOpen) => set({ inboxOpen }),
    setActiveInboxThread: (activeInboxThread) => set({ activeInboxThread }),
    markThreadRead: (counterpart) =>
      set((s) => {
        const readState = { ...s.readState, [counterpart]: Date.now() };
        saveReadState(readState);
        return { readState };
      }),
    addResolvedDecision: (messageId, chosenOption) =>
      set((s) => {
        const resolvedDecisions = {
          ...s.resolvedDecisions,
          [messageId]: chosenOption,
        };
        saveResolvedDecisions(resolvedDecisions);
        return { resolvedDecisions };
      }),
    moveNotificationToDock: (id) =>
      set((s) => {
        if (s.notificationPopup?.id !== id) return {};
        const [nextPopup, ...remainingQueue] = s.notificationQueue;
        return {
          notificationPopup: nextPopup ?? null,
          notificationQueue: remainingQueue,
          notificationDockItems: [
            s.notificationPopup,
            ...s.notificationDockItems,
          ],
        };
      }),
    dismissNotification: (id) => set((s) => clearNotification(s, id)),
    actNotification: (id) => set((s) => clearNotification(s, id)),
    setNotificationOrigin: (id, origin) =>
      set((s) => ({
        notificationPopup:
          s.notificationPopup?.id === id
            ? withNotificationOrigin(s.notificationPopup, origin)
            : s.notificationPopup,
        notificationQueue: s.notificationQueue.map((item) =>
          item.id === id ? withNotificationOrigin(item, origin) : item
        ),
        notificationDockItems: s.notificationDockItems.map((item) =>
          item.id === id ? withNotificationOrigin(item, origin) : item
        ),
      })),
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

/** David's DM threads, sorted: unread first, then by latest message desc. */
export const davidThreads = (s: BusState) =>
  buildDavidThreads(s.messages, s.readState);

/** Total unread count across all David's DM threads. */
export const davidGlobalUnread = (s: BusState) =>
  globalUnreadCount(buildDavidThreads(s.messages, s.readState));

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
