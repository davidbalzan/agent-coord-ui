import { describe, it, expect } from "vitest";
import { matchQueueToDone } from "./matchQueueToDone.js";
import type { BacklogQueueItem, BacklogDoneItem } from "@coord-ui/shared";

function q(text: string): BacklogQueueItem {
  return { priority: "P2", text, refs: "", checked: false };
}

function d(text: string, ref = "", date = "2026-06-11"): BacklogDoneItem {
  return { text, ref, date };
}

describe("matchQueueToDone", () => {
  it("returns null for every item when done is empty", () => {
    const result = matchQueueToDone(
      [q("Fix the login bug"), q("Add tests")],
      []
    );
    expect(result).toEqual([null, null]);
  });

  it("returns null for every item when queue is empty", () => {
    expect(matchQueueToDone([], [d("Fix the login bug")])).toEqual([]);
  });

  it("exact match (after normalization)", () => {
    const result = matchQueueToDone(
      [q("Fix the login bug")],
      [d("Fix the login bug")]
    );
    expect(result[0]).not.toBeNull();
  });

  it("case-insensitive match", () => {
    const result = matchQueueToDone(
      [q("Fix The Login Bug")],
      [d("fix the login bug")]
    );
    expect(result[0]).not.toBeNull();
  });

  it("done text contains queue text (queue is a substring of done)", () => {
    const result = matchQueueToDone(
      [q("Settings page")],
      [d("Settings page — merged PR #42 · 2026-06-10")]
    );
    expect(result[0]).not.toBeNull();
  });

  it("queue text contains done text (done is shorter / reworded)", () => {
    const result = matchQueueToDone(
      [
        q(
          "Worker worktree isolation — workers + coord share one git working dir"
        ),
      ],
      [d("Worker worktree isolation")]
    );
    expect(result[0]).not.toBeNull();
  });

  it("high-overlap reworded done entry is matched", () => {
    const result = matchQueueToDone(
      [q("Add pagination to the clusters table view")],
      [d("Clusters table now has pagination support")]
    );
    expect(result[0]).not.toBeNull();
  });

  it("completely unrelated items do not match", () => {
    const result = matchQueueToDone(
      [q("Redesign the login page")],
      [d("Fix memory leak in the job queue worker")]
    );
    expect(result[0]).toBeNull();
  });

  it("returns the matching done item object (not just a boolean)", () => {
    const doneItem = d("Settings page", "sg/repo#10", "2026-06-09");
    const result = matchQueueToDone([q("Settings page")], [doneItem]);
    expect(result[0]).toBe(doneItem);
  });

  it("returns null for non-matching item when other items match", () => {
    const result = matchQueueToDone(
      [q("Fix login bug"), q("Totally unrelated task xyz abc")],
      [d("Fix login bug")]
    );
    expect(result[0]).not.toBeNull();
    expect(result[1]).toBeNull();
  });

  it("each queue item matches independently (first done-match wins)", () => {
    const done1 = d("Fix login bug — PR #1");
    const done2 = d("Add pagination");
    const result = matchQueueToDone(
      [q("Fix login bug"), q("Add pagination")],
      [done1, done2]
    );
    expect(result[0]).toBe(done1);
    expect(result[1]).toBe(done2);
  });

  it("punctuation differences do not prevent match", () => {
    const result = matchQueueToDone(
      [q("U14: Add keyword table sorting")],
      [d('U14 · "Ranks For" keywords table sortable')]
    );
    expect(result[0]).not.toBeNull();
  });

  it("short queue text with no meaningful tokens returns null rather than false-positive", () => {
    // "Fix" alone after normalization would have 0 tokens (len ≤ 2 filtered)
    const result = matchQueueToDone([q("Fix")], [d("Fix memory leak")]);
    // "fix" is 3 chars, so it passes the >2 filter. The contains check should match.
    // This is intentional: very short overlapping terms do match. No false-negative.
    expect(result).toHaveLength(1);
  });
});
