import { create } from "zustand";
import type {
  AgentSnapshot,
  RoomSnapshot,
  MessageSnapshot,
  PaneSnapshot,
} from "@coord-ui/shared";
import { busSocket } from "../lib/ws.js";

export type SelectionKind = "agent" | "room" | "dm-edge" | "pane";

export interface Selection {
  kind: SelectionKind;
  id: string; // agentId, roomId, or "agentA:agentB"
}

interface BusState {
  agents: Record<string, AgentSnapshot>;
  rooms: Record<string, RoomSnapshot>;
  messages: MessageSnapshot[];
  panes: Record<string, PaneSnapshot>;
  selection: Selection | null; // agent / room panel (right side)
  paneSelection: string | null; // raw pane ID — independent of selection
  nameFilter: string;
  setSelection: (s: Selection | null) => void;
  setPaneSelection: (id: string | null) => void;
  setNameFilter: (f: string) => void;
  sendMessage: (to: string, body: string, isDM: boolean) => void;
  sendPaneKeys: (paneId: string, keys: string) => void;
  requestPaneOutput: (paneId: string) => void;
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
        set((s) => ({ messages: [...s.messages.slice(-200), event.msg] }));
        break;
      case "pane_update":
        set((s) => ({ panes: { ...s.panes, [event.pane.id]: event.pane } }));
        break;
      case "pane_remove":
        set((s) => {
          const panes = { ...s.panes };
          delete panes[event.paneId];
          return { panes };
        });
        break;
    }
  });

  busSocket.connect();

  return {
    agents: {},
    rooms: {},
    messages: [],
    panes: {},
    selection: null,
    paneSelection: null,
    nameFilter: "",
    setSelection: (selection) => set({ selection }),
    setPaneSelection: (paneSelection) => set({ paneSelection }),
    setNameFilter: (nameFilter) => set({ nameFilter }),
    sendMessage: (to, body, isDM) => {
      busSocket.send({ type: "send_message", to, body, isDM });
    },
    sendPaneKeys: (paneId, keys) => {
      busSocket.send({ type: "pane_send_keys", paneId, keys });
    },
    requestPaneOutput: (paneId) => {
      busSocket.send({ type: "pane_request_output", paneId });
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
