import { FILLER_PHRASES, HEDGE_PHRASES } from "@/contracts/constants";
import type { Mood, Scenario, SessionAnalysis, SessionMetrics, Turn } from "@/contracts/types";
import { BUILTIN_SCENARIOS } from "@/scenarios/builtins";

/** Test fixtures shared by the results tests. */
export const SCENARIO: Scenario = BUILTIN_SCENARIOS[0] as Scenario;

function turn(speaker: Turn["speaker"], text: string, at: number): Turn {
  return { speaker, text, startedAtMs: at * 1000, endedAtMs: at * 1000 + 800 };
}

export const TURNS: Turn[] = [
  turn("counterpart", "Thanks for making time.", 0),
  turn("user", "I think maybe I deserve a raise.", 2),
  turn("counterpart", "Budgets are tight.", 4),
  turn("user", "Fair enough, never mind.", 6),
  turn("counterpart", "Good to hear.", 8),
  turn("user", "Could we revisit in spring?", 10),
  turn("counterpart", "Perhaps.", 12),
];

/** Their willingness and mood after each of TURNS. */
export const GIVE_HISTORY: number[] = [30, 30, 25, 25, 15, 15, 20];
export const MOOD_HISTORY: Mood[] = [
  "neutral",
  "neutral",
  "guarded",
  "guarded",
  "impatient",
  "impatient",
  "neutral",
];

export const METRICS: SessionMetrics = {
  userWordCount: 16,
  wordsPerMinute: 142.5,
  talkRatio: 0.456,
  fillerCount: 2,
  fillers: Object.fromEntries(FILLER_PHRASES.map((p) => [p, 0])),
  hedgeCount: 3,
  hedges: Object.fromEntries(HEDGE_PHRASES.map((p) => [p, 0])),
  longestPauseMs: 2340,
  concededFirstCount: 1,
};

export const ANALYSIS: SessionAnalysis = {
  scores: { clarity: 7, confidence: 4, handlingPushback: 5, outcome: 3 },
  summary: "You stayed polite but gave way too early.",
  lostGround: [
    {
      turnIndex: 1,
      userSaid: "I think maybe I deserve a raise.",
      whyItHurt: "Hedging weakened your ask.",
      strongerLine: "I'd like a 10% raise, and here's why.",
    },
    {
      turnIndex: 3,
      userSaid: "Fair enough, never mind.",
      whyItHurt: "You dropped your request.",
      strongerLine: "I understand, so what can we agree on today?",
    },
    {
      turnIndex: 5,
      userSaid: "Could we revisit in spring?",
      whyItHurt: "It handed them the timeline.",
      strongerLine: "Let's set a date this week to decide.",
    },
  ],
};
