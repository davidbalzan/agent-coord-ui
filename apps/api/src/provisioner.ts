import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  AgentPreset,
  SpawnAgentRequest,
  SpawnProgressEvent,
  SpawnStep,
} from "@coord-ui/shared";
import {
  createPane,
  killPane,
  waitForPrompt,
  sendKeys,
  SHELL_READY_MATCHER,
  AGENT_READY_MATCHER,
} from "./tmux.js";
import { logger } from "./logger.js";

const TRANSPORT_DIR = join(
  process.env.AGENT_COORD_DIR ??
    process.env.CLAUDE_COORD_DIR ??
    join(homedir(), "agent-coord"),
  "transports"
);

type Emit = (e: SpawnProgressEvent) => void;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

function progress(
  emit: Emit,
  agentId: string,
  step: SpawnStep,
  extra?: Partial<Omit<SpawnProgressEvent, "type" | "agentId" | "step">>
): void {
  emit({ type: "spawn_progress", agentId, step, ...extra });
}

async function isRegistered(agentId: string): Promise<boolean> {
  try {
    const raw = JSON.parse(
      await readFile(join(TRANSPORT_DIR, `${agentId}.json`), "utf8")
    ) as { agentId?: string };
    return raw.agentId === agentId;
  } catch {
    return false;
  }
}

async function waitForRegistration(
  agentId: string,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isRegistered(agentId)) return true;
    await sleep(500);
  }
  return false;
}

/**
 * Spawn a new agent pane, launch the agent process, configure it, and wait
 * for it to register on the coord bus.
 *
 * Emits a SpawnProgressEvent at each step. On any failure the pane is
 * killed (best-effort) and the error is re-thrown after emitting "error".
 */
export async function spawnAgent(
  preset: AgentPreset,
  req: SpawnAgentRequest,
  emit: Emit,
  opts: { timeoutMs?: number; registrationTimeoutMs?: number } = {}
): Promise<{ paneId: string }> {
  const { timeoutMs = 30_000, registrationTimeoutMs = 90_000 } = opts;
  const { agentId, paneKind = "split-window", paneTarget } = req;

  // 3.5 — name collision check
  if (await isRegistered(agentId)) {
    throw new Error(
      `Agent "${agentId}" is already registered (transport file exists)`
    );
  }

  progress(emit, agentId, "creating");
  const paneId = await createPane({
    kind: paneKind,
    target: paneTarget,
    cwd: preset.repoPath,
  });

  try {
    // Wait for shell, then send launch command
    progress(emit, agentId, "launching", { paneId });
    const shellReady = await waitForPrompt(paneId, SHELL_READY_MATCHER, {
      timeoutMs: 10_000,
    });
    if (!shellReady.ready) {
      throw new Error(
        `Shell not ready in pane ${paneId}. Last output: ${shellReady.tail.slice(-3).join(" | ")}`
      );
    }
    await sendKeys(paneId, preset.launchCmd + "\n");

    // Wait for agent UI, send /model
    progress(emit, agentId, "configuring", { paneId });
    const agentReady1 = await waitForPrompt(paneId, AGENT_READY_MATCHER, {
      timeoutMs,
    });
    if (!agentReady1.ready) {
      throw new Error(`Agent not ready after launch in pane ${paneId}`);
    }
    await sendKeys(paneId, `/model ${preset.model}\n`);

    // Wait for agent to finish /model switch.
    // After /model, AGENT_READY_MATCHER can fire on stale separator lines before
    // the TUI finishes re-rendering. A brief settle sleep prevents the skill from
    // being sent into a mid-transition TUI that silently discards keyboard input.
    const agentReady2 = await waitForPrompt(paneId, AGENT_READY_MATCHER, {
      timeoutMs: 15_000,
    });
    if (!agentReady2.ready) {
      throw new Error(`Agent not ready after /model in pane ${paneId}`);
    }
    await sleep(1_500);

    // Send skill invocation
    progress(emit, agentId, "joining", { paneId });
    const templateVars: Record<string, string> = {
      agentId,
      lane: preset.lane ?? "",
      rooms: preset.rooms?.join(",") ?? "",
      model: preset.model,
    };
    const skillCmd = resolveTemplate(preset.skillInvocation, templateVars);
    await sendKeys(paneId, skillCmd + "\n");

    // Poll transport dir for coord-bus registration.
    // We do NOT wait for AGENT_READY_MATCHER here — the input-box pattern is
    // unreliable while the skill startup is in progress (stale-capture false
    // positives, plus the skill itself may take 30–90 s to complete all its
    // MCP join/join_room/post_status calls).  The transport file is the
    // authoritative "registered" signal.
    progress(emit, agentId, "confirming", { paneId });
    const registered = await waitForRegistration(
      agentId,
      registrationTimeoutMs
    );
    if (!registered) {
      throw new Error(
        `Agent "${agentId}" did not register within ${registrationTimeoutMs / 1000} s`
      );
    }

    progress(emit, agentId, "done", { paneId });
    logger.info(
      { agentId, paneId },
      `spawned agent ${agentId} in pane ${paneId}`
    );
    return { paneId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    progress(emit, agentId, "error", { paneId, error: message });
    logger.error({ agentId, paneId, err }, `spawn failed for ${agentId}`);
    try {
      await killPane(paneId);
    } catch {
      // pane may already be gone
    }
    throw err;
  }
}

/**
 * Gracefully stop an agent: send /quit, wait briefly, then kill the pane.
 * Best-effort — never throws.
 */
export async function teardownAgent(
  agentId: string,
  paneId: string,
  emit: Emit,
  opts: { gracefulWaitMs?: number } = {}
): Promise<void> {
  const { gracefulWaitMs = 2_000 } = opts;
  progress(emit, agentId, "configuring", {
    paneId,
    message: "sending graceful stop",
  });
  try {
    await sendKeys(paneId, "/quit\n");
    await sleep(gracefulWaitMs);
  } catch {
    // pane may already be dead
  }
  try {
    await killPane(paneId);
  } catch {
    // best-effort
  }
  logger.info(
    { agentId, paneId },
    `tore down agent ${agentId} (pane ${paneId})`
  );
  progress(emit, agentId, "done", { paneId });
}
