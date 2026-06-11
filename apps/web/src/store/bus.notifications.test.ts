import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BusEvent, MessageSnapshot } from "@coord-ui/shared";

let _dispatch: ((e: BusEvent) => void) | undefined;

vi.mock("../lib/ws.js", () => ({
  busSocket: {
    on: (fn: (e: BusEvent) => void) => {
      _dispatch = fn;
      return () => {
        _dispatch = undefined;
      };
    },
    connect: vi.fn(),
    send: vi.fn(),
  },
}));

const { useBusStore } = await import("./bus.js");

function dispatch(event: BusEvent) {
  _dispatch!(event);
}

const INITIAL_STATE = {
  agents: {},
  rooms: {},
  messages: [],
  panes: {},
  paneAnsi: {},
  selection: null,
  paneSelection: null,
  nameFilter: "",
  hoveredAgentId: null,
  sidePanelWidth: 0,
  presets: [],
  spawnProgress: {},
  launcherOpen: false,
  launcherPrefill: null,
  backlogs: [],
  openBacklogProject: null,
  inboxOpen: false,
  activeInboxThread: null,
  readState: {},
  notificationPopup: null,
  notificationQueue: [],
  notificationDockItems: [],
  notificationLastSeenMessageId: null,
  notificationLastSeenMessageCount: 0,
};

beforeEach(() => {
  useBusStore.setState(INITIAL_STATE);
});

describe("bus store — notification queue", () => {
  it("routes loud incoming David DMs to the popup", () => {
    dispatch({ type: "message", msg: msg("m-1", "BLOCKER: deploy failed") });

    const state = useBusStore.getState();
    expect(state.notificationPopup).toMatchObject({
      id: "m-1",
      priority: "loud",
      prefix: "BLOCKER",
    });
    expect(state.notificationDockItems).toEqual([]);
  });

  it("moves the active loud popup into the dock", () => {
    dispatch({
      type: "message",
      msg: msg("m-1", "DAVID_DECISION: choose route"),
    });

    useBusStore.getState().moveNotificationToDock("m-1");

    const state = useBusStore.getState();
    expect(state.notificationPopup).toBeNull();
    expect(state.notificationDockItems.map((item) => item.id)).toEqual(["m-1"]);
  });

  it("queues later loud popups until the active popup docks", () => {
    dispatch({ type: "message", msg: msg("m-1", "BLOCKER: first") });
    dispatch({ type: "message", msg: msg("m-2", "DAVID_DECISION: second") });

    expect(useBusStore.getState().notificationPopup?.id).toBe("m-1");
    expect(
      useBusStore.getState().notificationQueue.map((item) => item.id)
    ).toEqual(["m-2"]);

    useBusStore.getState().moveNotificationToDock("m-1");

    expect(useBusStore.getState().notificationPopup?.id).toBe("m-2");
    expect(
      useBusStore.getState().notificationDockItems.map((item) => item.id)
    ).toEqual(["m-1"]);
  });

  it("routes dock-priority incoming David DMs directly to the dock", () => {
    dispatch({ type: "message", msg: msg("m-1", "RISK: pipeline is red") });
    dispatch({ type: "message", msg: msg("m-2", "DONE: PR merged") });

    const state = useBusStore.getState();
    expect(state.notificationPopup).toBeNull();
    expect(state.notificationDockItems.map((item) => item.priority)).toEqual([
      "dock",
      "dock",
    ]);
  });

  it("keeps FYI subtle with no center popup", () => {
    dispatch({ type: "message", msg: msg("m-1", "FYI: build is green") });

    const state = useBusStore.getState();
    expect(state.notificationPopup).toBeNull();
    expect(state.notificationDockItems[0]).toMatchObject({
      id: "m-1",
      priority: "subtle",
      prefix: "FYI",
    });
  });

  it("ignores room messages and outbound David DMs", () => {
    dispatch({
      type: "message",
      msg: { ...msg("m-1", "BLOCKER: room", "coord"), isDM: false },
    });
    dispatch({
      type: "message",
      msg: msg("m-2", "BLOCKER: outbound", "david", "agent-1"),
    });

    const state = useBusStore.getState();
    expect(state.notificationPopup).toBeNull();
    expect(state.notificationDockItems).toEqual([]);
  });

  it("does not enqueue messages already seen from full_state", () => {
    const existing = msg("m-1", "BLOCKER: old message");
    dispatch({
      type: "full_state",
      agents: [],
      rooms: [],
      panes: [],
      messages: [existing],
    });
    dispatch({ type: "message", msg: existing });

    const state = useBusStore.getState();
    expect(state.notificationPopup).toBeNull();
    expect(state.notificationDockItems).toEqual([]);
    expect(state.notificationLastSeenMessageId).toBe("m-1");
  });

  it("dismiss and act both clear notifications", () => {
    dispatch({ type: "message", msg: msg("m-1", "RISK: review needed") });
    dispatch({ type: "message", msg: msg("m-2", "DONE: fixed") });

    useBusStore.getState().dismissNotification("m-1");
    expect(
      useBusStore.getState().notificationDockItems.map((item) => item.id)
    ).toEqual(["m-2"]);

    useBusStore.getState().actNotification("m-2");
    expect(useBusStore.getState().notificationDockItems).toEqual([]);
  });

  it("sets and clears popup origin coordinates", () => {
    dispatch({ type: "message", msg: msg("m-1", "BLOCKER: review needed") });

    useBusStore.getState().setNotificationOrigin("m-1", { x: 128, y: 256 });
    expect(useBusStore.getState().notificationPopup?.origin).toEqual({
      x: 128,
      y: 256,
    });

    useBusStore.getState().setNotificationOrigin("m-1", null);
    expect(useBusStore.getState().notificationPopup?.origin).toBeUndefined();
  });
});

function msg(
  id: string,
  body: string,
  from = "coord-ui-coordinator",
  to = "david"
): MessageSnapshot {
  return {
    id,
    from,
    to,
    body,
    isDM: true,
    timestamp: 1781177000000 + Number(id.replace(/\D/g, "")),
  };
}
