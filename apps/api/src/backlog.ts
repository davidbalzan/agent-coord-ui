import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ProjectBacklog,
  BacklogQueueItem,
  BacklogDoneItem,
  BacklogPriority,
} from "@coord-ui/shared";

// AGENT_COORD_PROJECT_REPOS = comma-separated absolute repo paths
export function getProjectRepoPaths(): string[] {
  const raw = process.env.AGENT_COORD_PROJECT_REPOS ?? "";
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

const QUEUE_RE = /^-\s+\[\s*\]\s+(P[123])\s+(.+?)\s*(?:—|-{1,2})\s*(.*)$/;
const DONE_RE = /^-\s+\[x\]\s+(.+?)\s*(?:—|-{1,2})\s*([^\s·]+)\s*·?\s*(.*)$/i;

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
          refs: m[3].trim(),
          checked: false,
        });
      }
    } else if (section === "done") {
      const m = DONE_RE.exec(line);
      if (m) {
        done.push({
          text: m[1].trim(),
          ref: m[2].trim(),
          date: m[3].trim(),
        });
      }
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

export async function loadAllBacklogs(): Promise<ProjectBacklog[]> {
  const paths = getProjectRepoPaths();
  const results = await Promise.all(paths.map(loadBacklog));
  return results.filter((b): b is ProjectBacklog => b !== null);
}
