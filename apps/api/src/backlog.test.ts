import { describe, it, expect, vi, beforeEach } from "vitest";

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

// ─── Import after mocks ───────────────────────────────────────────────────────

const { parseBacklog, loadBacklog, loadAllBacklogs, getProjectRepoPaths } =
  await import("./backlog.js");

// ─── Fixture ──────────────────────────────────────────────────────────────────

const FIXTURE = `# Task Backlog

## Queue

- [ ] P1 Implement auth flow — owner/repo#12, owner/repo#15
- [ ] P2 Add rate limiting — owner/repo#20
- [ ] P3 Refactor logger —

## Done

- [x] Fix login redirect — owner/repo#8 · 2026-06-01
- [x] Bootstrap CI — owner/repo#3 · 2026-05-20
`;

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
    readFileContent = null; // triggers ENOENT
    const result = await loadBacklog("/no/backlog/here");
    expect(result).toBeNull();
  });
});

// ─── loadAllBacklogs ──────────────────────────────────────────────────────────

describe("loadAllBacklogs", () => {
  beforeEach(() => {
    readFileContent = FIXTURE;
    process.env.AGENT_COORD_PROJECT_REPOS = "/repo/a,/repo/b";
  });

  it("returns one result per configured repo that has a backlog", async () => {
    const results = await loadAllBacklogs();
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.project)).toEqual(["/repo/a", "/repo/b"]);
  });

  it("skips repos whose backlog is absent when one path has no file", async () => {
    // Only one repo configured — its file is absent
    process.env.AGENT_COORD_PROJECT_REPOS = "/repo/missing";
    readFileContent = null; // triggers ENOENT for that path
    const results = await loadAllBacklogs();
    expect(results).toHaveLength(0);
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
