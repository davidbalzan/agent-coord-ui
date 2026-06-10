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

/**
 * The tmux session used as the default spawn target when no paneTarget is
 * specified for split-window / new-window. Overridable via env so operators
 * running multiple coord instances can isolate their spawns.
 */
export const HOME_SESSION =
  process.env.AGENT_COORD_HOME_SESSION ?? "agent-coord-ui";

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

// ─── Pane lifecycle ───────────────────────────────────────────────────────────

function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''");
}

export type PaneKind = "split-window" | "new-window" | "new-session";

export interface CreatePaneOpts {
  kind: PaneKind;
  /** tmux target (session, window, or pane) for split-window / new-window */
  target?: string;
  /** working directory for the new pane */
  cwd?: string;
}

/**
 * Ensure the named tmux session exists, creating it detached if not.
 * Used to guarantee the home session is present before splitting into it.
 */
export async function ensureHomeSession(
  name: string = HOME_SESSION
): Promise<void> {
  try {
    await execAsync(`tmux has-session -t '${shellEscape(name)}'`);
  } catch {
    // Session absent — create detached
    await execAsync(`tmux new-session -d -s '${shellEscape(name)}'`);
  }
}

/**
 * Create a tmux pane and return its pane id (e.g. "%12").
 * Injection-safe: target and cwd are single-quote-escaped before interpolation.
 *
 * For split-window / new-window: if no target is given, defaults to HOME_SESSION
 * (creating it if absent) so spawns never inherit the operator's active session.
 */
export async function createPane(opts: CreatePaneOpts): Promise<string> {
  const { kind, cwd } = opts;
  let { target } = opts;
  const cwdFlag = cwd ? ` -c '${shellEscape(cwd)}'` : "";
  let cmd: string;
  if (kind === "split-window") {
    if (!target) {
      await ensureHomeSession();
      target = HOME_SESSION;
    }
    cmd = `tmux split-window -t '${shellEscape(target)}'${cwdFlag} -P -F '#{pane_id}'`;
  } else if (kind === "new-window") {
    if (!target) {
      await ensureHomeSession();
      target = HOME_SESSION;
    }
    cmd = `tmux new-window -t '${shellEscape(target)}'${cwdFlag} -P -F '#{pane_id}'`;
  } else {
    // new-session: -d so it starts detached; target used as session name (-s)
    const sessionFlag = target ? ` -s '${shellEscape(target)}'` : "";
    cmd = `tmux new-session -d${sessionFlag}${cwdFlag} -P -F '#{pane_id}'`;
  }
  const { stdout } = await execAsync(cmd);
  const paneId = stdout.trim();
  if (!paneId) throw new Error(`createPane: tmux returned empty pane id`);
  return paneId;
}

/** Kill a tmux pane by id. */
export async function killPane(paneId: string): Promise<void> {
  await execAsync(`tmux kill-pane -t '${shellEscape(paneId)}'`);
}

// ─── Prompt-readiness detection ───────────────────────────────────────────────

export type PromptMatcher = (tail: string[]) => boolean;

/**
 * Matches a shell prompt at end-of-line.
 * Covers: bash ($), zsh vanilla (%), pure/powerlevel10k (❯ U+276F), and
 * Powerlevel10k heavy-arrow (➜ U+279C) used in David's zsh config.
 */
export const SHELL_READY_MATCHER: PromptMatcher = (lines) =>
  lines.some((l) => /[$%❯➜]\s*$/.test(l.trimEnd()));

/**
 * Matches the Claude Code TUI when it is ready for keyboard input.
 * Covers two states:
 *   - Initialising: "✻ Initializ…" spinner line
 *   - Idle/ready: the input box rendered as a line of ─ box-drawing chars
 *     (≥10 consecutive), OR the "⏵⏵ bypass permissions" footer line that
 *     appears below the ❯ input cursor in Claude Code ≥2.1.
 * Legacy patterns (╭─╮, Human:, Esc to interrupt) retained for older versions.
 */
export const AGENT_READY_MATCHER: PromptMatcher = (lines) =>
  lines.some((l) =>
    /✻ Initializ|─{10,}|⏵⏵|bypass permissions|Human:|Esc to interrupt|╭─+╮|claude>/i.test(
      l
    )
  );

export interface WaitForPromptResult {
  ready: boolean;
  tail: string[];
}

/**
 * Poll capturePane until matcher returns true or timeoutMs elapses.
 * Never throws — on timeout returns { ready: false, tail: <last captured lines> }.
 */
export async function waitForPrompt(
  paneId: string,
  matcher: PromptMatcher,
  opts: { timeoutMs: number; intervalMs?: number }
): Promise<WaitForPromptResult> {
  const { timeoutMs, intervalMs = 400 } = opts;
  const deadline = Date.now() + timeoutMs;
  let tail: string[] = [];
  while (Date.now() < deadline) {
    tail = await capturePane(paneId, 20);
    if (matcher(tail)) return { ready: true, tail };
    await new Promise<void>((r) => setTimeout(r, intervalMs));
  }
  return { ready: false, tail };
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
    return Promise.all(
      raws.map(async (raw) => {
        const lines = await capturePane(raw.id, CAPTURE_LINES);
        return {
          ...raw,
          lastActivity: this.prev.get(raw.id)?.lastActivity ?? Date.now(),
          agentId: agentIds
            ? this.matchAgent(raw.id, raw.title, lines, agentIds, transportMap)
            : undefined,
          lines,
        };
      })
    );
  }

  async diff(agentIds?: string[]): Promise<void> {
    if (!this.available) return;
    const [raws, transportMap] = await Promise.all([
      listPanes(),
      loadTransportMap(),
    ]);
    const next = new Map<string, PaneSnapshot>();

    const snaps = await Promise.all(
      raws.map(async (raw) => {
        const prev = this.prev.get(raw.id);
        const lines = await capturePane(raw.id, CAPTURE_LINES);
        const contentChanged = prev
          ? lines.join("\n") !== prev.lines.join("\n")
          : true;
        const agentId = agentIds
          ? this.matchAgent(raw.id, raw.title, lines, agentIds, transportMap)
          : undefined;
        return {
          snap: {
            ...raw,
            lastActivity: contentChanged
              ? Date.now()
              : (prev?.lastActivity ?? Date.now()),
            agentId,
            lines,
          } as PaneSnapshot,
          prev,
          contentChanged,
        };
      })
    );

    for (const { snap, prev, contentChanged } of snaps) {
      next.set(snap.id, snap);
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
