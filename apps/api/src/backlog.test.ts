import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PaneSnapshot } from "@coord-ui/shared";

// ─── Module mocks ─────────────────────────────────────────────────────────────

let readFileContent: string | null = null;

vi.mock("node:fs/promises", () => ({
  readFile: (_path: string, _enc: string) => {
    if (readFileContent === null)
      return Promise.reject(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" })
      );
    return Promise.resolve(readFileContent);
  },
}));

// Controls what gitRoot() resolves to per-cwd. key=cwd, value=root or null.
const gitRootMap = new Map<string, string | null>();

type ExecCallback = (
  err: Error | null,
  result?: { stdout: string; stderr: string }
) => void;

vi.mock("node:child_process", () => ({
  exec: (cmd: string, cb: ExecCallback) => {
    // Extract the -C path from: git -C '<path>' rev-parse --show-toplevel
    const m = /git -C '(.+?)' rev-parse/.exec(cmd);
    const cwd = m ? m[1]!.replace(/'\\''/g, "'") : "";
    const root = gitRootMap.get(cwd) ?? null;
    if (root === null) {
      cb(new Error("not a git repository"));
    } else {
      cb(null, { stdout: root + "\n", stderr: "" });
    }
  },
}));

let mockPanes: PaneSnapshot[] = [];

vi.mock("./tmux.js", () => ({
  tmuxWatcher: {
    get panes() {
      return mockPanes;
    },
  },
  HOME_SESSION: "agent-coord-ui",
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

const {
  parseBacklog,
  loadBacklog,
  loadAllBacklogs,
  getProjectRepoPaths,
  gitRoot,
  getAgentPaneRoots,
} = await import("./backlog.js");

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FIXTURE = `# Task Backlog

## Queue

- [ ] P1 Implement auth flow — owner/repo#12, owner/repo#15
- [ ] P2 Add rate limiting — owner/repo#20
- [ ] P3 Refactor logger —

## Done

- [x] Fix login redirect — owner/repo#8 · 2026-06-01
- [x] Bootstrap CI — owner/repo#3 · 2026-05-20
`;

function makePane(overrides: Partial<PaneSnapshot>): PaneSnapshot {
  return {
    id: "%1",
    pid: 100,
    title: "",
    command: "node",
    session: "main",
    window: 0,
    pane: 0,
    active: true,
    lastActivity: 0,
    cwd: "/some/path",
    left: 0,
    top: 0,
    width: 80,
    height: 24,
    lines: [],
    ...overrides,
  };
}

// ─── parseBacklog ─────────────────────────────────────────────────────────────

describe("parseBacklog", () => {
  it("parses queue items with priority, text, refs", () => {
    const { queue } = parseBacklog("/repo", FIXTURE);
    expect(queue).toHaveLength(3);
    expect(queue[0]).toEqual({
      priority: "P1",
      text: "Implement auth flow",
      refs: "owner/repo#12, owner/repo#15",
      checked: false,
    });
    expect(queue[1]).toEqual({
      priority: "P2",
      text: "Add rate limiting",
      refs: "owner/repo#20",
      checked: false,
    });
    expect(queue[2]).toEqual({
      priority: "P3",
      text: "Refactor logger",
      refs: "",
      checked: false,
    });
  });

  it("parses done items with text, ref, date", () => {
    const { done } = parseBacklog("/repo", FIXTURE);
    expect(done).toHaveLength(2);
    expect(done[0]).toEqual({
      text: "Fix login redirect",
      ref: "owner/repo#8",
      date: "2026-06-01",
    });
    expect(done[1]).toEqual({
      text: "Bootstrap CI",
      ref: "owner/repo#3",
      date: "2026-05-20",
    });
  });

  it("sets project to the repo path", () => {
    const { project } = parseBacklog("/my/repo", FIXTURE);
    expect(project).toBe("/my/repo");
  });

  it("returns empty arrays when sections are missing", () => {
    const { queue, done } = parseBacklog(
      "/repo",
      "# Task Backlog\n\nNo sections here.\n"
    );
    expect(queue).toHaveLength(0);
    expect(done).toHaveLength(0);
  });

  it("skips malformed queue lines without throwing", () => {
    const content = `## Queue\n- [ ] this line has no priority or dash\n- [ ] P1 Valid task — ref#1\n`;
    const { queue } = parseBacklog("/repo", content);
    expect(queue).toHaveLength(1);
    expect(queue[0].priority).toBe("P1");
  });

  it("skips malformed done lines without throwing", () => {
    const content = `## Done\n- [x] no separator here\n- [x] Good task — owner/repo#5 · 2026-06-10\n`;
    const { done } = parseBacklog("/repo", content);
    expect(done).toHaveLength(1);
    expect(done[0].ref).toBe("owner/repo#5");
  });

  it("tolerates em-dash separator in queue lines", () => {
    const content = `## Queue\n- [ ] P2 Task with em dash — ref#9\n`;
    const { queue } = parseBacklog("/repo", content);
    expect(queue).toHaveLength(1);
    expect(queue[0].text).toBe("Task with em dash");
  });

  it("stops collecting queue items when a new ## section appears", () => {
    const content = `## Queue\n- [ ] P1 Task A — ref\n## Other\nsome text\n## Done\n- [x] Done task — r#1 · 2026-01-01\n`;
    const { queue, done } = parseBacklog("/repo", content);
    expect(queue).toHaveLength(1);
    expect(done).toHaveLength(1);
  });
});

// ─── loadBacklog ──────────────────────────────────────────────────────────────

describe("loadBacklog", () => {
  beforeEach(() => {
    readFileContent = null;
  });

  it("returns parsed backlog when file exists", async () => {
    readFileContent = FIXTURE;
    const result = await loadBacklog("/my/repo");
    expect(result).not.toBeNull();
    expect(result!.queue).toHaveLength(3);
    expect(result!.project).toBe("/my/repo");
  });

  it("returns null when file is absent (no throw)", async () => {
    readFileContent = null;
    const result = await loadBacklog("/no/backlog/here");
    expect(result).toBeNull();
  });
});

// ─── gitRoot ──────────────────────────────────────────────────────────────────

describe("gitRoot", () => {
  beforeEach(() => {
    gitRootMap.clear();
  });

  it("returns the git root when cwd is inside a repo", async () => {
    gitRootMap.set("/workspace/myrepo/src", "/workspace/myrepo");
    expect(await gitRoot("/workspace/myrepo/src")).toBe("/workspace/myrepo");
  });

  it("returns null when cwd is not inside a git repo", async () => {
    // no entry in map → exec callback receives an error
    expect(await gitRoot("/tmp/not-a-repo")).toBeNull();
  });

  it("returns null without throwing on exec error", async () => {
    gitRootMap.set("/bad", null as unknown as string); // explicit null → error path
    expect(await gitRoot("/bad")).toBeNull();
  });
});

// ─── getAgentPaneRoots ────────────────────────────────────────────────────────

describe("getAgentPaneRoots", () => {
  beforeEach(() => {
    mockPanes = [];
    gitRootMap.clear();
  });

  it("returns git roots for panes with an agentId", async () => {
    gitRootMap.set("/workspace/repo-a", "/workspace/repo-a");
    gitRootMap.set("/workspace/repo-b", "/workspace/repo-b");
    mockPanes = [
      makePane({ id: "%1", cwd: "/workspace/repo-a", agentId: "agent-1" }),
      makePane({ id: "%2", cwd: "/workspace/repo-b", agentId: "agent-2" }),
    ];
    const roots = await getAgentPaneRoots();
    expect(roots).toEqual(
      expect.arrayContaining(["/workspace/repo-a", "/workspace/repo-b"])
    );
    expect(roots).toHaveLength(2);
  });

  it("skips panes without an agentId", async () => {
    gitRootMap.set("/workspace/repo-a", "/workspace/repo-a");
    mockPanes = [
      makePane({ id: "%1", cwd: "/workspace/repo-a", agentId: undefined }),
    ];
    const roots = await getAgentPaneRoots();
    expect(roots).toHaveLength(0);
  });

  it("skips panes whose cwd is not inside a git repo", async () => {
    mockPanes = [
      makePane({ id: "%1", cwd: "/tmp/scratch", agentId: "agent-x" }),
    ];
    // no gitRootMap entry → null
    const roots = await getAgentPaneRoots();
    expect(roots).toHaveLength(0);
  });

  it("deduplicates panes that resolve to the same git root", async () => {
    gitRootMap.set("/workspace/repo/src", "/workspace/repo");
    gitRootMap.set("/workspace/repo/lib", "/workspace/repo");
    mockPanes = [
      makePane({ id: "%1", cwd: "/workspace/repo/src", agentId: "agent-1" }),
      makePane({ id: "%2", cwd: "/workspace/repo/lib", agentId: "agent-2" }),
    ];
    const roots = await getAgentPaneRoots();
    expect(roots).toEqual(["/workspace/repo"]);
  });

  it("returns empty array when no agent panes exist", async () => {
    mockPanes = [];
    const roots = await getAgentPaneRoots();
    expect(roots).toHaveLength(0);
  });
});

// ─── loadAllBacklogs ──────────────────────────────────────────────────────────

describe("loadAllBacklogs", () => {
  beforeEach(() => {
    readFileContent = FIXTURE;
    mockPanes = [];
    gitRootMap.clear();
    process.env.AGENT_COORD_PROJECT_REPOS = "/repo/a,/repo/b";
  });

  it("returns one result per configured repo that has a backlog", async () => {
    const results = await loadAllBacklogs();
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.project)).toEqual(["/repo/a", "/repo/b"]);
  });

  it("skips repos whose backlog is absent when one path has no file", async () => {
    process.env.AGENT_COORD_PROJECT_REPOS = "/repo/missing";
    readFileContent = null;
    const results = await loadAllBacklogs();
    expect(results).toHaveLength(0);
  });

  it("includes auto-discovered agent pane roots", async () => {
    process.env.AGENT_COORD_PROJECT_REPOS = "";
    gitRootMap.set("/workspace/agent-repo", "/workspace/agent-repo");
    mockPanes = [
      makePane({
        id: "%3",
        cwd: "/workspace/agent-repo",
        agentId: "some-agent",
      }),
    ];
    const results = await loadAllBacklogs();
    expect(results).toHaveLength(1);
    expect(results[0]!.project).toBe("/workspace/agent-repo");
  });

  it("unions env paths and agent pane roots without duplicates", async () => {
    // /repo/a is in both env and agent panes
    gitRootMap.set("/repo/a", "/repo/a");
    mockPanes = [
      makePane({ id: "%4", cwd: "/repo/a", agentId: "agent-overlap" }),
    ];
    const results = await loadAllBacklogs();
    // /repo/a, /repo/b from env (agent /repo/a is a dup, /repo/b from env only)
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.project)).toEqual(
      expect.arrayContaining(["/repo/a", "/repo/b"])
    );
  });
});

// ─── getProjectRepoPaths ──────────────────────────────────────────────────────

describe("getProjectRepoPaths", () => {
  it("splits comma-separated env var", () => {
    process.env.AGENT_COORD_PROJECT_REPOS = "/a,/b, /c ";
    expect(getProjectRepoPaths()).toEqual(["/a", "/b", "/c"]);
  });

  it("returns empty array when env is unset", () => {
    delete process.env.AGENT_COORD_PROJECT_REPOS;
    expect(getProjectRepoPaths()).toEqual([]);
  });
});
