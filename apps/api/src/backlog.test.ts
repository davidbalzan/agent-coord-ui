import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PaneSnapshot } from "@coord-ui/shared";

// ─── Module mocks ─────────────────────────────────────────────────────────────

// readFile: fallback content (null → ENOENT); readFileSequence overrides per-call
let readFileContent: string | null = null;
let readFileSequence: Array<string | null> = [];
let readFileCallCount = 0;

// readFileByPath: path-substring pattern → content (null → ENOENT). Checked
// FIRST, without consuming the sequence counter — used by split-layout tests
// where QUEUE.md / DONE.md / BACKLOG.md must resolve independently.
const readFileByPath = new Map<string, string | null>();

// access(): path-substring patterns that "exist"; everything else → ENOENT
let existingPaths: string[] = [];

// stat: sequence of identities; falls back to DEFAULT_IDENTITY when exhausted
let statResponses: Array<{ mtimeMs: number; size: number }> = [];
let statCallCount = 0;

// write/rename tracking
let writtenContents: string[] = [];
let writtenPaths: string[] = [];
let renameCallCount = 0;
let renameTargets: string[] = [];

const DEFAULT_IDENTITY = { mtimeMs: 1000, size: 500 };

const enoent = () =>
  Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

vi.mock("node:fs/promises", () => ({
  readFile: (path: string, _enc: string) => {
    for (const [pattern, content] of readFileByPath) {
      if (String(path).includes(pattern)) {
        return content === null ? enoent() : Promise.resolve(content);
      }
    }
    const idx = readFileCallCount++;
    const override = readFileSequence[idx];
    const content = override !== undefined ? override : readFileContent;
    if (content === null) return enoent();
    return Promise.resolve(content);
  },
  access: (path: string) => {
    if (existingPaths.some((p) => String(path).includes(p)))
      return Promise.resolve();
    return enoent();
  },
  stat: (_path: string) => {
    const response = statResponses[statCallCount] ?? DEFAULT_IDENTITY;
    statCallCount++;
    return Promise.resolve(response);
  },
  writeFile: (path: string, content: string, _enc: string) => {
    writtenContents.push(content as string);
    writtenPaths.push(String(path));
    return Promise.resolve();
  },
  rename: (_src: string, dst: string) => {
    renameCallCount++;
    renameTargets.push(String(dst));
    return Promise.resolve();
  },
}));

type ExecCallback = (
  err: Error | null,
  result?: { stdout: string; stderr: string }
) => void;

// gitRootMap: cwd → root path (for rev-parse --show-toplevel)
const gitRootMap = new Map<string, string | null>();

// gitCommandResults: substring-pattern → stdout string | null (null → error)
// Checked in insertion order; first match wins.
// Used for symbolic-ref, rev-parse --verify, git show, etc.
const gitCommandResults = new Map<string, string | null>();

vi.mock("node:child_process", () => ({
  exec: (cmd: string, cb: ExecCallback) => {
    // git show <ref>:path or symbolic-ref or rev-parse --verify — check registry first
    for (const [pattern, result] of gitCommandResults) {
      if (cmd.includes(pattern)) {
        if (result === null) {
          cb(new Error(`git command failed: ${pattern}`));
        } else {
          cb(null, { stdout: result, stderr: "" });
        }
        return;
      }
    }
    // Fallback: rev-parse --show-toplevel via gitRootMap
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
  getAgentRootsWithAgents,
  rewriteQueueRegion,
  resolveDefaultRef,
  readBacklogContent,
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

  it("parses the compact '- [P1] task' format (priority as checkbox tag)", () => {
    const content = `## Queue\n- [P2] S5/S6 web — consensus pages — davidbalzan/edgewatch#15\n- [P3] S7 — long-tail prerender\n`;
    const { queue } = parseBacklog("/repo", content);
    expect(queue).toHaveLength(2);
    expect(queue[0]).toMatchObject({
      priority: "P2",
      text: "S5/S6 web — consensus pages — davidbalzan/edgewatch#15",
    });
    expect(queue[1]).toMatchObject({ priority: "P3" });
  });

  it("handles canonical and compact formats mixed in one queue", () => {
    const content = `## Queue\n- [ ] (P1) Canonical task\n- [P2] Compact task\n`;
    const { queue } = parseBacklog("/repo", content);
    expect(queue.map((q) => q.priority)).toEqual(["P1", "P2"]);
  });

  it("does NOT treat non-priority bracket tags as queue items", () => {
    const content = `## Queue\n- [ops] deploy step\n- [research] open question\n- [P1] Real task\n`;
    const { queue } = parseBacklog("/repo", content);
    expect(queue).toHaveLength(1);
    expect(queue[0]!.priority).toBe("P1");
  });

  it("stays in the queue section across ### subsection headers", () => {
    const content = `## Queue\n### Phase 2 — active\n- [P1] task A\n### Phase 3\n- [P2] task B\n## Discovered\n- [P1] not a queue item\n`;
    const { queue } = parseBacklog("/repo", content);
    expect(queue.map((q) => q.priority)).toEqual(["P1", "P2"]);
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

  it("populates agentIds for backlog whose root matches a live agent pane", async () => {
    process.env.AGENT_COORD_PROJECT_REPOS = "/repo/a";
    gitRootMap.set("/repo/a", "/repo/a");
    mockPanes = [
      makePane({ id: "%5", cwd: "/repo/a", agentId: "agent-alpha" }),
    ];
    const results = await loadAllBacklogs();
    expect(results[0]!.agentIds).toEqual(["agent-alpha"]);
  });

  it("agentIds is empty array for env-configured roots with no live agent", async () => {
    process.env.AGENT_COORD_PROJECT_REPOS = "/repo/a";
    mockPanes = [];
    const results = await loadAllBacklogs();
    expect(results[0]!.agentIds).toEqual([]);
  });

  it("accumulates multiple agents at the same root", async () => {
    process.env.AGENT_COORD_PROJECT_REPOS = "";
    gitRootMap.set("/repo/shared", "/repo/shared");
    mockPanes = [
      makePane({ id: "%6", cwd: "/repo/shared", agentId: "agent-1" }),
      makePane({ id: "%7", cwd: "/repo/shared", agentId: "agent-2" }),
    ];
    const results = await loadAllBacklogs();
    expect(results[0]!.agentIds).toEqual(
      expect.arrayContaining(["agent-1", "agent-2"])
    );
    expect(results[0]!.agentIds).toHaveLength(2);
  });
});

// ─── getAgentRootsWithAgents ──────────────────────────────────────────────────

describe("getAgentRootsWithAgents", () => {
  beforeEach(() => {
    mockPanes = [];
    gitRootMap.clear();
  });

  it("returns empty map when no agent panes exist", async () => {
    expect((await getAgentRootsWithAgents()).size).toBe(0);
  });

  it("maps root → agentId for a single pane", async () => {
    gitRootMap.set("/workspace/proj", "/workspace/proj");
    mockPanes = [
      makePane({ id: "%1", cwd: "/workspace/proj", agentId: "agent-x" }),
    ];
    const map = await getAgentRootsWithAgents();
    expect(map.get("/workspace/proj")).toEqual(["agent-x"]);
  });

  it("skips panes whose cwd is not inside a git repo", async () => {
    mockPanes = [makePane({ id: "%2", cwd: "/not/a/repo", agentId: "orphan" })];
    const map = await getAgentRootsWithAgents();
    expect(map.size).toBe(0);
  });

  it("accumulates multiple agents at the same root without duplicates", async () => {
    gitRootMap.set("/repo/multi", "/repo/multi");
    mockPanes = [
      makePane({ id: "%3", cwd: "/repo/multi", agentId: "agent-a" }),
      makePane({ id: "%4", cwd: "/repo/multi", agentId: "agent-b" }),
      makePane({ id: "%5", cwd: "/repo/multi", agentId: "agent-a" }), // duplicate
    ];
    const map = await getAgentRootsWithAgents();
    expect(map.get("/repo/multi")).toEqual(
      expect.arrayContaining(["agent-a", "agent-b"])
    );
    expect(map.get("/repo/multi")).toHaveLength(2);
  });
});

// ─── resolveDefaultRef ────────────────────────────────────────────────────────

describe("resolveDefaultRef", () => {
  beforeEach(() => {
    gitCommandResults.clear();
    gitRootMap.clear();
  });

  it("returns origin/<branch> from symbolic-ref when set", async () => {
    gitCommandResults.set(
      "symbolic-ref --quiet refs/remotes/origin/HEAD",
      "refs/remotes/origin/main\n"
    );
    const ref = await resolveDefaultRef("/repo/proj");
    expect(ref).toBe("origin/main");
  });

  it("strips refs/remotes/ prefix from symbolic-ref output", async () => {
    gitCommandResults.set(
      "symbolic-ref --quiet refs/remotes/origin/HEAD",
      "refs/remotes/origin/develop\n"
    );
    const ref = await resolveDefaultRef("/repo/proj");
    expect(ref).toBe("origin/develop");
  });

  it("falls back to origin/main when symbolic-ref fails", async () => {
    gitCommandResults.set(
      "symbolic-ref --quiet refs/remotes/origin/HEAD",
      null
    );
    gitCommandResults.set("rev-parse --verify --quiet origin/main", "abc123\n");
    const ref = await resolveDefaultRef("/repo/proj");
    expect(ref).toBe("origin/main");
  });

  it("falls back to local main when origin/main is absent", async () => {
    gitCommandResults.set(
      "symbolic-ref --quiet refs/remotes/origin/HEAD",
      null
    );
    gitCommandResults.set("rev-parse --verify --quiet origin/main", null);
    gitCommandResults.set("rev-parse --verify --quiet main", "def456\n");
    const ref = await resolveDefaultRef("/repo/proj");
    expect(ref).toBe("main");
  });

  it("returns null when all refs fail", async () => {
    gitCommandResults.set(
      "symbolic-ref --quiet refs/remotes/origin/HEAD",
      null
    );
    gitCommandResults.set("rev-parse --verify --quiet origin/main", null);
    gitCommandResults.set("rev-parse --verify --quiet main", null);
    const ref = await resolveDefaultRef("/repo/proj");
    expect(ref).toBeNull();
  });
});

// ─── readBacklogContent ───────────────────────────────────────────────────────

describe("readBacklogContent", () => {
  const CANONICAL =
    "# CANONICAL\n\n## Queue\n\n- [ ] (P1) Canonical task\n\n## Done\n";
  const WORKING_COPY =
    "# WORKING COPY\n\n## Queue\n\n- [ ] (P1) Local task\n\n## Done\n";

  beforeEach(() => {
    gitCommandResults.clear();
    gitRootMap.clear();
    readFileContent = null;
    readFileSequence = [];
    readFileCallCount = 0;
  });

  it("returns default-branch content when git show succeeds", async () => {
    gitCommandResults.set(
      "symbolic-ref --quiet refs/remotes/origin/HEAD",
      "refs/remotes/origin/main\n"
    );
    gitCommandResults.set("show origin/main:docs/BACKLOG.md", CANONICAL);
    const content = await readBacklogContent("/repo/proj");
    expect(content).toBe(CANONICAL);
  });

  it("falls back to working-copy when git show fails", async () => {
    gitCommandResults.set(
      "symbolic-ref --quiet refs/remotes/origin/HEAD",
      "refs/remotes/origin/main\n"
    );
    // git show fails (file not on that branch)
    gitCommandResults.set("show origin/main:docs/BACKLOG.md", null);
    readFileContent = WORKING_COPY;
    const content = await readBacklogContent("/repo/proj");
    expect(content).toBe(WORKING_COPY);
  });

  it("falls back to working-copy when no ref can be resolved", async () => {
    gitCommandResults.set(
      "symbolic-ref --quiet refs/remotes/origin/HEAD",
      null
    );
    gitCommandResults.set("rev-parse --verify --quiet origin/main", null);
    gitCommandResults.set("rev-parse --verify --quiet main", null);
    readFileContent = WORKING_COPY;
    const content = await readBacklogContent("/repo/proj");
    expect(content).toBe(WORKING_COPY);
  });

  it("returns null when both git show and working-copy file are absent", async () => {
    gitCommandResults.set(
      "symbolic-ref --quiet refs/remotes/origin/HEAD",
      null
    );
    gitCommandResults.set("rev-parse --verify --quiet origin/main", null);
    gitCommandResults.set("rev-parse --verify --quiet main", null);
    readFileContent = null; // ENOENT
    const content = await readBacklogContent("/repo/proj");
    expect(content).toBeNull();
  });

  it("loadBacklog uses default-branch content via readBacklogContent", async () => {
    gitCommandResults.set(
      "symbolic-ref --quiet refs/remotes/origin/HEAD",
      "refs/remotes/origin/main\n"
    );
    gitCommandResults.set("show origin/main:docs/BACKLOG.md", CANONICAL);
    const backlog = await loadBacklog("/repo/proj");
    expect(backlog).not.toBeNull();
    expect(backlog!.queue[0]!.text).toBe("Canonical task");
  });

  it("loadBacklog returns null when file absent on branch and no working copy", async () => {
    gitCommandResults.set(
      "symbolic-ref --quiet refs/remotes/origin/HEAD",
      null
    );
    gitCommandResults.set("rev-parse --verify --quiet origin/main", null);
    gitCommandResults.set("rev-parse --verify --quiet main", null);
    readFileContent = null;
    const backlog = await loadBacklog("/repo/proj");
    expect(backlog).toBeNull();
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

// ─── rewriteQueueRegion — CAS ────────────────────────────────────────────────

const BASE_BACKLOG = `# BACKLOG

## Queue

- [ ] (P1) Original task one
- [ ] (P2) Original task two

## Done

- [x] Completed task — coord/repo#1 · 2026-06-01
`;

const NEW_ITEMS = [
  {
    priority: "P1" as const,
    text: "Updated task one",
    refs: "",
    checked: false as const,
  },
  {
    priority: "P3" as const,
    text: "Brand new task",
    refs: "",
    checked: false as const,
  },
];

describe("rewriteQueueRegion — CAS write", () => {
  beforeEach(() => {
    readFileContent = BASE_BACKLOG;
    readFileSequence = [];
    readFileCallCount = 0;
    statResponses = [];
    statCallCount = 0;
    writtenContents = [];
    renameCallCount = 0;
  });

  it("writes new queue items, preserves ## Done region byte-for-byte", async () => {
    const result = await rewriteQueueRegion("/repo", NEW_ITEMS);
    expect(result.queue).toHaveLength(2);
    expect(result.queue[0]!.text).toBe("Updated task one");
    expect(result.queue[1]!.text).toBe("Brand new task");
    const committed = writtenContents[writtenContents.length - 1]!;
    expect(committed).toContain("## Done");
    expect(committed).toContain(
      "- [x] Completed task — coord/repo#1 · 2026-06-01"
    );
    expect(renameCallCount).toBe(1);
  });

  it("stable file: completes in one attempt (one rename)", async () => {
    // Default identity is stable → no retry
    await rewriteQueueRegion("/repo", NEW_ITEMS);
    expect(renameCallCount).toBe(1);
    // Only 2 stat calls (before + after) from a single attempt
    expect(statCallCount).toBe(2);
  });

  it("retries when stat detects concurrent modification, does NOT clobber the out-of-region change", async () => {
    // Concurrent modification scenario:
    // attempt 0: stat-before=A, stat-after=B (coordinator appended to Done) → retry
    // attempt 1: stat-before=B, stat-after=B (stable) → rename succeeds
    const identityA = { mtimeMs: 1000, size: 500 };
    const identityB = { mtimeMs: 2000, size: 560 };
    statResponses = [identityA, identityB, identityB, identityB];

    // Coordinator's concurrent Done append — added between attempt 0's read and stat-after
    const modifiedBacklog =
      BASE_BACKLOG +
      "- [x] Coordinator appended done — coord/repo#2 · 2026-06-11\n";

    // readFileSequence: first read (attempt 0) = original; second read (retry) = modified
    readFileSequence = [BASE_BACKLOG, modifiedBacklog];

    const result = await rewriteQueueRegion("/repo", NEW_ITEMS);

    // Queue contains our new items
    expect(result.queue[0]!.text).toBe("Updated task one");
    expect(result.queue[1]!.text).toBe("Brand new task");

    // Final committed content must preserve BOTH Done entries — original + coordinator append
    const committed = writtenContents[writtenContents.length - 1]!;
    expect(committed).toContain(
      "- [x] Completed task — coord/repo#1 · 2026-06-01"
    );
    expect(committed).toContain(
      "- [x] Coordinator appended done — coord/repo#2"
    );

    // Exactly one successful rename (attempt 1), not attempt 0
    expect(renameCallCount).toBe(1);
    // 4 stat calls: 2 per attempt × 2 attempts
    expect(statCallCount).toBe(4);
  });

  it("throws after max attempts when file keeps changing", async () => {
    // Every stat-after differs from stat-before → never settles
    statResponses = Array.from({ length: 12 }, (_, i) => ({
      mtimeMs: 1000 + i * 100,
      size: 500 + i,
    }));
    // Provide enough readFile responses for all retries
    readFileSequence = Array(6).fill(BASE_BACKLOG);
    await expect(rewriteQueueRegion("/repo", NEW_ITEMS)).rejects.toThrow(
      /failed after \d+ attempts/
    );
    expect(renameCallCount).toBe(0);
  });

  it("succeeds on second attempt when only first attempt races", async () => {
    statResponses = [
      { mtimeMs: 1000, size: 500 }, // attempt 0 stat-before
      { mtimeMs: 2000, size: 550 }, // attempt 0 stat-after (changed) → retry
      { mtimeMs: 2000, size: 550 }, // attempt 1 stat-before
      { mtimeMs: 2000, size: 550 }, // attempt 1 stat-after (stable) → rename
    ];
    readFileSequence = [BASE_BACKLOG, BASE_BACKLOG];
    const result = await rewriteQueueRegion("/repo", NEW_ITEMS);
    expect(result.queue).toHaveLength(2);
    expect(renameCallCount).toBe(1);
  });
});

// ─── Split QUEUE.md / DONE.md layout (queue-split proposal, agent-coordination#5) ──

const QUEUE_FILE = `# QUEUE — proj

## Queue

- [ ] (P1) Split-file queue task
`;

const DONE_FILE = `# DONE — proj

## Done

- [x] Split-file done task — PR #9 · 2026-07-01
`;

const HEADERLESS_QUEUE = `- [ ] (P1) Headerless canonical task
- [P2] Headerless compact task
`;

const HEADERLESS_DONE = `- [x] Headerless done task — PR #3 · 2026-06-30
`;

function resetSplitMocks() {
  gitCommandResults.clear();
  gitRootMap.clear();
  readFileByPath.clear();
  readFileContent = null;
  readFileSequence = [];
  readFileCallCount = 0;
  existingPaths = [];
  statResponses = [];
  statCallCount = 0;
  writtenContents = [];
  writtenPaths = [];
  renameCallCount = 0;
  renameTargets = [];
}

describe("loadBacklog — split QUEUE.md/DONE.md layout", () => {
  beforeEach(resetSplitMocks);

  it("prefers QUEUE.md + DONE.md over legacy BACKLOG.md when both exist", async () => {
    readFileByPath.set("QUEUE.md", QUEUE_FILE);
    readFileByPath.set("DONE.md", DONE_FILE);
    // Legacy present too — must NOT be consulted for either side
    readFileByPath.set("BACKLOG.md", REAL_FIXTURE);
    const backlog = await loadBacklog("/repo/split");
    expect(backlog).not.toBeNull();
    expect(backlog!.queue).toHaveLength(1);
    expect(backlog!.queue[0]!.text).toBe("Split-file queue task");
    expect(backlog!.done).toHaveLength(1);
    expect(backlog!.done[0]!.ref).toBe("PR #9");
    expect(backlog!.project).toBe("/repo/split");
  });

  it("legacy-only repo: reads both sides from BACKLOG.md (unchanged behavior)", async () => {
    readFileByPath.set("QUEUE.md", null);
    readFileByPath.set("DONE.md", null);
    readFileByPath.set("BACKLOG.md", REAL_FIXTURE);
    const backlog = await loadBacklog("/repo/legacy");
    expect(backlog!.queue).toHaveLength(4);
    expect(backlog!.done).toHaveLength(6);
  });

  it("mid-migration: only QUEUE.md exists → queue from it, done from legacy", async () => {
    readFileByPath.set("QUEUE.md", QUEUE_FILE);
    readFileByPath.set("DONE.md", null);
    readFileByPath.set("BACKLOG.md", REAL_FIXTURE);
    const backlog = await loadBacklog("/repo/mid");
    expect(backlog!.queue).toHaveLength(1);
    expect(backlog!.queue[0]!.text).toBe("Split-file queue task");
    expect(backlog!.done).toHaveLength(6); // from legacy ## Done
  });

  it("mid-migration: only DONE.md exists → done from it, queue from legacy", async () => {
    readFileByPath.set("QUEUE.md", null);
    readFileByPath.set("DONE.md", DONE_FILE);
    readFileByPath.set("BACKLOG.md", REAL_FIXTURE);
    const backlog = await loadBacklog("/repo/mid");
    expect(backlog!.queue).toHaveLength(4); // from legacy ## Queue
    expect(backlog!.done).toHaveLength(1);
    expect(backlog!.done[0]!.text).toBe("Split-file done task");
  });

  it("headerless QUEUE.md: items parsed as implied queue section (no silent-empty render)", async () => {
    readFileByPath.set("QUEUE.md", HEADERLESS_QUEUE);
    readFileByPath.set("DONE.md", null);
    readFileByPath.set("BACKLOG.md", null);
    const backlog = await loadBacklog("/repo/hq");
    expect(backlog!.queue.map((q) => q.priority)).toEqual(["P1", "P2"]);
    expect(backlog!.queue[0]!.text).toBe("Headerless canonical task");
  });

  it("headerless DONE.md: items parsed as implied done section", async () => {
    readFileByPath.set("QUEUE.md", null);
    readFileByPath.set("DONE.md", HEADERLESS_DONE);
    readFileByPath.set("BACKLOG.md", null);
    const backlog = await loadBacklog("/repo/hd");
    expect(backlog!.done).toHaveLength(1);
    expect(backlog!.done[0]!).toMatchObject({
      text: "Headerless done task",
      ref: "PR #3",
      date: "2026-06-30",
    });
  });

  it("QUEUE.md items never leak into done (and vice versa) in dedicated files", async () => {
    // A dedicated file carrying BOTH headers still only contributes its side
    readFileByPath.set("QUEUE.md", REAL_FIXTURE);
    readFileByPath.set("DONE.md", null);
    readFileByPath.set("BACKLOG.md", null);
    const backlog = await loadBacklog("/repo/x");
    expect(backlog!.queue).toHaveLength(4);
    expect(backlog!.done).toHaveLength(0); // done side had no source
  });

  it("returns null when no backlog file exists in any layout", async () => {
    readFileByPath.set("QUEUE.md", null);
    readFileByPath.set("DONE.md", null);
    readFileByPath.set("BACKLOG.md", null);
    expect(await loadBacklog("/repo/none")).toBeNull();
  });

  it("reads each dedicated file from the default branch via git-show, with per-file working-copy fallback", async () => {
    gitCommandResults.set(
      "symbolic-ref --quiet refs/remotes/origin/HEAD",
      "refs/remotes/origin/main\n"
    );
    gitCommandResults.set("show origin/main:docs/QUEUE.md", QUEUE_FILE);
    gitCommandResults.set("show origin/main:docs/DONE.md", null); // absent on branch
    readFileByPath.set("QUEUE.md", null); // working copy absent — branch wins anyway
    readFileByPath.set("DONE.md", DONE_FILE); // working-copy fallback
    readFileByPath.set("BACKLOG.md", null);
    const backlog = await loadBacklog("/repo/git");
    expect(backlog!.queue[0]!.text).toBe("Split-file queue task");
    expect(backlog!.done[0]!.text).toBe("Split-file done task");
  });
});

// ─── rewriteQueueRegion — split layout targeting ─────────────────────────────

describe("rewriteQueueRegion — split layout", () => {
  beforeEach(resetSplitMocks);

  it("targets docs/QUEUE.md when it exists", async () => {
    existingPaths = ["docs/QUEUE.md"];
    readFileByPath.set("QUEUE.md", QUEUE_FILE);
    const result = await rewriteQueueRegion("/repo", NEW_ITEMS);
    expect(renameTargets).toHaveLength(1);
    expect(renameTargets[0]!.endsWith("/repo/docs/QUEUE.md")).toBe(true);
    expect(writtenPaths[0]!.endsWith("/repo/docs/QUEUE.md.tmp")).toBe(true);
    expect(result.queue.map((q) => q.text)).toEqual([
      "Updated task one",
      "Brand new task",
    ]);
  });

  it("QUEUE.md write merges the done side into the returned backlog", async () => {
    existingPaths = ["docs/QUEUE.md"];
    readFileByPath.set("QUEUE.md", QUEUE_FILE);
    readFileByPath.set("DONE.md", DONE_FILE);
    readFileByPath.set("BACKLOG.md", null);
    const result = await rewriteQueueRegion("/repo", NEW_ITEMS);
    expect(result.queue).toHaveLength(2);
    expect(result.done).toHaveLength(1);
    expect(result.done[0]!.text).toBe("Split-file done task");
  });

  it("headerless QUEUE.md: writes canonical ## Queue heading + items", async () => {
    existingPaths = ["docs/QUEUE.md"];
    readFileByPath.set("QUEUE.md", HEADERLESS_QUEUE);
    const result = await rewriteQueueRegion("/repo", NEW_ITEMS);
    const committed = writtenContents[writtenContents.length - 1]!;
    expect(committed.startsWith("## Queue")).toBe(true);
    expect(committed).toContain("- [ ] (P1) Updated task one");
    expect(committed).toContain("- [ ] (P3) Brand new task");
    expect(result.queue).toHaveLength(2);
  });

  it("falls back to legacy docs/BACKLOG.md when QUEUE.md is absent", async () => {
    existingPaths = [];
    readFileContent = BASE_BACKLOG;
    const result = await rewriteQueueRegion("/repo", NEW_ITEMS);
    expect(renameTargets[0]!.endsWith("/repo/docs/BACKLOG.md")).toBe(true);
    const committed = writtenContents[writtenContents.length - 1]!;
    expect(committed).toContain("## Done"); // legacy Done region preserved
    expect(result.done).toHaveLength(1); // parsed from the same file, no extra read
  });

  it("legacy BACKLOG.md without a ## Queue section still throws (not implied)", async () => {
    existingPaths = [];
    readFileContent = "# BACKLOG\n\n## Done\n\n- [x] Old — r#1 · 2026-01-01\n";
    await expect(rewriteQueueRegion("/repo", NEW_ITEMS)).rejects.toThrow(
      /No ## Queue section found/
    );
  });
});
