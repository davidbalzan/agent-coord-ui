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

const {
  TmuxWatcher,
  createPane,
  killPane,
  waitForPrompt,
  ensureHomeSession,
  HOME_SESSION,
  SHELL_READY_MATCHER,
  AGENT_READY_MATCHER,
} = await import("./tmux.js");

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

// ─── createPane / killPane ────────────────────────────────────────────────────

describe("createPane", () => {
  beforeEach(() => {
    readdirFiles = [];
    readFileContents.clear();
  });

  it("split-window: issues correct command and returns pane id", async () => {
    const issuedCmds: string[] = [];
    execImpl = (cmd) => {
      issuedCmds.push(cmd);
      if (cmd.includes("split-window")) return "%7\n";
      if (cmd.includes("tmux -V")) return "tmux 3.3a\n";
      return "";
    };
    const id = await createPane({ kind: "split-window", target: "main:0.0" });
    expect(id).toBe("%7");
    expect(issuedCmds.some((c) => c.includes("split-window"))).toBe(true);
    expect(issuedCmds.some((c) => c.includes("-t 'main:0.0'"))).toBe(true);
    expect(issuedCmds.some((c) => c.includes("-P -F '#{pane_id}'"))).toBe(true);
  });

  it("new-window: issues tmux new-window command", async () => {
    const issuedCmds: string[] = [];
    execImpl = (cmd) => {
      issuedCmds.push(cmd);
      return cmd.includes("new-window") ? "%8\n" : "";
    };
    const id = await createPane({
      kind: "new-window",
      target: "main",
      cwd: "/home/user/project",
    });
    expect(id).toBe("%8");
    expect(issuedCmds.some((c) => c.includes("new-window"))).toBe(true);
    expect(issuedCmds.some((c) => c.includes("-c '/home/user/project'"))).toBe(
      true
    );
  });

  it("new-session: issues tmux new-session -d command", async () => {
    const issuedCmds: string[] = [];
    execImpl = (cmd) => {
      issuedCmds.push(cmd);
      return cmd.includes("new-session") ? "%9\n" : "";
    };
    const id = await createPane({ kind: "new-session" });
    expect(id).toBe("%9");
    expect(
      issuedCmds.some((c) => c.includes("new-session") && c.includes("-d"))
    ).toBe(true);
  });

  it("new-session with target: passes -s <name> flag", async () => {
    const issuedCmds: string[] = [];
    execImpl = (cmd) => {
      issuedCmds.push(cmd);
      return cmd.includes("new-session") ? "%10\n" : "";
    };
    const id = await createPane({ kind: "new-session", target: "my-agents" });
    expect(id).toBe("%10");
    expect(
      issuedCmds.some(
        (c) => c.includes("new-session") && c.includes("-s 'my-agents'")
      )
    ).toBe(true);
  });

  it("escapes single quotes in target to prevent injection", async () => {
    const issuedCmds: string[] = [];
    execImpl = (cmd) => {
      issuedCmds.push(cmd);
      return cmd.includes("split-window") ? "%10\n" : "";
    };
    await createPane({ kind: "split-window", target: "bad'session:0.0" });
    // The single quote in target must be escaped as '\''
    expect(issuedCmds.some((c) => c.includes("bad'\\''session"))).toBe(true);
  });

  it("escapes single quotes in cwd to prevent injection", async () => {
    const issuedCmds: string[] = [];
    execImpl = (cmd) => {
      issuedCmds.push(cmd);
      return cmd.includes("split-window") ? "%11\n" : "";
    };
    await createPane({ kind: "split-window", cwd: "/path/with'quote" });
    expect(issuedCmds.some((c) => c.includes("/path/with'\\''quote"))).toBe(
      true
    );
  });

  it("throws when tmux returns empty pane id", async () => {
    execImpl = () => ""; // stdout is blank
    await expect(
      createPane({ kind: "split-window", target: "some-session" })
    ).rejects.toThrow("empty pane id");
  });

  // ── Home-session default (blank target must never inherit active session) ──

  it("blank split-window target defaults to HOME_SESSION", async () => {
    const issuedCmds: string[] = [];
    execImpl = (cmd) => {
      issuedCmds.push(cmd);
      if (cmd.includes("has-session")) return ""; // session exists
      if (cmd.includes("split-window")) return "%20\n";
      return "";
    };
    const id = await createPane({ kind: "split-window" });
    expect(id).toBe("%20");
    const splitCmd = issuedCmds.find((c) => c.includes("split-window"))!;
    expect(splitCmd).toMatch(new RegExp(`-t '${HOME_SESSION}'`));
  });

  it("blank new-window target defaults to HOME_SESSION", async () => {
    const issuedCmds: string[] = [];
    execImpl = (cmd) => {
      issuedCmds.push(cmd);
      if (cmd.includes("has-session")) return "";
      if (cmd.includes("new-window")) return "%21\n";
      return "";
    };
    const id = await createPane({ kind: "new-window" });
    expect(id).toBe("%21");
    const newWinCmd = issuedCmds.find((c) => c.includes("new-window"))!;
    expect(newWinCmd).toMatch(new RegExp(`-t '${HOME_SESSION}'`));
  });

  it("auto-creates home session when missing before split-window", async () => {
    const issuedCmds: string[] = [];
    execImpl = (cmd) => {
      issuedCmds.push(cmd);
      if (cmd.includes("has-session"))
        throw new Error("can't find session: agent-coord-ui");
      if (cmd.includes("new-session")) return ""; // creation succeeds
      if (cmd.includes("split-window")) return "%22\n";
      return "";
    };
    await createPane({ kind: "split-window" });
    expect(issuedCmds.some((c) => c.includes("has-session"))).toBe(true);
    expect(
      issuedCmds.some(
        (c) => c.includes("new-session") && c.includes(`'${HOME_SESSION}'`)
      )
    ).toBe(true);
    expect(issuedCmds.some((c) => c.includes("split-window"))).toBe(true);
  });

  it("explicit target is used as-is without touching home session", async () => {
    const issuedCmds: string[] = [];
    execImpl = (cmd) => {
      issuedCmds.push(cmd);
      return cmd.includes("split-window") ? "%23\n" : "";
    };
    const id = await createPane({
      kind: "split-window",
      target: "myproject:1",
    });
    expect(id).toBe("%23");
    const splitCmd = issuedCmds.find((c) => c.includes("split-window"))!;
    expect(splitCmd).toContain("myproject:1");
    expect(issuedCmds.some((c) => c.includes("has-session"))).toBe(false);
  });
});

describe("ensureHomeSession", () => {
  beforeEach(() => {
    execImpl = () => "";
  });

  it("does nothing when session already exists", async () => {
    const issuedCmds: string[] = [];
    execImpl = (cmd) => {
      issuedCmds.push(cmd);
      return "";
    };
    await ensureHomeSession("my-session");
    expect(issuedCmds).toHaveLength(1);
    expect(issuedCmds[0]).toMatch(/has-session.*'my-session'/);
  });

  it("creates session when has-session fails", async () => {
    const issuedCmds: string[] = [];
    execImpl = (cmd) => {
      issuedCmds.push(cmd);
      if (cmd.includes("has-session")) throw new Error("no session");
      return "";
    };
    await ensureHomeSession("new-home");
    expect(issuedCmds.some((c) => c.includes("has-session"))).toBe(true);
    expect(
      issuedCmds.some(
        (c) => c.includes("new-session") && c.includes("'new-home'")
      )
    ).toBe(true);
  });

  it("defaults to HOME_SESSION when no name given", async () => {
    const issuedCmds: string[] = [];
    execImpl = (cmd) => {
      issuedCmds.push(cmd);
      return "";
    };
    await ensureHomeSession();
    expect(issuedCmds[0]).toContain(HOME_SESSION);
  });
});

describe("killPane", () => {
  it("issues tmux kill-pane -t with the pane id", async () => {
    const issuedCmds: string[] = [];
    execImpl = (cmd) => {
      issuedCmds.push(cmd);
      return "";
    };
    await killPane("main:0.1");
    expect(
      issuedCmds.some(
        (c) => c.includes("kill-pane") && c.includes("'main:0.1'")
      )
    ).toBe(true);
  });

  it("escapes single quotes in pane id", async () => {
    const issuedCmds: string[] = [];
    execImpl = (cmd) => {
      issuedCmds.push(cmd);
      return "";
    };
    await killPane("bad'pane");
    expect(issuedCmds.some((c) => c.includes("bad'\\''pane"))).toBe(true);
  });
});

// ─── waitForPrompt ────────────────────────────────────────────────────────────

describe("waitForPrompt", () => {
  it("returns ready=true immediately when matcher matches first capture", async () => {
    execImpl = (cmd) => {
      if (cmd.includes("capture-pane")) return "user@host:~$ \n";
      return "";
    };
    const result = await waitForPrompt("%5", SHELL_READY_MATCHER, {
      timeoutMs: 1000,
      intervalMs: 1,
    });
    expect(result.ready).toBe(true);
    expect(result.tail.length).toBeGreaterThan(0);
  });

  it("polls until matcher succeeds then returns ready=true", async () => {
    let calls = 0;
    execImpl = (cmd) => {
      if (cmd.includes("capture-pane")) {
        calls++;
        return calls >= 3 ? "❯ \n" : "loading...\n";
      }
      return "";
    };
    const result = await waitForPrompt("%5", SHELL_READY_MATCHER, {
      timeoutMs: 2000,
      intervalMs: 1,
    });
    expect(result.ready).toBe(true);
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it("returns ready=false with last tail when timeout elapses", async () => {
    execImpl = (cmd) => {
      if (cmd.includes("capture-pane")) return "still booting...\n";
      return "";
    };
    const result = await waitForPrompt("%5", SHELL_READY_MATCHER, {
      timeoutMs: 10,
      intervalMs: 1,
    });
    expect(result.ready).toBe(false);
    expect(result.tail).toContain("still booting...");
  });

  it("never throws on timeout", async () => {
    execImpl = () => ""; // capture-pane returns empty — no match ever
    await expect(
      waitForPrompt("%5", SHELL_READY_MATCHER, { timeoutMs: 5, intervalMs: 1 })
    ).resolves.toMatchObject({ ready: false });
  });
});

// ─── Built-in matchers ────────────────────────────────────────────────────────

describe("SHELL_READY_MATCHER", () => {
  it("matches $ at end of line", () => {
    expect(SHELL_READY_MATCHER(["user@host:~$ "])).toBe(true);
  });

  it("matches % at end of line", () => {
    expect(SHELL_READY_MATCHER(["zsh% "])).toBe(true);
  });

  it("matches ❯ at end of line", () => {
    expect(SHELL_READY_MATCHER(["❯ "])).toBe(true);
  });

  it("matches ➜ (U+279C, Powerlevel10k zsh prompt) at end of line", () => {
    expect(SHELL_READY_MATCHER(["🕐 10:22:37➜"])).toBe(true);
  });

  it("matches ➜ with trailing space", () => {
    expect(SHELL_READY_MATCHER(["🕐 10:22:37➜ "])).toBe(true);
  });

  it("does not match mid-line prompt characters", () => {
    expect(SHELL_READY_MATCHER(["echo $HOME"])).toBe(false);
  });
});

describe("AGENT_READY_MATCHER", () => {
  it("matches 'Human:' banner line", () => {
    expect(AGENT_READY_MATCHER(["╭── Human: ──╮"])).toBe(true);
  });

  it("matches 'Esc to interrupt' hint", () => {
    expect(AGENT_READY_MATCHER(["Esc to interrupt"])).toBe(true);
  });

  it("matches '✻ Initializ' startup line", () => {
    expect(AGENT_READY_MATCHER(["✻ Initializing..."])).toBe(true);
  });

  it("matches long ─ box-drawing line (Claude Code ≥2.1 input box border)", () => {
    expect(
      AGENT_READY_MATCHER([
        "────────────────────────────────────────────────────────────────────────────────",
      ])
    ).toBe(true);
  });

  it("matches ⏵⏵ bypass-permissions footer (Claude Code ≥2.1)", () => {
    expect(
      AGENT_READY_MATCHER([
        "  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents",
      ])
    ).toBe(true);
  });

  it("matches 'bypass permissions' text (Claude Code ≥2.1 footer variant)", () => {
    expect(AGENT_READY_MATCHER(["bypass permissions on"])).toBe(true);
  });

  it("does not match unrelated output", () => {
    expect(AGENT_READY_MATCHER(["npm install", "added 42 packages"])).toBe(
      false
    );
  });
});
