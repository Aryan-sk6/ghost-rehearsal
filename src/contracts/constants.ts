export const START_GIVE = 30;
export const GOAL_GIVE = 80;
export const MIN_GIVE = 0;
export const MAX_GIVE = 100;
export const MAX_USER_TURNS = 12;
export const MAX_REPLY_SENTENCES = 3;
export const MIN_USER_TURNS_FOR_ANALYSIS = 3;
export const LOST_GROUND_MOMENTS = 3;

export const SILENCE_TIMEOUT_MS = 1500;
export const NO_SPEECH_TIMEOUT_MS = 8000;
/** After this long talking without a break, the counterpart cuts in with a ready-made line. */
export const CUT_IN_AFTER_MS = 40_000;

const MAX_GIVE_DELTAS = [25, 20, 15, 11, 8] as const;

/** Largest change in give per counterpart turn, by difficulty 1-5. */
export function maxGiveDeltaFor(difficulty: number): number {
  const index = Math.min(5, Math.max(1, Math.round(difficulty))) - 1;
  return MAX_GIVE_DELTAS[index] ?? 15;
}

export const FILLER_PHRASES = ["you know", "i mean", "um", "uh", "erm", "like"] as const;
export type FillerPhrase = (typeof FILLER_PHRASES)[number];

export const HEDGE_PHRASES = [
  "i think maybe",
  "sorry but",
  "i was just wondering",
  "if that's okay",
  "i'm not sure",
  "i guess",
  "i suppose",
  "kind of",
  "sort of",
  "maybe",
  "perhaps",
] as const;
export type HedgePhrase = (typeof HEDGE_PHRASES)[number];

export const CONCESSION_PHRASES = [
  "i can accept",
  "i could accept",
  "i'll accept",
  "that's fine",
  "that works",
  "fair enough",
  "i can live with",
  "i could live with",
  "i'll take",
  "okay i'll",
  "ok i'll",
  "i understand if",
  "no problem",
  "never mind",
  "forget it",
] as const;
export type ConcessionPhrase = (typeof CONCESSION_PHRASES)[number];
