import { describe, expect, it } from "vitest";
import { parsePaneId, tmuxAttachArgs } from "./pty.js";

describe("parsePaneId", () => {
  it("parses tmux pane ids into session, window, and pane", () => {
    expect(parsePaneId("main:2.1")).toEqual({
      session: "main",
      window: "2",
      pane: "1",
      paneId: "main:2.1",
    });
  });

  it("allows hyphenated session names", () => {
    expect(parsePaneId("coord-ui:12.3")).toEqual({
      session: "coord-ui",
      window: "12",
      pane: "3",
      paneId: "coord-ui:12.3",
    });
  });

  it("rejects ids without a window and pane selector", () => {
    expect(() => parsePaneId("main")).toThrow(/invalid paneId/);
  });

  it("rejects ids with a non-numeric window", () => {
    expect(() => parsePaneId("main:foo.1")).toThrow(/invalid paneId/);
  });
});

describe("tmuxAttachArgs", () => {
  it("builds attach-session plus window and pane selection", () => {
    expect(tmuxAttachArgs(parsePaneId("main:2.1"))).toEqual([
      "attach-session",
      "-t",
      "main",
      ";",
      "select-window",
      "-t",
      "main:2",
      ";",
      "select-pane",
      "-t",
      "main:2.1",
    ]);
  });
});
