import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { AgentPreset } from "@coord-ui/shared";
import { logger } from "./logger.js";

const PRESETS_FILE = join(
  process.env.AGENT_COORD_DIR ??
    process.env.CLAUDE_COORD_DIR ??
    join(homedir(), "agent-coord"),
  "presets.json"
);

const DEFAULT_PRESETS: AgentPreset[] = [
  {
    id: "coordinator-default",
    label: "Coordinator",
    model: "claude-sonnet-4-6",
    role: "coordinator",
    launchCmd: "claude",
    skillInvocation: "/coordinator --id={agentId}",
  },
  {
    id: "worker-default",
    label: "Worker (repo-owner)",
    model: "claude-sonnet-4-6",
    role: "worker",
    lane: "repo-owner",
    launchCmd: "claude",
    skillInvocation: "/coord-worker --id={agentId} --lane={lane}",
  },
];

export async function loadPresets(): Promise<AgentPreset[]> {
  try {
    const raw = await readFile(PRESETS_FILE, "utf8");
    const parsed = JSON.parse(raw) as AgentPreset[];
    if (!Array.isArray(parsed)) return DEFAULT_PRESETS;
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn({ err }, "failed to read presets, using defaults");
    }
    return DEFAULT_PRESETS;
  }
}

export async function savePresets(presets: AgentPreset[]): Promise<void> {
  await mkdir(dirname(PRESETS_FILE), { recursive: true });
  await writeFile(PRESETS_FILE, JSON.stringify(presets, null, 2), "utf8");
}

export { DEFAULT_PRESETS };
