import { describe, expect, it } from "vitest";
import { FILLER_PHRASES, HEDGE_PHRASES } from "@/contracts/constants";
import type { Mood, Session, Turn } from "@/contracts/types";
import { computeMetrics } from "./metrics";
import { countPhrases, normalizeText } from "./normalize";

const scenario = {
  id: "s",
  title: "t",
  userGoal: "g",
  counterpartRole: "boss",
  counterpartTraits: ["firm"],
  difficulty: 3,
  openingLine: "Hi",
  hiddenBottomLine: "secret",
};

/** Rows are [speaker, text, startedAtMs, endedAtMs, giveAfterTurn]. */
function build(rows: [Turn["speaker"], string, number, number, number][]): Session {
  const turns: Turn[] = rows.map(([speaker, text, startedAtMs, endedAtMs]) => ({
    speaker,
    text,
    startedAtMs,
    endedAtMs,
  }));
  return {
    id: "x",
    scenario,
    status: "ended",
    turns,
    giveHistory: rows.map((r) => r[4]),
    moodHistory: rows.map((): Mood => "neutral"),
    endReason: "user_ended",
    startedAtMs: 0,
    endedAtMs: 100000,
  };
}

describe("normalizeText", () => {
  it("lowercases, fixes apostrophes, strips punctuation, collapses spaces", () => {
    expect(normalizeText("  I’M   Not, sure!! ")).toBe("i'm not sure");
    expect(normalizeText("Sorry, but")).toBe("sorry but");
  });
});

describe("countPhrases", () => {
  it("prefers the longest phrase and does not overlap", () => {
    const c = countPhrases("I think maybe so. Maybe not", HEDGE_PHRASES);
    expect(c["i think maybe"]).toBe(1);
    expect(c["maybe"]).toBe(1);
  });

  it("matches whole words only and includes zero keys", () => {
    const c = countPhrases("a umbrella, humming", FILLER_PHRASES);
    expect(Object.keys(c)).toEqual([...FILLER_PHRASES]);
    expect(Object.values(c).every((n) => n === 0)).toBe(true);
  });
});

describe("computeMetrics", () => {
  it("fixture A: wpm, talk ratio, fillers, longest pause", () => {
    const s = build([
      ["counterpart", "Hello there", 0, 5000, 30],
      ["user", "Um, I mean you know it is like a good idea", 8000, 38000, 30], // 11 words, 30s
      ["counterpart", "Hmm", 39000, 49000, 45],
      ["user", "Like I said, sorry, but uh no", 52000, 62000, 45], // 7 words, 10s
    ]);
    const m = computeMetrics(s);
    expect(m.userWordCount).toBe(18);
    expect(m.wordsPerMinute).toBe(27); // 18 / (40000/60000)
    expect(m.talkRatio).toBe(0.73); // 40000/55000 = 0.7272...
    expect(m.fillers).toEqual({ "you know": 1, "i mean": 1, um: 1, uh: 1, erm: 0, like: 2 });
    expect(m.fillerCount).toBe(6);
    expect(m.hedges["sorry but"]).toBe(1);
    expect(m.hedgeCount).toBe(1);
    expect(m.longestPauseMs).toBe(3000);
  });

  it("fixture B: rounding and hedge longest-first", () => {
    const s = build([
      ["counterpart", "Hi", 0, 1000, 30],
      ["user", "I think maybe perhaps we could, kind of, try", 1000, 8000, 30], // 9 words, 7s
      ["counterpart", "No", 8000, 9000, 20],
    ]);
    const m = computeMetrics(s);
    expect(m.wordsPerMinute).toBe(77.1); // 9 / (7/60) = 77.142...
    expect(m.talkRatio).toBe(0.78); // 7000/9000 = 0.777...
    expect(m.hedges["i think maybe"]).toBe(1);
    expect(m.hedges["maybe"]).toBe(0);
    expect(m.hedges["perhaps"]).toBe(1);
    expect(m.hedges["kind of"]).toBe(1);
    expect(m.hedgeCount).toBe(3);
    expect(m.longestPauseMs).toBe(0);
  });

  it("fixture C: concessions depend on whether the counterpart just raised give", () => {
    const s = build([
      ["counterpart", "Opening", 0, 1000, 30],
      ["user", "Fair enough, that's fine", 1000, 3000, 30], // 30 vs START_GIVE 30: no raise
      ["counterpart", "Better", 3000, 4000, 50],
      ["user", "No problem at all", 4000, 5000, 50], // raised 30 -> 50: not counted
      ["counterpart", "Hm", 5000, 6000, 40],
      ["user", "I'll take it", 6000, 7000, 40], // lowered: counted
      ["counterpart", "Ok", 7000, 8000, 60],
      ["user", "Let's continue", 8000, 9000, 60],
    ]);
    expect(computeMetrics(s).concededFirstCount).toBe(2);
  });

  it("returns zeros for zero-duration and empty sessions", () => {
    const z = computeMetrics(build([["user", "hello world", 5, 5, 30]]));
    expect(z.wordsPerMinute).toBe(0);
    expect(z.talkRatio).toBe(0);
    expect(z.userWordCount).toBe(2);
    const empty = computeMetrics(build([]));
    expect(empty.wordsPerMinute).toBe(0);
    expect(empty.talkRatio).toBe(0);
    expect(empty.longestPauseMs).toBe(0);
    expect(Object.keys(empty.fillers)).toHaveLength(FILLER_PHRASES.length);
  });

  it("clamps overlapping turns to a zero pause", () => {
    const s = build([
      ["counterpart", "Hi", 0, 5000, 30],
      ["user", "yes", 4000, 6000, 30],
    ]);
    expect(computeMetrics(s).longestPauseMs).toBe(0);
  });
});
