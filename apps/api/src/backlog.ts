import { exec } from "node:child_process";
import { readFile, writeFile, rename } from "node:fs/promises";
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

// Queue: canonical format is - [ ] (P1) <task> [— refs/constraints (optional)]
// Priority MUST be parenthesized: (P1) / (P2) / (P3).
// Everything after priority is captured as text (no greedy split on prose em-dashes).
const QUEUE_RE = /^-\s+\[\s*\]\s+\((P[123])\)\s+(.+)$/;

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
    if (/^##/.test(line)) {
      section = null;
      continue;
    }

    if (section === "queue") {
      const m = QUEUE_RE.exec(line);
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

export async function loadBacklog(
  repoPath: string
): Promise<ProjectBacklog | null> {
  try {
    const content = await readFile(
      join(repoPath, "docs", "BACKLOG.md"),
      "utf8"
    );
    return parseBacklog(repoPath, content);
  } catch {
    return null; // file absent or unreadable — not an error
  }
}

export async function rewriteQueueRegion(
  repoPath: string,
  items: BacklogQueueItem[]
): Promise<ProjectBacklog> {
  const filePath = join(repoPath, "docs", "BACKLOG.md");
  const content = await readFile(filePath, "utf8");
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
  if (queueStart === -1) throw new Error(`No ## Queue section found in ${filePath}`);

  const heading = lines[queueStart];
  const newQueueLines = [
    heading,
    "",
    ...items.map((item) => `- [ ] (${item.priority}) ${item.text}`),
    "",
  ];
  const newContent = [
    ...lines.slice(0, queueStart),
    ...newQueueLines,
    ...lines.slice(queueEnd),
  ].join("\n");

  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, newContent, "utf8");
  await rename(tmpPath, filePath);
  return parseBacklog(repoPath, newContent);
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
