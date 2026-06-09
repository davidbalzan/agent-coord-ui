import { exec } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { PaneSnapshot, BusEvent } from "@coord-ui/shared";
import { logger } from "./logger.js";

const TRANSPORT_DIR = join(
  process.env.AGENT_COORD_DIR ??
    process.env.CLAUDE_COORD_DIR ??
    join(homedir(), "agent-coord"),
  "transports"
);

// Reads ~/agent-coord/transports/*.json and returns a map of tmuxTarget → agentId.
// This is the authoritative source — each agent writes its own pane target on attach.
async function loadTransportMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const files = await readdir(TRANSPORT_DIR);
    await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          try {
            const raw = JSON.parse(
              await readFile(join(TRANSPORT_DIR, f), "utf8")
            ) as {
              agentId?: string;
              tmuxTarget?: string;
            };
            if (raw.agentId && raw.tmuxTarget)
              map.set(raw.tmuxTarget, raw.agentId);
          } catch {
            // malformed — skip
          }
        })
    );
  } catch {
    // transports dir doesn't exist yet
  }
  return map;
}

const execAsync = promisify(exec);

// Lines to capture per pane for the "preview" snapshot
const CAPTURE_LINES = 100;

// ─── tmux helpers ────────────────────────────────────────────────────────────

async function isTmuxAvailable(): Promise<boolean> {
  try {
    await execAsync("tmux -V");
    return true;
  } catch {
    return false;
  }
}

interface RawPane {
  id: string;
  pid: number;
  title: string;
  command: string;
  session: string;
  window: number;
  pane: number;
  active: boolean;
  cwd: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

async function listPanes(): Promise<RawPane[]> {
  // Format: session:window.pane \t pid \t title \t command \t session \t window \t pane \t active \t cwd
  const fmt = [
    "#{session_name}:#{window_index}.#{pane_index}",
    "#{pane_pid}",
    "#{pane_title}",
    "#{pane_current_command}",
    "#{session_name}",
    "#{window_index}",
    "#{pane_index}",
    "#{pane_active}",
    "#{pane_current_path}",
    "#{pane_left}",
    "#{pane_top}",
    "#{pane_width}",
    "#{pane_height}",
  ].join("\t");

  try {
    const { stdout } = await execAsync(`tmux list-panes -a -F '${fmt}'`);
    return stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [
          id,
          pid,
          title,
          command,
          session,
          window,
          pane,
          active,
          cwd,
          left,
          top,
          width,
          height,
        ] = line.split("\t");
        return {
          id: id ?? "",
          pid: parseInt(pid ?? "0", 10),
          title: title ?? "",
          command: command ?? "",
          session: session ?? "",
          window: parseInt(window ?? "0", 10),
          pane: parseInt(pane ?? "0", 10),
          active: active?.trim() === "1",
          cwd: cwd?.trim() ?? "",
          left: parseInt(left ?? "0", 10),
          top: parseInt(top ?? "0", 10),
          width: parseInt(width ?? "0", 10),
          height: parseInt(height ?? "0", 10),
        };
      });
  } catch {
    return [];
  }
}

// Capture plain-text content of a pane (strips ANSI for the snapshot preview)
export async function capturePane(
  paneId: string,
  lines: number
): Promise<string[]> {
  try {
    // -p: print to stdout, -S -N: start N lines from bottom, no ANSI (-e omitted)
    const { stdout } = await execAsync(
      `tmux capture-pane -t '${paneId}' -p -S -${lines}`
    );
    return stdout.split("\n").slice(0, lines);
  } catch {
    return [];
  }
}

// Capture with ANSI codes — used for the live xterm.js stream
export async function capturePaneAnsi(
  paneId: string,
  lines = 200
): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `tmux capture-pane -t '${paneId}' -p -e -S -${lines}`
    );
    return stdout;
  } catch {
    return "";
  }
}

// Send keys to a pane. Newlines are converted to Enter presses.
export async function sendKeys(paneId: string, keys: string): Promise<void> {
  // send-keys interprets special keys like Enter; we escape the text first
  // and send Enter separately when we see \n
  const segments = keys.split("\n");
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] ?? "";
    if (seg.length > 0) {
      // Escape single quotes in the text
      const escaped = seg.replace(/'/g, "'\\''");
      await execAsync(`tmux send-keys -t '${paneId}' '${escaped}'`);
    }
    if (i < segments.length - 1) {
      await execAsync(`tmux send-keys -t '${paneId}' Enter`);
    }
  }
}

// ─── Pane watcher ─────────────────────────────────────────────────────────────

type Listener = (event: BusEvent) => void;

export class TmuxWatcher {
  private listeners = new Set<Listener>();
  private prev = new Map<string, PaneSnapshot>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private available = false;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(event: BusEvent) {
    for (const fn of this.listeners) fn(event);
  }

  async init(): Promise<void> {
    this.available = await isTmuxAvailable();
    if (!this.available) {
      logger.warn("tmux not found — pane monitoring disabled");
    }
  }

  // Match a pane to a registered agent.
  // Strategy 0: transport file (agent-reported tmuxTarget — authoritative, no false positives)
  // Strategy 1: pane title (set by Claude Code / agent tooling — fast, reliable)
  // Strategy 2: scan scrollback content (catches anything printed at startup)
  // Longest ID first on strategies 1+2 to avoid "agent-1" matching before "agent-10".
  private matchAgent(
    paneId: string,
    title: string,
    lines: string[],
    agentIds: string[],
    transportMap: Map<string, string>
  ): string | undefined {
    const fromTransport = transportMap.get(paneId);
    if (fromTransport && agentIds.includes(fromTransport)) return fromTransport;
    const sorted = [...agentIds].sort((a, b) => b.length - a.length);
    const titleMatch = sorted.find((id) => title.includes(id));
    if (titleMatch) return titleMatch;
    const haystack = lines.join("\n");
    return sorted.find((id) => haystack.includes(id));
  }

  async snapshot(agentIds?: string[]): Promise<PaneSnapshot[]> {
    if (!this.available) return [];
    const [raws, transportMap] = await Promise.all([
      listPanes(),
      loadTransportMap(),
    ]);
    const panes: PaneSnapshot[] = [];
    for (const raw of raws) {
      const lines = await capturePane(raw.id, CAPTURE_LINES);
      panes.push({
        ...raw,
        lastActivity: this.prev.get(raw.id)?.lastActivity ?? Date.now(),
        agentId: agentIds
          ? this.matchAgent(raw.id, raw.title, lines, agentIds, transportMap)
          : undefined,
        lines,
      });
    }
    return panes;
  }

  async diff(agentIds?: string[]): Promise<void> {
    if (!this.available) return;
    const [raws, transportMap] = await Promise.all([
      listPanes(),
      loadTransportMap(),
    ]);
    const next = new Map<string, PaneSnapshot>();

    for (const raw of raws) {
      const prev = this.prev.get(raw.id);
      const lines = await capturePane(raw.id, CAPTURE_LINES);
      const contentChanged = prev
        ? lines.join("\n") !== prev.lines.join("\n")
        : true;

      const agentId = agentIds
        ? this.matchAgent(raw.id, raw.title, lines, agentIds, transportMap)
        : undefined;

      const snap: PaneSnapshot = {
        ...raw,
        lastActivity: contentChanged
          ? Date.now()
          : (prev?.lastActivity ?? Date.now()),
        agentId,
        lines,
      };
      next.set(raw.id, snap);

      const hasChanged =
        !prev ||
        contentChanged ||
        prev.active !== snap.active ||
        prev.command !== snap.command ||
        prev.agentId !== snap.agentId;

      if (hasChanged) {
        this.emit({ type: "pane_update", pane: snap });
      }
    }

    // Removed panes
    for (const id of this.prev.keys()) {
      if (!next.has(id)) {
        this.emit({ type: "pane_remove", paneId: id });
      }
    }

    this.prev = next;
  }

  start(getAgentIds?: () => string[]) {
    if (!this.available) return;
    this.timer = setInterval(() => {
      this.diff(getAgentIds?.()).catch((err) =>
        logger.error({ err }, "tmux watcher diff error")
      );
    }, 2000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  get panes(): PaneSnapshot[] {
    return Array.from(this.prev.values());
  }
}

export const tmuxWatcher = new TmuxWatcher();
