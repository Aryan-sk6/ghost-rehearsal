import { describe, expect, it } from "vitest";
import { GOAL_GIVE, START_GIVE } from "@/contracts/constants";
import { GIVE_HISTORY, MOOD_HISTORY, TURNS } from "./fixtures";
import { buildGiveTimeline, outcomeLine } from "./reveal";

describe("buildGiveTimeline", () => {
  it("plots one point per counterpart turn", () => {
    const t = buildGiveTimeline(TURNS, GIVE_HISTORY, MOOD_HISTORY);
    expect(t.points.map((p) => [p.turnIndex, p.give, p.mood])).toEqual([
      [0, 30, "neutral"],
      [2, 25, "guarded"],
      [4, 15, "impatient"],
      [6, 20, "neutral"],
    ]);
    expect(t.start).toBe(START_GIVE);
    expect(t.final).toBe(20);
    expect(t.goal).toBe(GOAL_GIVE);
  });

  it("measures how each user turn moved their next reply", () => {
    const t = buildGiveTimeline(TURNS, GIVE_HISTORY, MOOD_HISTORY);
    expect(t.steps.map((s) => [s.number, s.before, s.after, s.delta, s.moodAfter])).toEqual([
      [1, 30, 25, -5, "guarded"],
      [2, 25, 15, -10, "impatient"],
      [3, 15, 20, 5, "neutral"],
    ]);
    expect(t.bestTurnIndex).toBe(5);
    expect(t.worstTurnIndex).toBe(3);
  });

  it("marks a last user turn with no reply", () => {
    const turns = TURNS.slice(0, 6);
    const t = buildGiveTimeline(turns, GIVE_HISTORY.slice(0, 6), MOOD_HISTORY.slice(0, 6));
    const last = t.steps.at(-1);
    expect(last).toMatchObject({ number: 3, before: 15, after: null, delta: null, moodAfter: null });
    expect(t.bestTurnIndex).toBeNull();
    expect(t.final).toBe(15);
  });

  it("has no best or worst when nothing moved", () => {
    const t = buildGiveTimeline(TURNS, [30, 30, 30, 30, 30, 30, 30], MOOD_HISTORY);
    expect(t.bestTurnIndex).toBeNull();
    expect(t.worstTurnIndex).toBeNull();
  });

  it("handles an empty session", () => {
    const t = buildGiveTimeline([], [], []);
    expect(t.points).toEqual([]);
    expect(t.steps).toEqual([]);
    expect(t.final).toBe(START_GIVE);
  });
});

describe("outcomeLine", () => {
  it.each([
    [85, "They were ready to say yes: 85 out of 100, past the 80 they needed."],
    [0, "Their willingness fell to 0, so they shut the conversation down."],
    [20, "Their willingness ended at 20 out of 100, down 10 from 30. They needed 80 to say yes."],
    [52, "Their willingness ended at 52 out of 100, up 22 from 30. They needed 80 to say yes."],
    [30, "Their willingness ended at 30 out of 100, the same as where they started. They needed 80 to say yes."],
  ])("final %i", (final, copy) => {
    expect(outcomeLine({ final, start: 30, goal: 80 })).toBe(copy);
  });
});
