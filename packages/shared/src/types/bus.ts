export type AgentStatus = "active" | "idle" | "stale" | "unknown";

export interface PaneSnapshot {
  id: string; // "session:window.pane" e.g. "main:0.1"
  pid: number;
  title: string;
  command: string; // current foreground command
  session: string;
  window: number;
  pane: number;
  active: boolean; // pane is the focused pane in its window
  lastActivity: number; // unix ms, updated on output change
  cwd: string; // current working directory (#{pane_current_path})
  // tmux geometry (column/row coordinates within the terminal)
  left: number;
  top: number;
  width: number;
  height: number;
  agentId?: string; // set if we can match this pane to a registered agent
  lines: string[]; // last N lines of output (plain text, no ANSI)
}

export interface AgentSnapshot {
  id: string;
  name: string;
  status: AgentStatus;
  rooms: string[];
  lastSeen: number; // unix ms
  metadata?: Record<string, unknown>;
}

export interface RoomSnapshot {
  id: string;
  name: string;
  topic?: string;
  motd?: string;
  members: string[]; // agent ids
}

export interface MessageSnapshot {
  id: string;
  from: string; // agent id or 'operator'
  to: string; // agent id (DM) or room id (broadcast)
  isDM: boolean;
  body: string;
  timestamp: number;
}

export type BusEvent =
  | {
      type: "full_state";
      agents: AgentSnapshot[];
      rooms: RoomSnapshot[];
      messages: MessageSnapshot[];
      panes: PaneSnapshot[];
    }
  | { type: "agent_join"; agent: AgentSnapshot }
  | { type: "agent_leave"; agentId: string }
  | { type: "agent_update"; agentId: string; patch: Partial<AgentSnapshot> }
  | { type: "room_update"; room: RoomSnapshot }
  | { type: "message"; msg: MessageSnapshot }
  | { type: "pane_update"; pane: PaneSnapshot }
  | { type: "pane_remove"; paneId: string }
  | { type: "pane_output"; paneId: string; ansi: string }
  | {
      type: "spawn_progress";
      agentId: string;
      step:
        | "creating"
        | "launching"
        | "configuring"
        | "joining"
        | "confirming"
        | "done"
        | "error";
      paneId?: string;
      message?: string;
      error?: string;
    };

export interface SendMessagePayload {
  to: string;
  body: string;
  isDM: boolean;
}

export interface SpawnAgentPayload {
  type: "spawn_agent";
  presetId: string;
  agentId: string;
  paneKind?: "split-window" | "new-window" | "new-session";
  paneTarget?: string;
}

export interface TeardownAgentPayload {
  type: "teardown_agent";
  agentId: string;
  paneId: string;
}

export interface PaneSendKeysPayload {
  type: "pane_send_keys";
  paneId: string;
  keys: string; // raw text; newline = Enter
}

// ── Phase 7: interactive PTY bridge (xterm.js) ──────────────────────────────
// Client → server control messages for a real, PTY-backed terminal view.
// A pty attach gives full interactive shell access to the tmux session, so the
// server MUST gate these on a loopback connection (same as spawn/teardown).
// Keyed by paneId so one WS connection can drive several open terminals.

export interface PtyAttachPayload {
  type: "pty_attach";
  paneId: string; // tmux pane id "session:window.pane"
  cols: number;
  rows: number;
}

export interface PtyInputPayload {
  type: "pty_input";
  paneId: string;
  data: string; // raw bytes from xterm.js onData (keystrokes, escape seqs)
}

export interface PtyResizePayload {
  type: "pty_resize";
  paneId: string;
  cols: number;
  rows: number;
}

export interface PtyDetachPayload {
  type: "pty_detach";
  paneId: string;
}

export type PtyClientPayload =
  | PtyAttachPayload
  | PtyInputPayload
  | PtyResizePayload
  | PtyDetachPayload;

// Server → client, sent ONLY on the requesting connection (not broadcast like
// BusEvent — pty streams are per-viewer).
export interface PtyDataEvent {
  type: "pty_data";
  paneId: string;
  data: string; // raw bytes to feed xterm.write()
}

export interface PtyExitEvent {
  type: "pty_exit";
  paneId: string;
  error?: string; // present when the attach failed or the pty died abnormally
}

export type PtyServerEvent = PtyDataEvent | PtyExitEvent;
