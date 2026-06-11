export type BacklogPriority = "P1" | "P2" | "P3";

export interface BacklogQueueItem {
  priority: BacklogPriority;
  text: string;
  refs: string;
  checked: false;
}

export interface BacklogDoneItem {
  text: string;
  ref: string; // e.g. "owner/repo#N"
  date: string;
}

export interface ProjectBacklog {
  project: string; // absolute repo path
  queue: BacklogQueueItem[];
  done: BacklogDoneItem[];
}
