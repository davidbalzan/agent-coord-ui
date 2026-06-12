import { WebSocketServer, WebSocket } from "ws";
import { appendFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type {
  BusEvent,
  SendMessagePayload,
  PaneSendKeysPayload,
  PtyAttachPayload,
  PtyClientPayload,
  SpawnAgentPayload,
  TeardownAgentPayload,
} from "@coord-ui/shared";
import { busWatcher } from "./watcher.js";
import { sendKeys, capturePane, capturePaneAnsi, tmuxWatcher } from "./tmux.js";
import { spawnAgent, teardownAgent } from "./provisioner.js";
import { loadPresets } from "./presets.js";
import { isLoopback } from "./routes/agents.js";
import { logger } from "./logger.js";
import { PtyManager, type PtyHandle } from "./pty.js";

// ─── Validation ───────────────────────────────────────────────────────────────

const AGENT_ID_RE = /^[\w-]{1,64}$/;

export function isValidAgentId(id: string | undefined): id is string {
  return typeof id === "string" && AGENT_ID_RE.test(id);
}

const ROOT =
  process.env.AGENT_COORD_DIR ??
  process.env.CLAUDE_COORD_DIR ??
  join(homedir(), "agent-coord");

const ptyManager = new PtyManager();

export function attachWss(server: import("node:http").Server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const clientIsLoopback = isLoopback(req.socket.remoteAddress);
    const ptys = new Map<string, PtyHandle>();
    logger.info({ loopback: clientIsLoopback }, "ws client connected");

    // Register the message + close handlers BEFORE the (potentially slow)
    // fullState() below, so a pty_attach / privileged message sent during the
    // connect window is handled immediately instead of being silently dropped
    // (which would make the live terminal fall back to the read-only snapshot).
    let unsub: () => void = () => {};

    ws.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString()) as { type: string } & Record<
          string,
          unknown
        >;
        if (payload.type === "send_message") {
          handleSend(payload as unknown as SendMessagePayload).catch((err) =>
            logger.error({ err }, "send_message error")
          );
        } else if (payload.type === "pane_send_keys") {
          const p = payload as unknown as PaneSendKeysPayload;
          sendKeys(p.paneId, p.keys).catch((err) =>
            logger.error({ err, paneId: p.paneId }, "pane_send_keys error")
          );
        } else if (payload.type === "spawn_agent") {
          if (!clientIsLoopback) {
            send(ws, {
              type: "spawn_progress",
              agentId: "",
              step: "error",
              error: "spawn_agent: local connection required",
            });
            return;
          }
          const p = payload as unknown as SpawnAgentPayload;
          if (!isValidAgentId(p.agentId)) {
            send(ws, {
              type: "spawn_progress",
              agentId: p.agentId ?? "",
              step: "error",
              error: "spawn_agent: invalid agentId — use [\\w-] only",
            });
            return;
          }
          loadPresets()
            .then((presets) => {
              const preset = presets.find((pr) => pr.id === p.presetId);
              if (!preset) {
                send(ws, {
                  type: "spawn_progress",
                  agentId: p.agentId,
                  step: "error",
                  error: `preset "${p.presetId}" not found`,
                });
                return;
              }
              return spawnAgent(
                preset,
                {
                  presetId: p.presetId,
                  agentId: p.agentId,
                  paneKind: p.paneKind,
                  paneTarget: p.paneTarget,
                },
                (event) => send(ws, event)
              );
            })
            .catch((err) => logger.error({ err }, "spawn_agent error"));
        } else if (payload.type === "teardown_agent") {
          if (!clientIsLoopback) {
            send(ws, {
              type: "spawn_progress",
              agentId: "",
              step: "error",
              error: "teardown_agent: local connection required",
            });
            return;
          }
          const p = payload as unknown as TeardownAgentPayload;
          if (!isValidAgentId(p.agentId)) {
            send(ws, {
              type: "spawn_progress",
              agentId: p.agentId ?? "",
              step: "error",
              error: "teardown_agent: invalid agentId — use [\\w-] only",
            });
            return;
          }
          teardownAgent(p.agentId, p.paneId, (event) => send(ws, event)).catch(
            (err) => logger.error({ err }, "teardown_agent error")
          );
        } else if (payload.type === "pane_request_output") {
          const paneId = payload["paneId"] as string;
          const existing = tmuxWatcher.panes.find((p) => p.id === paneId);
          if (existing) {
            Promise.all([
              capturePane(paneId, 300),
              capturePaneAnsi(paneId, 300),
            ])
              .then(([lines, ansi]) => {
                send(ws, { type: "pane_update", pane: { ...existing, lines } });
                send(ws, { type: "pane_output", paneId, ansi });
              })
              .catch(() => {});
          }
        } else if (isPtyClientPayload(payload)) {
          handlePtyPayload(ws, payload, clientIsLoopback, ptys);
        }
      } catch {
        // malformed — ignore
      }
    });

    ws.on("close", () => {
      unsub();
      for (const handle of ptys.values()) {
        handle.kill();
      }
      ptys.clear();
      logger.info("ws client disconnected");
    });

    // Stream initial state, then subscribe to deltas. The message handler is
    // already live above, so PTY/privileged messages aren't lost while this
    // (potentially slow) fullState resolves.
    const state = await busWatcher.fullState();
    send(ws, { type: "full_state", ...state });
    unsub = busWatcher.subscribe((event) => send(ws, event));
  });

  return wss;
}

function send(ws: WebSocket, data: BusEvent | Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function isPtyClientPayload(payload: {
  type: string;
}): payload is PtyClientPayload {
  return (
    payload.type === "pty_attach" ||
    payload.type === "pty_input" ||
    payload.type === "pty_resize" ||
    payload.type === "pty_detach"
  );
}

function handlePtyPayload(
  ws: WebSocket,
  payload: PtyClientPayload,
  clientIsLoopback: boolean,
  ptys: Map<string, PtyHandle>
) {
  if (!clientIsLoopback) {
    send(ws, {
      type: "pty_exit",
      paneId: payload.paneId,
      error: `${payload.type}: local connection required`,
    });
    return;
  }

  if (payload.type === "pty_attach") {
    attachPty(ws, payload, ptys);
    return;
  }

  const handle = ptys.get(payload.paneId);
  if (!handle) {
    send(ws, {
      type: "pty_exit",
      paneId: payload.paneId,
      error: `${payload.type}: pty not attached`,
    });
    return;
  }

  if (payload.type === "pty_input") {
    handle.write(payload.data);
  } else if (payload.type === "pty_resize") {
    handle.resize(payload.cols, payload.rows);
  } else if (payload.type === "pty_detach") {
    handle.kill();
    ptys.delete(payload.paneId);
    send(ws, { type: "pty_exit", paneId: payload.paneId });
  }
}

function attachPty(
  ws: WebSocket,
  payload: PtyAttachPayload,
  ptys: Map<string, PtyHandle>
) {
  ptys.get(payload.paneId)?.kill();
  ptys.delete(payload.paneId);

  try {
    const handle = ptyManager.attach(
      payload.paneId,
      payload.cols,
      payload.rows,
      (data) => send(ws, { type: "pty_data", paneId: payload.paneId, data }),
      (error) => {
        if (ptys.get(payload.paneId) !== handle) return;
        ptys.delete(payload.paneId);
        send(ws, {
          type: "pty_exit",
          paneId: payload.paneId,
          ...(error ? { error } : {}),
        });
      }
    );
    ptys.set(payload.paneId, handle);
  } catch (err) {
    send(ws, {
      type: "pty_exit",
      paneId: payload.paneId,
      error: err instanceof Error ? err.message : "pty attach failed",
    });
  }
}

async function handleSend(payload: SendMessagePayload) {
  const { to, body, isDM } = payload;
  const record = JSON.stringify({
    id: randomUUID(),
    ts: Date.now(),
    from: "david",
    ...(isDM ? { to } : { room: to }),
    text: body,
  });

  if (isDM) {
    // DMs go to the agent's inbox file
    const inboxDir = join(ROOT, "inbox");
    await mkdir(inboxDir, { recursive: true });
    await appendFile(join(inboxDir, `${to}.jsonl`), record + "\n");
  } else if (to === "general") {
    await appendFile(join(ROOT, "room.jsonl"), record + "\n");
  } else {
    const roomsDir = join(ROOT, "rooms");
    await mkdir(roomsDir, { recursive: true });
    await appendFile(join(roomsDir, `${to}.jsonl`), record + "\n");
  }

  logger.info({ to, isDM }, "message written");
}
