export type Priority = "loud" | "dock" | "subtle";

export type BusPrefix =
  | "FYI"
  | "AGENT_ACTION"
  | "DAVID_DECISION"
  | "BLOCKER"
  | "RISK"
  | "DONE";

const PREFIX_PRIORITIES: Record<BusPrefix, Priority> = {
  DAVID_DECISION: "loud",
  BLOCKER: "loud",
  RISK: "dock",
  DONE: "dock",
  FYI: "subtle",
  AGENT_ACTION: "subtle",
};

const PREFIX_RE =
  /^\s*(FYI|AGENT_ACTION|DAVID_DECISION|BLOCKER|RISK|DONE)(?::|\s|$)/i;

export function extractPrefix(body: string): BusPrefix | null {
  const match = PREFIX_RE.exec(body);
  if (!match) return null;

  return match[1].toUpperCase() as BusPrefix;
}

export function classifyPriority(body: string): Priority {
  const prefix = extractPrefix(body);
  if (!prefix) return "subtle";

  return PREFIX_PRIORITIES[prefix];
}
