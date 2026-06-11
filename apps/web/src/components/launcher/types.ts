export const AGENT_ID_RE = /^[\w-]{1,64}$/;

export const STEPS = [
  "creating",
  "launching",
  "configuring",
  "joining",
  "confirming",
  "done",
] as const;

export type StepName = (typeof STEPS)[number] | "error";

export const STEP_LABELS: Record<string, string> = {
  creating: "CREATE PANE",
  launching: "LAUNCH PROCESS",
  configuring: "CONFIGURE",
  joining: "JOIN BUS",
  confirming: "CONFIRM REG",
  done: "ONLINE",
  error: "ERROR",
};
