import { describe, expect, it } from "vitest";
import { GOAL_GIVE, START_GIVE } from "@/contracts/constants";
import type { Mood, Turn } from "@/contracts/types";
import { GIVE_HISTORY, MOOD_HISTORY, TURNS } from "./fixtures";
import {
  LONG_PAUSE_MS,
  buildGiveTimeline,
  compareRetry,
  outcomeLine,
  pauseLabel,
  retryVerdict,
} from "./reveal";

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

describe("pauses", () => {
  const t = (speaker: Turn["speaker"], text: string, startedAtMs: number, endedAtMs: number): Turn => ({
    speaker,
    text,
    startedAtMs,
    endedAtMs,
  });
  // Their opening, then three user turns after 4.0s, 6.2s and 3.5s silences.
  const turns: Turn[] = [
    t("counterpart", "Hi.", 0, 1000),
    t("user", "I want a raise.", 5000, 6000),
    t("counterpart", "No budget.", 7000, 8000),
    t("user", "Fair enough.", 14200, 15000),
    t("counterpart", "Anything else?", 16000, 17000),
    t("user", "I led the launch.", 20500, 21000),
    t("counterpart", "Noted.", 22000, 23000),
  ];
  const give = [30, 30, 25, 25, 25, 25, 27];
  const moods: Mood[] = ["neutral", "neutral", "guarded", "guarded", "impatient", "impatient", "neutral"];

  it("flags long silences and whether they followed pushback", () => {
    const steps = buildGiveTimeline(turns, give, moods).steps;
    expect(steps.map((s) => s.pause)).toEqual([
      { ms: 4000, afterPushback: false, thenGaveGround: false },
      { ms: 6200, afterPushback: true, thenGaveGround: true },
      { ms: 3500, afterPushback: true, thenGaveGround: false },
    ]);
    expect(steps.map((s) => (s.pause ? pauseLabel(s.pause) : null))).toEqual([
      "Paused 4.0s before answering",
      "Paused 6.2s after pushback, then gave ground",
      "Paused 3.5s after pushback",
    ]);
  });

  it("flags from exactly LONG_PAUSE_MS and ignores overlaps", () => {
    const at = (gapMs: number) =>
      buildGiveTimeline(
        [t("counterpart", "Hi.", 0, 1000), t("user", "Hello.", 1000 + gapMs, 9000)],
        [30, 30],
        ["neutral", "neutral"],
      ).steps[0]?.pause ?? null;
    expect(at(LONG_PAUSE_MS - 1)).toBeNull();
    expect(at(LONG_PAUSE_MS)).toMatchObject({ ms: LONG_PAUSE_MS });
    expect(at(-500)).toBeNull();
  });

  it("has no long pauses in the shared fixture", () => {
    expect(buildGiveTimeline(TURNS, GIVE_HISTORY, MOOD_HISTORY).steps.every((s) => s.pause === null)).toBe(true);
  });
});

describe("compareRetry", () => {
  const original = { turnIndex: 3, turns: TURNS, giveHistory: GIVE_HISTORY, moodHistory: MOOD_HISTORY };
  const redo = (text: string, give: number) => {
    const turns: Turn[] = [
      ...TURNS.slice(0, 3),
      { speaker: "user", text, startedAtMs: 6000, endedAtMs: 6800 },
      { speaker: "counterpart", text: "Okay.", startedAtMs: 8000, endedAtMs: 8800 },
    ];
    return compareRetry(original, turns, [...GIVE_HISTORY.slice(0, 4), give], [...MOOD_HISTORY.slice(0, 4), "open"]);
  };

  it("compares the redone turn with the original", () => {
    // Before: "Fair enough, never mind." moved 25 -> 15 (down 10).
    const c = redo("I'd like 10% because I led the launch.", 33);
    expect(c?.before.text).toBe("Fair enough, never mind.");
    expect(c?.after?.delta).toBe(8);
    expect(c?.deltaChange).toBe(18);
    expect(c?.gained.map((x) => x.kind)).toEqual(["number", "reason"]);
    expect(c?.dropped.map((x) => x.kind)).toEqual(["concession"]);
    expect(c?.finalBefore).toBe(20);
    expect(c?.finalAfter).toBe(33);
    expect(retryVerdict(c!)).toBe("Your new line moved them 18 points more than before.");
  });

  it("says when the new line did worse or the same", () => {
    expect(retryVerdict(redo("Sorry, never mind.", 10)!)).toBe(
      "Your new line moved them 5 points less than before.",
    );
    expect(retryVerdict(redo("Fine.", 15)!)).toBe("Your new line had the same effect as before.");
  });

  it("handles a redo that ended before the turn", () => {
    const c = compareRetry(original, TURNS.slice(0, 3), GIVE_HISTORY.slice(0, 3), MOOD_HISTORY.slice(0, 3));
    expect(c?.after).toBeNull();
    expect(c?.deltaChange).toBeNull();
    expect(retryVerdict(c!)).toBe("You ended before saying this turn again.");
  });

  it("returns null when the snapshot has no such user turn", () => {
    expect(compareRetry({ ...original, turnIndex: 2 }, TURNS, GIVE_HISTORY, MOOD_HISTORY)).toBeNull();
  });
});
