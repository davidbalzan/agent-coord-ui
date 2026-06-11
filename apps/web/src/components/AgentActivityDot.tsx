import { useBusStore } from "../store/bus.js";
import { isAgentActive } from "../store/bus.js";
import { PulsingDot } from "./primitives/PulsingDot.js";

export function AgentActivityDot({ agentId }: { agentId: string }) {
  const active = useBusStore((s) => isAgentActive(s, agentId));
  if (!active) return null;
  return <PulsingDot />;
}
