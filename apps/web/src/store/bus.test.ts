import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BusEvent } from "@coord-ui/shared";

// Capture the handler the store registers so we can dispatch events directly.
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

// Import after mock is wired — vi.mock is hoisted so _dispatch is set on first import.
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
  resolvedDecisions: {},
};

beforeEach(() => {
  // Merge mode — resets data without wiping action functions
  useBusStore.setState(INITIAL_STATE);
});

describe("bus store — WS event handling", () => {
  it("agent_join adds agent to store", () => {
    dispatch({
      type: "agent_join",
      agent: {
        id: "agent-1",
        name: "alice",
        status: "active",
        rooms: [],
        lastSeen: 0,
      },
    });
    expect(useBusStore.getState().agents["agent-1"]).toMatchObject({
      id: "agent-1",
      name: "alice",
      status: "active",
    });
  });

  it("agent_update mutates existing agent status", () => {
    useBusStore.setState({
      agents: {
        "agent-1": {
          id: "agent-1",
          name: "alice",
          status: "active",
          rooms: [],
          lastSeen: 0,
        },
      },
    });
    dispatch({
      type: "agent_update",
      agentId: "agent-1",
      patch: { status: "idle" },
    });
    expect(useBusStore.getState().agents["agent-1"]?.status).toBe("idle");
    expect(useBusStore.getState().agents["agent-1"]?.name).toBe("alice");
  });

  it("agent_leave removes agent from store", () => {
    useBusStore.setState({
      agents: {
        "agent-1": {
          id: "agent-1",
          name: "alice",
          status: "active",
          rooms: [],
          lastSeen: 0,
        },
      },
    });
    dispatch({ type: "agent_leave", agentId: "agent-1" });
    expect(useBusStore.getState().agents["agent-1"]).toBeUndefined();
  });

  it("room_update adds room and membership list", () => {
    dispatch({
      type: "room_update",
      room: { id: "general", name: "general", members: ["agent-1", "agent-2"] },
    });
    expect(useBusStore.getState().rooms["general"]).toMatchObject({
      id: "general",
      members: ["agent-1", "agent-2"],
    });
  });

  it("room_update replaces existing room", () => {
    useBusStore.setState({
      rooms: {
        general: { id: "general", name: "general", members: ["agent-1"] },
      },
    });
    dispatch({
      type: "room_update",
      room: { id: "general", name: "general", members: ["agent-1", "agent-2"] },
    });
    expect(useBusStore.getState().rooms["general"]?.members).toEqual([
      "agent-1",
      "agent-2",
    ]);
  });

  it("message event appends to messages array", () => {
    const msg = {
      id: "msg-1",
      from: "agent-1",
      to: "general",
      body: "hello",
      timestamp: Date.now(),
      isDM: false,
    };
    dispatch({ type: "message", msg });
    expect(useBusStore.getState().messages).toHaveLength(1);
    expect(useBusStore.getState().messages[0]).toMatchObject({ id: "msg-1" });
  });

  it("multiple message events accumulate in order", () => {
    const base = {
      from: "agent-1",
      to: "general",
      timestamp: Date.now(),
      isDM: false,
    };
    dispatch({ type: "message", msg: { ...base, id: "msg-1", body: "one" } });
    dispatch({ type: "message", msg: { ...base, id: "msg-2", body: "two" } });
    const msgs = useBusStore.getState().messages;
    expect(msgs).toHaveLength(2);
    expect(msgs.map((m) => m.id)).toEqual(["msg-1", "msg-2"]);
  });
});

describe("bus store — setters", () => {
  it("setNameFilter updates nameFilter", () => {
    useBusStore.getState().setNameFilter("alice");
    expect(useBusStore.getState().nameFilter).toBe("alice");
  });

  it("setNameFilter can be cleared", () => {
    useBusStore.getState().setNameFilter("alice");
    useBusStore.getState().setNameFilter("");
    expect(useBusStore.getState().nameFilter).toBe("");
  });

  it("setPaneSelection updates paneSelection", () => {
    useBusStore.getState().setPaneSelection("pane-42");
    expect(useBusStore.getState().paneSelection).toBe("pane-42");
  });

  it("setSelection updates selection", () => {
    useBusStore.getState().setSelection({ kind: "agent", id: "agent-1" });
    expect(useBusStore.getState().selection).toEqual({
      kind: "agent",
      id: "agent-1",
    });
  });
});

describe("bus store — decision resolution", () => {
  it("resolvedDecisions starts empty", () => {
    expect(useBusStore.getState().resolvedDecisions).toEqual({});
  });

  it("addResolvedDecision records messageId → chosenOption", () => {
    useBusStore
      .getState()
      .addResolvedDecision("msg-dd-1", "Deploy to QA first.");
    expect(useBusStore.getState().resolvedDecisions["msg-dd-1"]).toBe(
      "Deploy to QA first."
    );
  });

  it("addResolvedDecision accumulates multiple resolved decisions", () => {
    useBusStore.getState().addResolvedDecision("msg-a", "Option A");
    useBusStore.getState().addResolvedDecision("msg-b", "Option B");
    const state = useBusStore.getState().resolvedDecisions;
    expect(state["msg-a"]).toBe("Option A");
    expect(state["msg-b"]).toBe("Option B");
  });

  it("resolving one decision does not affect others", () => {
    useBusStore.setState({
      resolvedDecisions: { "msg-existing": "already chosen" },
    });
    useBusStore.getState().addResolvedDecision("msg-new", "new choice");
    expect(useBusStore.getState().resolvedDecisions["msg-existing"]).toBe(
      "already chosen"
    );
    expect(useBusStore.getState().resolvedDecisions["msg-new"]).toBe(
      "new choice"
    );
  });

  it("unresolved decision messageId returns undefined", () => {
    expect(
      useBusStore.getState().resolvedDecisions["msg-not-resolved"]
    ).toBeUndefined();
  });
});
