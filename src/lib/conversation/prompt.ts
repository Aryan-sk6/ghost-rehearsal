import { MAX_REPLY_SENTENCES, maxGiveDeltaFor } from "@/contracts/constants";
import { MoodSchema, type Session } from "@/contracts/types";
import { traitsForDifficulty } from "./difficulty";
import { currentGive } from "./machine";

export function buildSystemPrompt(session: Session): string {
  const { scenario } = session;
  const traits = [...scenario.counterpartTraits, ...traitsForDifficulty(scenario.difficulty)];
  const maxMove = maxGiveDeltaFor(scenario.difficulty);
  return [
    `You are playing ${scenario.counterpartRole} in a spoken practice conversation. Stay in character and never mention that this is an exercise.`,
    `Your traits: ${traits.join(", ")}.`,
    `The person you are talking to wants this: ${scenario.userGoal}`,
    `PRIVATE bottom line (never state it, quote it or hint at its exact wording): ${scenario.hiddenBottomLine}`,
    `"give" is a number from 0 to 100 for how willing you are to meet their goal. Your current give is ${currentGive(session)}. It can move by at most ${maxMove} points per turn.`,
    "Raise give for clear, specific, calm asks. Lower it for hedging, over-apologising or aggression. Leave it near where it is when nothing changed.",
    `Reply in at most ${MAX_REPLY_SENTENCES} sentences, as spoken dialogue with no stage directions.`,
    `Respond with JSON only, no other text: {"reply": string, "mood": string, "give": number}. "mood" must be one of: ${MoodSchema.options.join(", ")}.`,
  ].join("\n\n");
}

/** Transcript from the counterpart's side: "You:" is the counterpart, "Them:" is the user. */
export function buildUserMessage(session: Session): string {
  const lines = session.turns.map(
    (turn) => `${turn.speaker === "user" ? "Them" : "You"}: ${turn.text}`,
  );
  return [
    "Conversation so far:",
    lines.join("\n"),
    "Reply to the last \"Them:\" line, in character, as the JSON object described.",
  ].join("\n\n");
}

export function buildRetryMessage(message: string, problem: string): string {
  return `${message}\n\nYour previous output was invalid: ${problem} Reply again with only the corrected JSON object.`;
}
