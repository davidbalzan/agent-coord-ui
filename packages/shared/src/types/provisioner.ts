export type AgentRole = "coordinator" | "worker";

export interface AgentPreset {
  id: string;
  label: string;
  /** Claude model id, e.g. "claude-sonnet-4-6" */
  model: string;
  role: AgentRole;
  /** Worker lane, e.g. "repo-owner", "infra" */
  lane?: string;
  rooms?: string[];
  repoPath?: string;
  /** Shell command that starts the agent process, e.g. "claude" */
  launchCmd: string;
  /**
   * Skill invocation template. Supported placeholders:
   * {agentId}, {lane}, {rooms}, {model}
   */
  skillInvocation: string;
}

export interface SpawnAgentRequest {
  presetId: string;
  /** Desired agent id on the coord bus */
  agentId: string;
  paneKind?: "split-window" | "new-window" | "new-session";
  /** tmux target for split-window / new-window */
  paneTarget?: string;
}

export type SpawnStep =
  | "creating"
  | "launching"
  | "configuring"
  | "joining"
  | "confirming"
  | "done"
  | "error";

export interface SpawnProgressEvent {
  type: "spawn_progress";
  agentId: string;
  step: SpawnStep;
  paneId?: string;
  message?: string;
  error?: string;
}
