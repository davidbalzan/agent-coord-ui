import type { BacklogQueueItem, BacklogDoneItem } from "@coord-ui/shared";

/**
 * Normalize a string for fuzzy comparison:
 * lowercase, collapse whitespace, strip common punctuation.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[–—·•:,.()[\]{}"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split into tokens, filtering short stop-words. */
function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 2);
}

/**
 * Returns true if queueText is "likely done" according to doneText.
 * Two strategies, either is sufficient:
 *   1. contains: one normalized string contains the other (for reworded short entries)
 *   2. token-overlap: ≥60% of the queue item's tokens appear in the done text
 */
function isMatch(queueText: string, doneText: string): boolean {
  const qNorm = normalize(queueText);
  const dNorm = normalize(doneText);

  // Contains in either direction
  if (dNorm.includes(qNorm) || qNorm.includes(dNorm)) return true;

  // Token overlap: at least 60% of queue tokens present in done text
  const qTokens = tokens(queueText);
  if (qTokens.length === 0) return false;
  const matched = qTokens.filter((t) => dNorm.includes(t)).length;
  return matched / qTokens.length >= 0.5;
}

/**
 * For each queue item, find the first done entry it matches.
 * Returns a parallel array of the same length as `queue`;
 * each element is the matching done item or null.
 */
export function matchQueueToDone(
  queue: BacklogQueueItem[],
  done: BacklogDoneItem[]
): Array<BacklogDoneItem | null> {
  return queue.map((qItem) => {
    const match = done.find((dItem) => isMatch(qItem.text, dItem.text));
    return match ?? null;
  });
}
