import {
  CONCESSION_PHRASES,
  FILLER_PHRASES,
  HEDGE_PHRASES,
  START_GIVE,
} from "@/contracts/constants";
import type { ComputeMetrics } from "@/contracts/modules";
import type { Session } from "@/contracts/types";
import { countPhrases, countWords, sumCounts } from "./normalize";

const durationMs = (turn: { startedAtMs: number; endedAtMs: number }): number =>
  Math.max(0, turn.endedAtMs - turn.startedAtMs);

function addCounts(target: Record<string, number>, extra: Record<string, number>): void {
  for (const key of Object.keys(extra)) target[key] = (target[key] ?? 0) + (extra[key] ?? 0);
}

/** True when the counterpart turn just before user turn `i` raised give. */
function counterpartRaisedBefore(session: Session, i: number): boolean {
  const after = session.giveHistory[i - 1];
  if (after === undefined) return false;
  const before = i - 2 >= 0 ? (session.giveHistory[i - 2] ?? START_GIVE) : START_GIVE;
  return after > before;
}

export const computeMetrics: ComputeMetrics = (session) => {
  let userWords = 0;
  let userMs = 0;
  let counterpartMs = 0;
  let longestPauseMs = 0;
  let concededFirstCount = 0;
  const fillers = countPhrases("", FILLER_PHRASES);
  const hedges = countPhrases("", HEDGE_PHRASES);

  session.turns.forEach((turn, i) => {
    if (turn.speaker === "counterpart") {
      counterpartMs += durationMs(turn);
      return;
    }
    userWords += countWords(turn.text);
    userMs += durationMs(turn);
    addCounts(fillers, countPhrases(turn.text, FILLER_PHRASES));
    addCounts(hedges, countPhrases(turn.text, HEDGE_PHRASES));

    const previous = session.turns[i - 1];
    if (i >= 1 && previous) {
      longestPauseMs = Math.max(longestPauseMs, Math.max(0, turn.startedAtMs - previous.endedAtMs));
    }

    const conceded = sumCounts(countPhrases(turn.text, CONCESSION_PHRASES)) > 0;
    if (conceded && !counterpartRaisedBefore(session, i)) concededFirstCount += 1;
  });

  const wordsPerMinute = userMs > 0 ? Math.round((userWords / (userMs / 60000)) * 10) / 10 : 0;
  const talkRatio =
    userMs + counterpartMs > 0 ? Math.round((userMs / (userMs + counterpartMs)) * 100) / 100 : 0;

  return {
    userWordCount: userWords,
    wordsPerMinute,
    talkRatio,
    fillerCount: sumCounts(fillers),
    fillers,
    hedgeCount: sumCounts(hedges),
    hedges,
    longestPauseMs,
    concededFirstCount,
  };
};
