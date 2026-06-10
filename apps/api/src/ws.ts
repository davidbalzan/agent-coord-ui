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
  SpawnAgentPayload,
  TeardownAgentPayload,
} from "@coord-ui/shared";
import { busWatcher } from "./watcher.js";
import { sendKeys, capturePane, capturePaneAnsi, tmuxWatcher } from "./tmux.js";
import { spawnAgent, teardownAgent } from "./provisioner.js";
import { loadPresets } from "./presets.js";
import { isLoopback } from "./routes/agents.js";
import { logger } from "./logger.js";

// ─── Validation ───────────────────────────────────────────────────────────────

const AGENT_ID_RE = /^[\w-]{1,64}$/;

export function isValidAgentId(id: string | undefined): id is string {
  return typeof id === "string" && AGENT_ID_RE.test(id);
}

const ROOT =
  process.env.AGENT_COORD_DIR ??
  process.env.CLAUDE_COORD_DIR ??
  join(homedir(), "agent-coord");

export function attachWss(server: import("node:http").Server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const clientIsLoopback = isLoopback(req.socket.remoteAddress);
    logger.info({ loopback: clientIsLoopback }, "ws client connected");

    // Send full state on connect
    const state = await busWatcher.fullState();
    send(ws, { type: "full_state", ...state });

    // Forward bus events to this client
    const unsub = busWatcher.subscribe((event) => send(ws, event));

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
        }
      } catch {
        // malformed — ignore
      }
    });

    ws.on("close", () => {
      unsub();
      logger.info("ws client disconnected");
    });
  });

  return wss;
}

function send(ws: WebSocket, data: BusEvent | Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
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
