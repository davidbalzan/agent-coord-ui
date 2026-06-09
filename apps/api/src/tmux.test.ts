import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BusEvent } from "@coord-ui/shared";

// Set transport dir to a predictable path before module load
process.env.AGENT_COORD_DIR = "/tmp/test-coord";

const TRANSPORT_DIR = "/tmp/test-coord/transports";

// ─── Module mocks (hoisted before imports) ────────────────────────────────────

// exec mock — configurable per test via execImpl
let execImpl: (cmd: string) => string = () => "";

vi.mock("node:child_process", async () => {
  const { promisify } = await import("node:util");
  // Must add util.promisify.custom so promisify returns { stdout, stderr }
  // (matching the real exec behaviour) rather than a plain string.
  const exec = (
    cmd: string,
    cb: (err: null | Error, stdout: string, stderr: string) => void
  ) => {
    try {
      cb(null, execImpl(cmd), "");
    } catch (err) {
      cb(err as Error, "", "");
    }
  };
  (exec as unknown as Record<symbol, unknown>)[promisify.custom] = (
    cmd: string
  ) => Promise.resolve({ stdout: execImpl(cmd), stderr: "" });
  return { exec };
});

// fs/promises mock — configurable per test
let readdirFiles: string[] = [];
const readFileContents = new Map<string, string>();

vi.mock("node:fs/promises", () => ({
  readdir: () => Promise.resolve(readdirFiles),
  readFile: (path: string) => {
    const content = readFileContents.get(path);
    if (content === undefined)
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    return Promise.resolve(content);
  },
}));

vi.mock("./logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

const { TmuxWatcher } = await import("./tmux.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a tab-delimited list-panes output line. */
function paneRow(
  overrides: {
    id?: string;
    pid?: number;
    title?: string;
    command?: string;
    session?: string;
    window?: number;
    pane?: number;
    active?: string;
    cwd?: string;
  } = {}
): string {
  const d = {
    id: "main:0.0",
    pid: 1000,
    title: "",
    command: "zsh",
    session: "main",
    window: 0,
    pane: 0,
    active: "1",
    cwd: "/home/user",
    ...overrides,
  };
  // left top width height all zero — not relevant for these tests
  return [
    d.id,
    d.pid,
    d.title,
    d.command,
    d.session,
    d.window,
    d.pane,
    d.active,
    d.cwd,
    0,
    0,
    220,
    50,
  ].join("\t");
}

/** Configure execImpl: list-panes returns rows, capture-pane returns content. */
function setupExec(rows: string[], captureContent = "output line\n") {
  execImpl = (cmd: string) => {
    if (cmd.includes("list-panes")) return rows.join("\n") + "\n";
    if (cmd.includes("capture-pane")) return captureContent;
    if (cmd.includes("tmux -V")) return "tmux 3.3a\n";
    return "";
  };
}

/** Collect events emitted by a watcher.diff() call. */
async function collectEvents(
  watcher: InstanceType<typeof TmuxWatcher>,
  agentIds?: string[]
): Promise<BusEvent[]> {
  const events: BusEvent[] = [];
  const unsub = watcher.subscribe((e) => events.push(e));
  await watcher.diff(agentIds);
  unsub();
  return events;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TmuxWatcher.diff — change detection", () => {
  let watcher: InstanceType<typeof TmuxWatcher>;

  beforeEach(() => {
    watcher = new TmuxWatcher();
    // Bypass isTmuxAvailable — mark as available directly
    (watcher as unknown as { available: boolean }).available = true;
    readdirFiles = [];
    readFileContents.clear();
  });

  it("first diff always emits pane_update for each pane", async () => {
    setupExec([paneRow({ id: "main:0.0" })]);
    const events = await collectEvents(watcher);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "pane_update",
      pane: { id: "main:0.0" },
    });
  });

  it("second diff with identical content emits nothing", async () => {
    setupExec([paneRow({ id: "main:0.0" })], "same content\n");
    await collectEvents(watcher); // seed prev state
    const events = await collectEvents(watcher);
    expect(events).toHaveLength(0);
  });

  it("content change triggers pane_update with fresh lastActivity", async () => {
    setupExec([paneRow({ id: "main:0.0" })], "before\n");
    await collectEvents(watcher);

    const before = Date.now();
    setupExec([paneRow({ id: "main:0.0" })], "after — content changed\n");
    const events = await collectEvents(watcher);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "pane_update" });
    const snap = (events[0] as Extract<BusEvent, { type: "pane_update" }>).pane;
    expect(snap.lastActivity).toBeGreaterThanOrEqual(before);
  });

  it("active flag change triggers pane_update even with same content", async () => {
    setupExec([paneRow({ id: "main:0.0", active: "1" })], "static content\n");
    await collectEvents(watcher);

    setupExec([paneRow({ id: "main:0.0", active: "0" })], "static content\n");
    const events = await collectEvents(watcher);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "pane_update" });
  });

  it("command change triggers pane_update", async () => {
    setupExec([paneRow({ id: "main:0.0", command: "zsh" })], "same\n");
    await collectEvents(watcher);

    setupExec([paneRow({ id: "main:0.0", command: "node" })], "same\n");
    const events = await collectEvents(watcher);
    expect(events).toHaveLength(1);
  });

  it("removed pane emits pane_remove", async () => {
    setupExec([paneRow({ id: "main:0.0" })]);
    await collectEvents(watcher);

    setupExec([]); // pane gone
    const events = await collectEvents(watcher);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "pane_remove",
      paneId: "main:0.0",
    });
  });

  it("new pane appears alongside existing one", async () => {
    setupExec([paneRow({ id: "main:0.0" })], "stable\n");
    await collectEvents(watcher);

    // Same capture content for main:0.0 so it doesn't re-emit; main:0.1 is new
    setupExec(
      [paneRow({ id: "main:0.0" }), paneRow({ id: "main:0.1" })],
      "stable\n"
    );
    const events = await collectEvents(watcher);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "pane_update",
      pane: { id: "main:0.1" },
    });
  });
});

describe("TmuxWatcher — matchAgent strategies", () => {
  let watcher: InstanceType<typeof TmuxWatcher>;

  beforeEach(() => {
    watcher = new TmuxWatcher();
    (watcher as unknown as { available: boolean }).available = true;
    readdirFiles = [];
    readFileContents.clear();
  });

  it("strategy 0: transport file match overrides title match", async () => {
    // Title contains "agent-a", but transport maps pane to "agent-b"
    readdirFiles = ["agent-b.json"];
    readFileContents.set(
      `${TRANSPORT_DIR}/agent-b.json`,
      JSON.stringify({ agentId: "agent-b", tmuxTarget: "main:0.0" })
    );
    setupExec([paneRow({ id: "main:0.0", title: "agent-a" })], "");

    const events = await collectEvents(watcher, ["agent-a", "agent-b"]);
    expect(
      (events[0] as Extract<BusEvent, { type: "pane_update" }>).pane.agentId
    ).toBe("agent-b");
  });

  it("strategy 0: transport agentId must be in the known agent list", async () => {
    // Transport maps to "agent-unknown" which isn't registered
    readdirFiles = ["agent-unknown.json"];
    readFileContents.set(
      `${TRANSPORT_DIR}/agent-unknown.json`,
      JSON.stringify({ agentId: "agent-unknown", tmuxTarget: "main:0.0" })
    );
    setupExec([paneRow({ id: "main:0.0", title: "agent-known" })], "");

    const events = await collectEvents(watcher, ["agent-known"]);
    // Falls through to strategy 1 — title match
    expect(
      (events[0] as Extract<BusEvent, { type: "pane_update" }>).pane.agentId
    ).toBe("agent-known");
  });

  it("strategy 1: title match when no transport entry", async () => {
    setupExec(
      [paneRow({ id: "main:0.0", title: "agent-foo pane" })],
      "no match here\n"
    );

    const events = await collectEvents(watcher, ["agent-foo", "agent-bar"]);
    expect(
      (events[0] as Extract<BusEvent, { type: "pane_update" }>).pane.agentId
    ).toBe("agent-foo");
  });

  it("strategy 2: scrollback content match when title has no match", async () => {
    setupExec(
      [paneRow({ id: "main:0.0", title: "zsh" })],
      "starting agent-baz...\nready\n"
    );

    const events = await collectEvents(watcher, ["agent-baz"]);
    expect(
      (events[0] as Extract<BusEvent, { type: "pane_update" }>).pane.agentId
    ).toBe("agent-baz");
  });

  it("longest agent id matched first to avoid prefix collisions", async () => {
    // "agent-1" is a prefix of "agent-10" — title contains "agent-10"
    // Without longest-first, "agent-1" would match first
    setupExec([paneRow({ id: "main:0.0", title: "agent-10 session" })], "");

    const events = await collectEvents(watcher, ["agent-1", "agent-10"]);
    expect(
      (events[0] as Extract<BusEvent, { type: "pane_update" }>).pane.agentId
    ).toBe("agent-10");
  });

  it("no match returns undefined agentId", async () => {
    setupExec([paneRow({ id: "main:0.0", title: "bash" })], "nothing useful\n");

    const events = await collectEvents(watcher, ["agent-xyz"]);
    expect(
      (events[0] as Extract<BusEvent, { type: "pane_update" }>).pane.agentId
    ).toBeUndefined();
  });

  it("agentId changes when transport is updated between diffs", async () => {
    // First diff: no transport
    setupExec([paneRow({ id: "main:0.0", title: "" })], "no agent here\n");
    await collectEvents(watcher, ["agent-q"]);

    // Second diff: transport file now maps pane to agent-q
    readdirFiles = ["agent-q.json"];
    readFileContents.set(
      `${TRANSPORT_DIR}/agent-q.json`,
      JSON.stringify({ agentId: "agent-q", tmuxTarget: "main:0.0" })
    );
    setupExec([paneRow({ id: "main:0.0", title: "" })], "no agent here\n");
    const events = await collectEvents(watcher, ["agent-q"]);

    // agentId changed from undefined → "agent-q" → pane_update emitted
    expect(events).toHaveLength(1);
    expect(
      (events[0] as Extract<BusEvent, { type: "pane_update" }>).pane.agentId
    ).toBe("agent-q");
  });
});
