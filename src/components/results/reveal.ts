import { GOAL_GIVE, START_GIVE } from "@/contracts/constants";
import type { Mood, Turn } from "@/contracts/types";
import { checkUserTurn, type TurnCheck } from "@/lib/analysis";

/** Their willingness after one of their turns. */
export interface GivePoint {
  turnIndex: number;
  give: number;
  mood: Mood;
}

/** One of the user's turns and how their next reply moved. */
export interface UserStep {
  turnIndex: number;
  /** 1-based count of the user's turns, as shown on screen. */
  number: number;
  text: string;
  before: number;
  /** Null when they never replied (the user ended the conversation). */
  after: number | null;
  delta: number | null;
  moodAfter: Mood | null;
  /** What the turn did (named a number, hedged, ...), from word matching. */
  checks: TurnCheck[];
}

export interface GiveTimeline {
  points: GivePoint[];
  steps: UserStep[];
  start: number;
  final: number;
  goal: number;
  /** turnIndex of the user turn that raised give the most, if any raised it. */
  bestTurnIndex: number | null;
  /** turnIndex of the user turn that lowered give the most, if any lowered it. */
  worstTurnIndex: number | null;
}

/**
 * Builds the after-the-fact view of how willing they were. `giveHistory` and
 * `moodHistory` hold one value per turn, as the engine stores them.
 */
export function buildGiveTimeline(
  turns: readonly Pick<Turn, "speaker" | "text">[],
  giveHistory: readonly number[],
  moodHistory: readonly Mood[],
): GiveTimeline {
  const giveAt = (i: number): number => giveHistory[i] ?? giveHistory[i - 1] ?? START_GIVE;

  const points: GivePoint[] = [];
  const steps: UserStep[] = [];
  let userCount = 0;
  turns.forEach((turn, i) => {
    if (turn.speaker === "counterpart") {
      points.push({ turnIndex: i, give: giveAt(i), mood: moodHistory[i] ?? "neutral" });
      return;
    }
    userCount += 1;
    const before = i === 0 ? START_GIVE : giveAt(i);
    const next = turns[i + 1];
    const replied = next?.speaker === "counterpart" && giveHistory[i + 1] !== undefined;
    const after = replied ? giveAt(i + 1) : null;
    steps.push({
      turnIndex: i,
      number: userCount,
      text: turn.text,
      before,
      after,
      delta: after === null ? null : after - before,
      moodAfter: replied ? (moodHistory[i + 1] ?? null) : null,
      checks: checkUserTurn(turn.text),
    });
  });

  let bestTurnIndex: number | null = null;
  let worstTurnIndex: number | null = null;
  let best = 0;
  let worst = 0;
  for (const step of steps) {
    if (step.delta === null) continue;
    if (step.delta > best) {
      best = step.delta;
      bestTurnIndex = step.turnIndex;
    }
    if (step.delta < worst) {
      worst = step.delta;
      worstTurnIndex = step.turnIndex;
    }
  }

  return {
    points,
    steps,
    start: START_GIVE,
    final: giveHistory.length > 0 ? giveAt(giveHistory.length - 1) : START_GIVE,
    goal: GOAL_GIVE,
    bestTurnIndex,
    worstTurnIndex,
  };
}

/** One plain sentence on where they ended up. */
export function outcomeLine(timeline: Pick<GiveTimeline, "final" | "goal" | "start">): string {
  const { final, goal, start } = timeline;
  if (final >= goal) return `They were ready to say yes: ${final} out of 100, past the ${goal} they needed.`;
  if (final <= 0) return "Their willingness fell to 0, so they shut the conversation down.";
  const moved = final - start;
  const change =
    moved === 0 ? "the same as where they started" : `${moved > 0 ? "up" : "down"} ${Math.abs(moved)} from ${start}`;
  return `Their willingness ended at ${final} out of 100, ${change}. They needed ${goal} to say yes.`;
}
