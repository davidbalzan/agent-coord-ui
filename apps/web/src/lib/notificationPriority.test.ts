import { describe, expect, it } from "vitest";
import { classifyPriority, extractPrefix } from "./notificationPriority.js";

describe("extractPrefix", () => {
  it("extracts a leading known prefix with a colon", () => {
    expect(extractPrefix("DAVID_DECISION: choose a route")).toBe(
      "DAVID_DECISION"
    );
  });

  it("extracts a leading known prefix without a colon", () => {
    expect(extractPrefix("BLOCKER deploy cannot continue")).toBe("BLOCKER");
  });

  it("is case-insensitive and normalizes the prefix", () => {
    expect(extractPrefix("risk: token handoff is unclear")).toBe("RISK");
  });

  it("returns null when the prefix appears mid-sentence", () => {
    expect(extractPrefix("please treat this as BLOCKER: deploy failed")).toBe(
      null
    );
  });
});

describe("classifyPriority", () => {
  it.each([
    ["DAVID_DECISION: choose deploy target", "loud"],
    ["BLOCKER: cannot proceed", "loud"],
    ["RISK: production deploy is red", "dock"],
    ["DONE: PR merged", "dock"],
    ["FYI: build is green", "subtle"],
    ["AGENT_ACTION: review PR #15", "subtle"],
  ] as const)("maps %s to %s", (body, priority) => {
    expect(classifyPriority(body)).toBe(priority);
  });

  it("returns subtle for an unknown leading prefix", () => {
    expect(classifyPriority("QUESTION: should we continue?")).toBe("subtle");
  });

  it("returns subtle when there is no prefix", () => {
    expect(classifyPriority("the build is green")).toBe("subtle");
  });

  it("is case-insensitive when classifying priorities", () => {
    expect(classifyPriority("done: merged")).toBe("dock");
  });

  it("does not classify prefixes that are not leading", () => {
    expect(classifyPriority("heads up: DAVID_DECISION needed")).toBe("subtle");
  });
});
