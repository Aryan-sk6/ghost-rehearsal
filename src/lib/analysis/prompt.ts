import { LOST_GROUND_MOMENTS } from "@/contracts/constants";
import type { Session, SessionMetrics } from "@/contracts/types";

export function buildAnalysisSystemPrompt(session: Session, metrics: SessionMetrics): string {
  const { scenario } = session;
  return [
    "You are a blunt but kind negotiation coach. You review a practice conversation and tell the person exactly what worked and what cost them ground. Be specific, never vague, and never cruel.",
    [
      "Scenario:",
      `- Title: ${scenario.title}`,
      `- What the person (\"You\") wanted: ${scenario.userGoal}`,
      `- Who they spoke to (\"Them\"): ${scenario.counterpartRole}`,
      `- Difficulty: ${scenario.difficulty} of 5`,
      `- Their hidden bottom line (the person never saw this): ${scenario.hiddenBottomLine}`,
    ].join("\n"),
    `Measured speech metrics (already computed, use them as given and do not recompute):\n${JSON.stringify(metrics, null, 2)}`,
    [
      "Respond with JSON only, no other text, in exactly this shape:",
      '{"scores": {"clarity": int, "confidence": int, "handlingPushback": int, "outcome": int}, "summary": string, "lostGround": [{"turnIndex": int, "userSaid": string, "whyItHurt": string, "strongerLine": string}]}',
    ].join("\n"),
    [
      "Rules:",
      "- Every score is an integer from 1 to 10.",
      "- summary is at most 600 characters.",
      `- lostGround has exactly ${LOST_GROUND_MOMENTS} entries, at ${LOST_GROUND_MOMENTS} different turnIndex values.`,
      '- Each turnIndex is the number in "[turn i]" of one of YOUR turns ("You"), never one of theirs ("Them").',
      "- userSaid quotes what You said in that turn. whyItHurt is at most 400 characters. strongerLine is a better line to say instead, at most 300 characters, spoken aloud.",
    ].join("\n"),
  ].join("\n\n");
}

/** Transcript from the coach's side: "You" is the person practising, "Them" is the counterpart. */
export function buildAnalysisUserMessage(session: Session): string {
  const lines = session.turns.map(
    (turn, i) => `[turn ${i}] ${turn.speaker === "user" ? "You" : "Them"}: ${turn.text}`,
  );
  return ["Transcript:", lines.join("\n"), "Analyse this conversation as the JSON object described."].join("\n\n");
}

export function buildAnalysisRetryMessage(message: string, problem: string): string {
  return `${message}\n\nYour previous output was invalid: ${problem} Reply again with only the corrected JSON object.`;
}
