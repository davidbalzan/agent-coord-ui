import { exec } from "node:child_process";
import { access, readFile, writeFile, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type {
  ProjectBacklog,
  BacklogQueueItem,
  BacklogDoneItem,
  BacklogPriority,
} from "@coord-ui/shared";
import { tmuxWatcher } from "./tmux.js";

const execAsync = promisify(exec);

// AGENT_COORD_PROJECT_REPOS = comma-separated absolute repo paths (additive)
export function getProjectRepoPaths(): string[] {
  const raw = process.env.AGENT_COORD_PROJECT_REPOS ?? "";
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Resolve a directory to its git repo root. Returns null if not in a git repo. */
export async function gitRoot(cwd: string): Promise<string | null> {
  try {
    const escaped = cwd.replace(/'/g, "'\\''");
    const { stdout } = await execAsync(
      `git -C '${escaped}' rev-parse --show-toplevel`
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/** Collect unique git roots from panes that are matched to a live agent. */
export async function getAgentPaneRoots(): Promise<string[]> {
  const agentPanes = tmuxWatcher.panes.filter((p) => p.agentId && p.cwd);
  const roots = await Promise.all(agentPanes.map((p) => gitRoot(p.cwd)));
  return [...new Set(roots.filter((r): r is string => r !== null))];
}

/** Build a root→agentIds map from live panes. Preserves the agentId→root link
 *  that getAgentPaneRoots discards. Multiple agents at the same root accumulate. */
export async function getAgentRootsWithAgents(): Promise<
  Map<string, string[]>
> {
  const agentPanes = tmuxWatcher.panes.filter(
    (p): p is typeof p & { agentId: string } => !!p.agentId && !!p.cwd
  );
  const resolved = await Promise.all(
    agentPanes.map(async (p) => ({
      agentId: p.agentId,
      root: await gitRoot(p.cwd),
    }))
  );
  const map = new Map<string, string[]>();
  for (const { agentId, root } of resolved) {
    if (root === null) continue;
    const existing = map.get(root);
    if (existing) {
      if (!existing.includes(agentId)) existing.push(agentId);
    } else {
      map.set(root, [agentId]);
    }
  }
  return map;
}

// Queue item formats accepted (priority is always P1/P2/P3; group 1 = priority,
// group 2 = task text — kept consistent across both regexes):
//   canonical: - [ ] (P1) <task>   (empty checkbox + parenthesized priority)
//   compact:   - [P1] <task>       (priority as the checkbox tag)
// Canonical is preferred (see docs/BACKLOG.md); compact is tolerated so backlogs
// written in the common "- [P1] …" style surface instead of loading empty.
// Everything after the priority is captured as text (no greedy split on prose em-dashes).
const QUEUE_RE = /^-\s+\[\s*\]\s+\((P[123])\)\s+(.+)$/;
const QUEUE_RE_COMPACT = /^-\s+\[(P[123])\]\s+(.+)$/;

// Done items are parsed procedurally — right-anchored — because task text can
// contain em-dashes and · as prose punctuation, making left-anchored splits
// produce wrong text/ref/date splits.
function parseDoneItem(line: string): BacklogDoneItem | null {
  const prefixMatch = /^-\s+\[x\]\s+/i.exec(line);
  if (!prefixMatch) return null;
  let rest = line.slice(prefixMatch[0].length).trim();
  if (!rest) return null;

  // 1. Strip trailing date: " · YYYY-MM-DD"
  let date = "";
  const dateMatch = / · (\d{4}-\d{2}-\d{2})$/.exec(rest);
  if (dateMatch) {
    date = dateMatch[1]!;
    rest = rest.slice(0, dateMatch.index).trim();
  }

  // 2. Strip one trailing period (common in prose-style entries)
  if (rest.endsWith(".")) rest = rest.slice(0, -1).trim();

  // 3. Split on the LAST " — " (em-dash + spaces) to separate text from ref.
  //    This keeps internal em-dashes intact in the task text.
  const dashIdx = rest.lastIndexOf(" — ");
  let text: string;
  let ref: string;
  if (dashIdx >= 0) {
    text = rest.slice(0, dashIdx).trim();
    ref = rest.slice(dashIdx + 3).trim(); // 3 = " — " length
  } else {
    text = rest;
    ref = "";
  }

  return text ? { text, ref, date } : null;
}

export function parseBacklog(project: string, content: string): ProjectBacklog {
  const queue: BacklogQueueItem[] = [];
  const done: BacklogDoneItem[] = [];

  let section: "queue" | "done" | null = null;

  for (const raw of content.split("\n")) {
    const line = raw.trim();

    if (/^##\s+Queue/i.test(line)) {
      section = "queue";
      continue;
    }
    if (/^##\s+Done/i.test(line)) {
      section = "done";
      continue;
    }
    // Only an h2 (exactly "## ") ends a section. h3+ (### …) are SUBSECTION
    // headers within Queue/Done (e.g. "### Phase 2 — …") and must not reset it,
    // or every item under a subsection is silently dropped.
    if (/^##(?!#)/.test(line)) {
      section = null;
      continue;
    }

    if (section === "queue") {
      const m = QUEUE_RE.exec(line) ?? QUEUE_RE_COMPACT.exec(line);
      if (m) {
        queue.push({
          priority: m[1] as BacklogPriority,
          text: m[2].trim(),
          refs: "",
          checked: false,
        });
      }
    } else if (section === "done") {
      const item = parseDoneItem(line);
      if (item) done.push(item);
    }
  }

  return { project, queue, done };
}

/**
 * Resolve the default remote branch ref for a repo root.
 * Tries origin/HEAD, then origin/main, then main.
 * Returns null if none can be resolved.
 */
export async function resolveDefaultRef(root: string): Promise<string | null> {
  const esc = root.replace(/'/g, "'\\''");
  // 1. Prefer origin/HEAD (set by git clone, reflects remote default branch)
  try {
    const { stdout } = await execAsync(
      `git -C '${esc}' symbolic-ref --quiet refs/remotes/origin/HEAD`
    );
    const ref = stdout.trim(); // e.g. "refs/remotes/origin/main"
    if (ref) return ref.replace(/^refs\/remotes\//, ""); // → "origin/main"
  } catch {
    // not set — fall through
  }
  // 2. Fallback: check origin/main exists
  try {
    await execAsync(`git -C '${esc}' rev-parse --verify --quiet origin/main`);
    return "origin/main";
  } catch {
    // no origin/main
  }
  // 3. Last resort: local main
  try {
    await execAsync(`git -C '${esc}' rev-parse --verify --quiet main`);
    return "main";
  } catch {
    return null;
  }
}

/**
 * Read a repo doc file from the repo's default branch via git-show.
 * Falls back to the working-copy file if the ref is unavailable or git fails.
 * Never throws. `ref` may be passed to skip re-resolving the default branch.
 */
async function readRepoDoc(
  root: string,
  relPath: string,
  ref?: string | null
): Promise<string | null> {
  // Attempt canonical default-branch read
  const resolvedRef = ref !== undefined ? ref : await resolveDefaultRef(root);
  if (resolvedRef) {
    try {
      const esc = root.replace(/'/g, "'\\''");
      const { stdout } = await execAsync(
        `git -C '${esc}' show ${resolvedRef}:${relPath}`
      );
      if (stdout) return stdout;
    } catch {
      // ref exists but file absent on that branch, or other git error — fall through
    }
  }

  // Fallback: working-copy file
  try {
    return await readFile(join(root, ...relPath.split("/")), "utf8");
  } catch {
    return null;
  }
}

/**
 * Read docs/BACKLOG.md (legacy single-file layout) from the repo's default
 * branch via git-show, falling back to the working copy. Never throws.
 */
export async function readBacklogContent(root: string): Promise<string | null> {
  return readRepoDoc(root, "docs/BACKLOG.md");
}

const QUEUE_HEADER_RE = /^\s*##\s+Queue/im;
const DONE_HEADER_RE = /^\s*##\s+Done/im;

/**
 * A dedicated QUEUE.md/DONE.md is expected to carry its `## Queue`/`## Done`
 * header (the region moved verbatim from BACKLOG.md), but be tolerant: if the
 * file has no recognized section header, treat the whole file as that implied
 * section. A non-tolerant parser here silently renders an empty queue with no
 * signal — the failure class fixed in agent-coord-ui#58.
 */
function withImpliedSection(
  content: string,
  section: "Queue" | "Done"
): string {
  const headerRe = section === "Queue" ? QUEUE_HEADER_RE : DONE_HEADER_RE;
  return headerRe.test(content) ? content : `## ${section}\n${content}`;
}

/**
 * Load a project's backlog, preferring the split two-file layout
 * (docs/QUEUE.md + docs/DONE.md, per the queue-split proposal —
 * davidbalzan/agent-coordination#5) with per-side independent fallback to the
 * legacy single-file docs/BACKLOG.md. Independent fallback handles
 * mid-migration repos where only one dedicated file exists yet.
 */
export async function loadBacklog(
  repoPath: string
): Promise<ProjectBacklog | null> {
  const ref = await resolveDefaultRef(repoPath);
  const [queueDoc, doneDoc] = await Promise.all([
    readRepoDoc(repoPath, "docs/QUEUE.md", ref),
    readRepoDoc(repoPath, "docs/DONE.md", ref),
  ]);

  let legacy: string | null = null;
  if (queueDoc === null || doneDoc === null) {
    legacy = await readRepoDoc(repoPath, "docs/BACKLOG.md", ref);
  }

  if (queueDoc === null && doneDoc === null && legacy === null) return null;

  const queueSource =
    queueDoc !== null ? withImpliedSection(queueDoc, "Queue") : legacy;
  const doneSource =
    doneDoc !== null ? withImpliedSection(doneDoc, "Done") : legacy;

  return {
    project: repoPath,
    queue: queueSource ? parseBacklog(repoPath, queueSource).queue : [],
    done: doneSource ? parseBacklog(repoPath, doneSource).done : [],
  };
}

interface FileIdentity {
  mtimeMs: number;
  size: number;
}

async function fileIdentity(filePath: string): Promise<FileIdentity> {
  const s = await stat(filePath);
  return { mtimeMs: s.mtimeMs, size: s.size };
}

function identityEqual(a: FileIdentity, b: FileIdentity): boolean {
  return a.mtimeMs === b.mtimeMs && a.size === b.size;
}

function renderQueueLines(items: BacklogQueueItem[]): string[] {
  return items.map((item) => `- [ ] (${item.priority}) ${item.text}`);
}

/**
 * Replace only the ## Queue region in a backlog content string.
 * When no ## Queue section is found: with `impliedQueue` (dedicated QUEUE.md,
 * whole file is the queue region) the canonical `## Queue` heading + items
 * replace the content; otherwise (legacy BACKLOG.md) it throws.
 */
function applyQueueItems(
  content: string,
  items: BacklogQueueItem[],
  impliedQueue = false
): string {
  const lines = content.split("\n");
  let queueStart = -1;
  let queueEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^##\s+Queue/i.test(trimmed)) {
      queueStart = i;
    } else if (queueStart !== -1 && /^##/.test(trimmed)) {
      queueEnd = i;
      break;
    }
  }

  if (queueStart === -1) {
    if (impliedQueue) {
      return ["## Queue", "", ...renderQueueLines(items), ""].join("\n");
    }
    throw new Error("No ## Queue section found");
  }

  const heading = lines[queueStart];
  const newQueueLines = [heading, "", ...renderQueueLines(items), ""];

  return [
    ...lines.slice(0, queueStart),
    ...newQueueLines,
    ...lines.slice(queueEnd),
  ].join("\n");
}

const CAS_MAX_ATTEMPTS = 5;

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Atomically replace the ## Queue region of the queue-bearing backlog file
 * using compare-and-swap. Targets docs/QUEUE.md when it exists (split layout,
 * queue-split proposal — davidbalzan/agent-coordination#5); otherwise the
 * legacy docs/BACKLOG.md, where CAS protects against a concurrent ## Done
 * appender sharing the file.
 *
 * Read → capture identity → build content → re-stat before rename →
 * if changed: re-read + re-apply → retry (max 5 attempts).
 * Only renames when the base file is verified unchanged since the read.
 */
export async function rewriteQueueRegion(
  repoPath: string,
  items: BacklogQueueItem[]
): Promise<ProjectBacklog> {
  const queuePath = join(repoPath, "docs", "QUEUE.md");
  const useQueueFile = await pathExists(queuePath);
  const filePath = useQueueFile
    ? queuePath
    : join(repoPath, "docs", "BACKLOG.md");
  const tmpPath = `${filePath}.tmp`;

  for (let attempt = 0; attempt < CAS_MAX_ATTEMPTS; attempt++) {
    // 1. Capture identity, then read
    const identityBefore = await fileIdentity(filePath);
    const content = await readFile(filePath, "utf8");

    // 2. Build new content with only ## Queue replaced
    const newContent = applyQueueItems(content, items, useQueueFile);

    // 3. Stage to .tmp
    await writeFile(tmpPath, newContent, "utf8");

    // 4. Re-stat: verify file unchanged since our read
    const identityAfter = await fileIdentity(filePath);
    if (!identityEqual(identityBefore, identityAfter)) {
      // File changed (concurrent Done append or other write) — retry with fresh read
      continue;
    }

    // 5. Commit: rename is atomic on POSIX
    await rename(tmpPath, filePath);
    const parsed = parseBacklog(repoPath, newContent);
    if (!useQueueFile) return parsed;
    // Split layout: QUEUE.md carries no ## Done — re-read the done side so the
    // response is a complete backlog, not one with a spuriously empty done list.
    const full = await loadBacklog(repoPath);
    return { ...parsed, done: full?.done ?? [] };
  }

  throw new Error(
    `rewriteQueueRegion: failed after ${CAS_MAX_ATTEMPTS} attempts due to concurrent modifications`
  );
}

export async function loadAllBacklogs(): Promise<ProjectBacklog[]> {
  const agentRootsMap = await getAgentRootsWithAgents();
  const agentRoots = [...agentRootsMap.keys()];
  const allPaths = [...new Set([...getProjectRepoPaths(), ...agentRoots])];
  const results = await Promise.all(allPaths.map(loadBacklog));
  const backlogs = results.filter((b): b is ProjectBacklog => b !== null);
  for (const b of backlogs) {
    b.agentIds = agentRootsMap.get(b.project) ?? [];
  }
  return backlogs;
}
