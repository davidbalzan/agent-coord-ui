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

type ExecCallback = (
  err: Error | null,
  result?: { stdout: string; stderr: string }
) => void;

const gitRootMap = new Map<string, string | null>();

vi.mock("node:child_process", () => ({
  exec: (cmd: string, cb: ExecCallback) => {
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

// ─── Real-file fixture (lines copied from shadowGuard/docs/BACKLOG.md) ────────

// These lines use parenthesized priorities and prose em-dashes — the old regex
// required bare "P1" and would have returned 0 queue items from this content.
const REAL_FIXTURE = `# BACKLOG — shadowguard

## Queue

- [ ] (P1) Settings — Unified — merge the two confusingly-identical "Settings" pages (\`/settings\` personal + \`/admin/settings\` admin) into one \`/settings\` with a Personal/System sub-nav. \`[in-flight · sg-ui]\`
- [ ] (P2) U13 · Clusters: all-sites default + Site column + dropdown-as-filter (supersedes #69 auto-select). API: make \`site\` optional → access-controlled cross-site rows; UI: Site column + All default + filter. \`[queued]\`
- [ ] (P3) U7 · Clusters inline-Undo: scope to pending window (post-commit shows Undo that can't reverse). Bundle with next Clusters touch. \`[queued · low]\`
- [ ] (P1) Worker worktree isolation — workers + coord share one git working dir, so branch checkouts collide. Move workers to isolated git worktrees. \`[open · coord]\`

## Done

- [x] U14 · "Ranks For" keywords table sortable — PR #73. · 2026-06-11
- [x] U19 · Per-domain "Force re-crawl" button + sidebar jobs pill — PR #81 (\`POST /candidates/:id/recrawl\`) + #83 (priority lane so it runs alongside the bulk enrich) + #88 (button, inline status, sidebar pill). Verified end-to-end (recrawl populated \`word_count=5516\`). · 2026-06-11
- [x] U17 · Dedup index now created via migrate — root cause was migration \`when\` timestamps dated before 0036 (silently skipped). Fixed: PR #80 (timestamps) + #76 (0038 parenthesized index) + #87 (neutralize broken 0037, which crash-looped the migrate init). Dedup index migration-tracked + verified. · 2026-06-11
- [x] Phase 16 plan — Backlink Intelligence Dashboard — roadmap entry #84 + plan docs #86 (README + 6-task plan; gated on BLF backlink-record API). Proposed/parked. · 2026-06-11
- [x] Detect Disruptions button + \`detect_disruptions --backfill 30\`. · 2026-06-10
- [x] Clusters not loading (real fix) — PR #68 (ambiguous bare "id" in subqueries → qualified to clusters.id). · 2026-06-10
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

// ─── parseBacklog — queue ─────────────────────────────────────────────────────

describe("parseBacklog — queue (real-file lines)", () => {
  it("parses all 4 queue items from real fixture", () => {
    const { queue } = parseBacklog("/repo", REAL_FIXTURE);
    expect(queue).toHaveLength(4);
  });

  it("extracts P1 priority from parenthesized (P1) format", () => {
    const { queue } = parseBacklog("/repo", REAL_FIXTURE);
    expect(queue[0]!.priority).toBe("P1");
    expect(queue[3]!.priority).toBe("P1");
  });

  it("extracts P2 and P3 priorities", () => {
    const { queue } = parseBacklog("/repo", REAL_FIXTURE);
    expect(queue[1]!.priority).toBe("P2");
    expect(queue[2]!.priority).toBe("P3");
  });

  it("captures full text including internal em-dashes (no premature split)", () => {
    const { queue } = parseBacklog("/repo", REAL_FIXTURE);
    // First item has em-dashes embedded in prose — must NOT split on them
    expect(queue[0]!.text).toContain("Settings — Unified — merge");
    expect(queue[0]!.text).not.toBe("Settings");
  });

  it("captures full text for items without any em-dash", () => {
    const { queue } = parseBacklog("/repo", REAL_FIXTURE);
    expect(queue[1]!.text).toContain("U13 · Clusters: all-sites default");
  });

  it("sets refs to empty string (refs are inline in task text, not split out)", () => {
    const { queue } = parseBacklog("/repo", REAL_FIXTURE);
    for (const item of queue) expect(item.refs).toBe("");
  });

  it("sets checked: false on all queue items", () => {
    const { queue } = parseBacklog("/repo", REAL_FIXTURE);
    for (const item of queue) expect(item.checked).toBe(false);
  });

  it("does NOT match bare 'P1' format (old broken format)", () => {
    const content = `## Queue\n- [ ] P1 Old format task — refs\n`;
    const { queue } = parseBacklog("/repo", content);
    expect(queue).toHaveLength(0);
  });

  it("parses a minimal queue item with no em-dash suffix", () => {
    const content = `## Queue\n- [ ] (P2) Fix the thing\n`;
    const { queue } = parseBacklog("/repo", content);
    expect(queue).toHaveLength(1);
    expect(queue[0]!.text).toBe("Fix the thing");
    expect(queue[0]!.refs).toBe("");
  });

  it("skips malformed queue lines without throwing", () => {
    const content = `## Queue\n- [ ] no priority here\n- [ ] (P1) Valid task\n`;
    const { queue } = parseBacklog("/repo", content);
    expect(queue).toHaveLength(1);
    expect(queue[0]!.priority).toBe("P1");
  });

  it("stops collecting at the next ## section", () => {
    const content = `## Queue\n- [ ] (P1) Task A\n## Other\n- [ ] (P2) Should not appear\n`;
    const { queue } = parseBacklog("/repo", content);
    expect(queue).toHaveLength(1);
  });
});

// ─── parseBacklog — done ──────────────────────────────────────────────────────

describe("parseBacklog — done (real-file lines)", () => {
  it("parses all 6 done items from real fixture", () => {
    const { done } = parseBacklog("/repo", REAL_FIXTURE);
    expect(done).toHaveLength(6);
  });

  it("extracts date from trailing ' · YYYY-MM-DD'", () => {
    const { done } = parseBacklog("/repo", REAL_FIXTURE);
    expect(done[0]!.date).toBe("2026-06-11");
    expect(done[4]!.date).toBe("2026-06-10");
  });

  it("simple item: extracts clean text before last em-dash", () => {
    const { done } = parseBacklog("/repo", REAL_FIXTURE);
    // U14 · "Ranks For" keywords table sortable — PR #73.
    expect(done[0]!.text).toBe('U14 · "Ranks For" keywords table sortable');
    expect(done[0]!.ref).toBe("PR #73");
  });

  it("complex item with multiple refs: text is everything before last em-dash", () => {
    const { done } = parseBacklog("/repo", REAL_FIXTURE);
    // U19 — text must be the intro, not mis-sliced
    expect(done[1]!.text).toBe(
      'U19 · Per-domain "Force re-crawl" button + sidebar jobs pill'
    );
    expect(done[1]!.ref).toContain("PR #81");
  });

  it("item with two em-dashes: text keeps first em-dash, ref is after LAST", () => {
    const { done } = parseBacklog("/repo", REAL_FIXTURE);
    // Phase 16 plan — Backlink Intelligence Dashboard — roadmap entry #84...
    expect(done[3]!.text).toBe(
      "Phase 16 plan — Backlink Intelligence Dashboard"
    );
    expect(done[3]!.ref).toContain("#84");
  });

  it("item with no em-dash separator: text = full line, ref = ''", () => {
    const { done } = parseBacklog("/repo", REAL_FIXTURE);
    // "Detect Disruptions button + `detect_disruptions --backfill 30`."
    // Note: `--backfill` uses double-hyphen, NOT em-dash — should not split
    expect(done[4]!.text).toContain("Detect Disruptions");
    expect(done[4]!.ref).toBe("");
  });

  it("skips malformed done lines without throwing", () => {
    const content = `## Done\n- [x] \n- [x] Valid task — PR #1 · 2026-06-01\n`;
    const { done } = parseBacklog("/repo", content);
    expect(done).toHaveLength(1);
  });

  it("handles done item with no date gracefully", () => {
    const content = `## Done\n- [x] Some old task — PR #5\n`;
    const { done } = parseBacklog("/repo", content);
    expect(done).toHaveLength(1);
    expect(done[0]!.text).toBe("Some old task");
    expect(done[0]!.ref).toBe("PR #5");
    expect(done[0]!.date).toBe("");
  });
});

// ─── parseBacklog — section boundaries ───────────────────────────────────────

describe("parseBacklog — structure", () => {
  it("returns empty arrays when sections are missing", () => {
    const { queue, done } = parseBacklog(
      "/repo",
      "# BACKLOG\n\nNo sections.\n"
    );
    expect(queue).toHaveLength(0);
    expect(done).toHaveLength(0);
  });

  it("sets project to the repo path", () => {
    const { project } = parseBacklog("/my/repo", REAL_FIXTURE);
    expect(project).toBe("/my/repo");
  });

  it("stops Done collection at the next ## section", () => {
    const content = `## Done\n- [x] Task A — r#1 · 2026-01-01\n## Other\n- [x] Should not appear — r#2 · 2026-01-02\n`;
    const { done } = parseBacklog("/repo", content);
    expect(done).toHaveLength(1);
  });
});

// ─── loadBacklog ──────────────────────────────────────────────────────────────

describe("loadBacklog", () => {
  beforeEach(() => {
    readFileContent = null;
  });

  it("returns parsed backlog when file exists", async () => {
    readFileContent = REAL_FIXTURE;
    const result = await loadBacklog("/my/repo");
    expect(result).not.toBeNull();
    expect(result!.queue).toHaveLength(4);
    expect(result!.done).toHaveLength(6);
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
    expect(await gitRoot("/tmp/not-a-repo")).toBeNull();
  });

  it("returns null without throwing on exec error", async () => {
    gitRootMap.set("/bad", null as unknown as string);
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
    expect(await getAgentPaneRoots()).toHaveLength(0);
  });

  it("skips panes whose cwd is not inside a git repo", async () => {
    mockPanes = [
      makePane({ id: "%1", cwd: "/tmp/scratch", agentId: "agent-x" }),
    ];
    expect(await getAgentPaneRoots()).toHaveLength(0);
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
    expect(await getAgentPaneRoots()).toHaveLength(0);
  });
});

// ─── loadAllBacklogs ──────────────────────────────────────────────────────────

describe("loadAllBacklogs", () => {
  beforeEach(() => {
    readFileContent = REAL_FIXTURE;
    mockPanes = [];
    gitRootMap.clear();
    process.env.AGENT_COORD_PROJECT_REPOS = "/repo/a,/repo/b";
  });

  it("returns one result per configured repo that has a backlog", async () => {
    const results = await loadAllBacklogs();
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.project)).toEqual(["/repo/a", "/repo/b"]);
  });

  it("skips repos whose backlog is absent", async () => {
    process.env.AGENT_COORD_PROJECT_REPOS = "/repo/missing";
    readFileContent = null;
    expect(await loadAllBacklogs()).toHaveLength(0);
  });

  it("includes auto-discovered agent pane roots", async () => {
    process.env.AGENT_COORD_PROJECT_REPOS = "";
    gitRootMap.set("/workspace/agent-repo", "/workspace/agent-repo");
    mockPanes = [
      makePane({ id: "%3", cwd: "/workspace/agent-repo", agentId: "agent-x" }),
    ];
    const results = await loadAllBacklogs();
    expect(results).toHaveLength(1);
    expect(results[0]!.project).toBe("/workspace/agent-repo");
  });

  it("unions env paths and agent pane roots without duplicates", async () => {
    gitRootMap.set("/repo/a", "/repo/a");
    mockPanes = [
      makePane({ id: "%4", cwd: "/repo/a", agentId: "agent-overlap" }),
    ];
    const results = await loadAllBacklogs();
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
