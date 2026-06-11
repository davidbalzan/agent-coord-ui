import { describe, expect, it } from "vitest";
import { parseDavidDecisionPacket } from "./decisionPacket.js";

describe("parseDavidDecisionPacket", () => {
  it("parses a canonical DAVID_DECISION packet", () => {
    const parsed = parseDavidDecisionPacket(`DAVID_DECISION: Pick deploy target

Context: The feature is ready, but only one environment can receive it today.
Options:
1. Deploy to QA first.
2. Deploy directly to production.
Recommendation: Deploy to QA first.
If no action: The release remains blocked.`);

    expect(parsed).toEqual({
      title: "Pick deploy target",
      context:
        "The feature is ready, but only one environment can receive it today.",
      options: ["Deploy to QA first.", "Deploy directly to production."],
      recommendation: "Deploy to QA first.",
      ifNoAction: "The release remains blocked.",
    });
  });

  it("returns null when required sections are missing", () => {
    expect(
      parseDavidDecisionPacket(`DAVID_DECISION: Missing recommendation

Context: We need a decision.
Options:
1. Do it now.
2. Wait.
If no action: Nothing changes.`)
    ).toBeNull();
  });

  it("returns null for non-packet text", () => {
    expect(parseDavidDecisionPacket("FYI: the build is green")).toBeNull();
  });

  it("supports multi-line context text", () => {
    const parsed = parseDavidDecisionPacket(`DAVID_DECISION: Token bootstrap

Context: The bootstrap script is ready.
It needs a real token from David.
The token must stay out of chat.
Options:
1. Run it now.
2. Hold until prod is green.
Recommendation: Hold until prod is green.
If no action: Bootstrap stays blocked.`);

    expect(parsed?.context).toBe(
      [
        "The bootstrap script is ready.",
        "It needs a real token from David.",
        "The token must stay out of chat.",
      ].join("\n")
    );
  });

  it("supports a single numbered option", () => {
    const parsed = parseDavidDecisionPacket(`DAVID_DECISION: Keep current route

Context: There is one safe route.
Options:
1. Keep the current route.
Recommendation: Keep the current route.
If no action: The current route remains.`);

    expect(parsed?.options).toEqual(["Keep the current route."]);
  });

  it("supports more than two numbered options", () => {
    const parsed = parseDavidDecisionPacket(`DAVID_DECISION: Choose reviewer

Context: A non-author review is required.
Options:
1. Route to BLF.
2. Route to coord-ui-worker.
3. Ask David to review in GitHub.
Recommendation: Route to coord-ui-worker.
If no action: The PR remains unreviewed.`);

    expect(parsed?.options).toEqual([
      "Route to BLF.",
      "Route to coord-ui-worker.",
      "Ask David to review in GitHub.",
    ]);
  });
});
