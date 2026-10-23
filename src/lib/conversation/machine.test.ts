import { describe, expect, it } from "vitest";
import { MAX_USER_TURNS, START_GIVE } from "@/contracts/constants";
import { IllegalTransitionError, RehearsalError, type TransitionAction } from "@/contracts/errors";
import type { CounterpartReply, Scenario, Session } from "@/contracts/types";
import {
  addCounterpartTurn,
  addOpeningTurn,
  addUserTurn,
  countUserTurns,
  createSession,
  currentGive,
  endSession,
} from "./machine";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const scenario: Scenario = deepFreeze({
  id: "s",
  title: "Raise",
  userGoal: "Get a raise",
  counterpartRole: "Manager",
  counterpartTraits: ["busy"],
  difficulty: 1,
  openingLine: "Hello, what can I do for you?",
  hiddenBottomLine: "8% max",
});

const t = { startedAtMs: 10, endedAtMs: 20 };
const reply = (give: number, mood: CounterpartReply["mood"] = "open"): CounterpartReply => ({
  reply: "Okay.",
  mood,
  give,
});

const fresh = () => deepFreeze(createSession(scenario, { id: "x", nowMs: 5 }));
const awaitingUser = () => deepFreeze(addOpeningTurn(fresh(), t));
const awaitingCounterpart = () => deepFreeze(addUserTurn(awaitingUser(), "I want a raise", t));

function expectIllegal(fn: () => unknown, from: Session["status"], action: TransitionAction) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(IllegalTransitionError);
    expect(e).toMatchObject({ from, action });
    return;
  }
  throw new Error("expected IllegalTransitionError");
}

function assertAligned(s: Session) {
  expect(s.giveHistory).toHaveLength(s.turns.length);
  expect(s.moodHistory).toHaveLength(s.turns.length);
}

describe("turn order", () => {
  it("runs opening → user → counterpart → user", () => {
    const s0 = fresh();
    expect(s0).toMatchObject({ status: "counterpart_opening", startedAtMs: 5, endReason: null });
    expect(currentGive(s0)).toBe(START_GIVE);

    const s1 = awaitingUser();
    expect(s1.status).toBe("awaiting_user");
    expect(s1.turns[0]).toMatchObject({ speaker: "counterpart", text: scenario.openingLine });
    expect(s1.giveHistory).toEqual([START_GIVE]);
    expect(s1.moodHistory).toEqual(["neutral"]);

    const s2 = awaitingCounterpart();
    expect(s2.status).toBe("awaiting_counterpart");
    expect(s2.turns[1]).toMatchObject({ speaker: "user", text: "I want a raise" });
    expect(s2.giveHistory).toEqual([START_GIVE, START_GIVE]);
    expect(s2.moodHistory).toEqual(["neutral", "neutral"]);

    const s3 = addCounterpartTurn(s2, reply(40, "warm"), t);
    expect(s3.status).toBe("awaiting_user");
    expect(currentGive(s3)).toBe(40);
    expect(s3.moodHistory[2]).toBe("warm");
    expect(countUserTurns(s3)).toBe(1);
    assertAligned(s3);
  });

  it("copies the previous mood on a user turn", () => {
    const s = addUserTurn(addCounterpartTurn(awaitingCounterpart(), reply(35, "guarded"), t), "more", t);
    expect(s.moodHistory[s.moodHistory.length - 1]).toBe("guarded");
    expect(currentGive(s)).toBe(35);
    assertAligned(s);
  });

  it("clamps the give through the difficulty cap", () => {
    const s = addCounterpartTurn(awaitingCounterpart(), reply(100), t);
    expect(currentGive(s)).toBe(55);
  });
});

describe("illegal transitions", () => {
  const states: Record<Session["status"], () => Session> = {
    counterpart_opening: fresh,
    awaiting_user: awaitingUser,
    awaiting_counterpart: awaitingCounterpart,
    ended: () => deepFreeze(endSession(awaitingUser(), 99)),
  };

  it("addOpeningTurn only from counterpart_opening", () => {
    for (const status of ["awaiting_user", "awaiting_counterpart", "ended"] as const) {
      expectIllegal(() => addOpeningTurn(states[status](), t), status, "addOpeningTurn");
    }
  });

  it("addUserTurn only from awaiting_user", () => {
    for (const status of ["counterpart_opening", "awaiting_counterpart", "ended"] as const) {
      expectIllegal(() => addUserTurn(states[status](), "hi", t), status, "addUserTurn");
    }
  });

  it("addCounterpartTurn only from awaiting_counterpart", () => {
    for (const status of ["counterpart_opening", "awaiting_user", "ended"] as const) {
      expectIllegal(() => addCounterpartTurn(states[status](), reply(40), t), status, "addCounterpartTurn");
    }
  });

  it("endSession from anything but ended", () => {
    expectIllegal(() => endSession(states.ended(), 100), "ended", "endSession");
    for (const status of ["counterpart_opening", "awaiting_user", "awaiting_counterpart"] as const) {
      expect(endSession(states[status](), 50).status).toBe("ended");
    }
  });

  it("rejects whitespace-only user text", () => {
    expect(() => addUserTurn(awaitingUser(), " \n\t ", t)).toThrow(RehearsalError);
    try {
      addUserTurn(awaitingUser(), "   ", t);
    } catch (e) {
      expect(e).toMatchObject({ code: "empty_user_turn" });
    }
  });
});

describe("end reasons", () => {
  it("endSession sets user_ended and endedAtMs", () => {
    const s = endSession(awaitingUser(), 77);
    expect(s).toMatchObject({ status: "ended", endReason: "user_ended", endedAtMs: 77 });
    assertAligned(s);
  });

  it("goal_reached at >= 80", () => {
    let s: Session = awaitingUser();
    for (const g of [55, 80]) {
      s = addCounterpartTurn(addUserTurn(s, "push", t), reply(g), t);
    }
    expect(currentGive(s)).toBe(80);
    expect(s).toMatchObject({ status: "ended", endReason: "goal_reached", endedAtMs: 20 });
  });

  it("give_zero at 0", () => {
    let s: Session = awaitingUser();
    for (const g of [5, 0]) {
      s = addCounterpartTurn(addUserTurn(s, "push", t), reply(g), t);
    }
    expect(currentGive(s)).toBe(0);
    expect(s).toMatchObject({ status: "ended", endReason: "give_zero" });
  });

  it("turn_cap after 12 user turns", () => {
    let s: Session = awaitingUser();
    for (let i = 1; i <= MAX_USER_TURNS; i++) {
      s = addCounterpartTurn(addUserTurn(s, `turn ${i}`, t), reply(START_GIVE), t);
      if (i < MAX_USER_TURNS) expect(s.status).toBe("awaiting_user");
    }
    expect(countUserTurns(s)).toBe(MAX_USER_TURNS);
    expect(s).toMatchObject({ status: "ended", endReason: "turn_cap" });
    assertAligned(s);
  });

  it("goal_reached wins over turn_cap on the last turn", () => {
    let s: Session = awaitingUser();
    const gives = [55, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 80];
    expect(gives).toHaveLength(MAX_USER_TURNS);
    for (const [i, g] of gives.entries()) {
      s = addCounterpartTurn(addUserTurn(s, `turn ${i}`, t), reply(g), t);
    }
    expect(s.endReason).toBe("goal_reached");
  });
});

describe("immutability", () => {
  it("never mutates frozen inputs", () => {
    const s = awaitingCounterpart();
    const next = addCounterpartTurn(s, deepFreeze(reply(50)), t);
    expect(next).not.toBe(s);
    expect(s.turns).toHaveLength(2);
    expect(s.status).toBe("awaiting_counterpart");
    expect(endSession(s, 1)).not.toBe(s);
  });
});
