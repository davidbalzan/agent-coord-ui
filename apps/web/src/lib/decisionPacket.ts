export interface DavidDecisionPacket {
  title: string;
  context: string;
  options: string[];
  recommendation: string;
  ifNoAction: string;
}

type Section = "context" | "options" | "recommendation" | "ifNoAction";

const DECISION_RE = /^\s*DAVID_DECISION:\s*(.+?)\s*$/i;
const CONTEXT_RE = /^\s*Context:\s*(.*)$/i;
const OPTIONS_RE = /^\s*Options:\s*$/i;
const OPTION_RE = /^\s*\d+\.\s+(.+?)\s*$/;
const RECOMMENDATION_RE = /^\s*Recommendation:\s*(.*)$/i;
const IF_NO_ACTION_RE = /^\s*If no action:\s*(.*)$/i;

export function parseDavidDecisionPacket(
  body: string
): DavidDecisionPacket | null {
  try {
    const lines = body.replace(/\r\n?/g, "\n").split("\n");
    const firstContentIndex = lines.findIndex((line) => line.trim() !== "");

    if (firstContentIndex === -1) return null;

    const titleMatch = DECISION_RE.exec(lines[firstContentIndex]);
    if (!titleMatch) return null;

    const title = titleMatch[1].trim();
    const parts: Record<Exclude<Section, "options">, string[]> = {
      context: [],
      recommendation: [],
      ifNoAction: [],
    };
    const options: string[] = [];
    let currentSection: Section | null = null;

    for (const line of lines.slice(firstContentIndex + 1)) {
      const contextMatch = CONTEXT_RE.exec(line);
      if (contextMatch) {
        currentSection = "context";
        if (contextMatch[1].trim()) parts.context.push(contextMatch[1].trim());
        continue;
      }

      if (OPTIONS_RE.test(line)) {
        currentSection = "options";
        continue;
      }

      const recommendationMatch = RECOMMENDATION_RE.exec(line);
      if (recommendationMatch) {
        currentSection = "recommendation";
        if (recommendationMatch[1].trim()) {
          parts.recommendation.push(recommendationMatch[1].trim());
        }
        continue;
      }

      const ifNoActionMatch = IF_NO_ACTION_RE.exec(line);
      if (ifNoActionMatch) {
        currentSection = "ifNoAction";
        if (ifNoActionMatch[1].trim()) {
          parts.ifNoAction.push(ifNoActionMatch[1].trim());
        }
        continue;
      }

      if (currentSection === "options") {
        const optionMatch = OPTION_RE.exec(line);
        if (optionMatch) options.push(optionMatch[1].trim());
        continue;
      }

      if (currentSection && line.trim()) {
        parts[currentSection].push(line.trim());
      }
    }

    const context = parts.context.join("\n").trim();
    const recommendation = parts.recommendation.join("\n").trim();
    const ifNoAction = parts.ifNoAction.join("\n").trim();

    if (
      !title ||
      !context ||
      options.length === 0 ||
      !recommendation ||
      !ifNoAction
    ) {
      return null;
    }

    return {
      title,
      context,
      options,
      recommendation,
      ifNoAction,
    };
  } catch {
    return null;
  }
}
