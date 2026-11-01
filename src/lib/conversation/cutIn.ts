import type { CounterpartReply, Session } from "@/contracts/types";
import { currentGive } from "./machine";

/** Said when the user talks too long without a break. Written here, so no model call is needed. */
export const CUT_IN_LINES = [
  "Sorry to stop you there. What exactly are you asking me for?",
  "Let me jump in. Can you give me the short version?",
  "Hang on. What's the one thing you need from me?",
] as const;

/** How many of the counterpart's turns so far were cut-ins. */
export function countCutIns(session: Session): number {
  const lines: readonly string[] = CUT_IN_LINES;
  return session.turns.filter((t) => t.speaker === "counterpart" && lines.includes(t.text)).length;
}

/** The counterpart interrupts: a different line each time, impatient, give unchanged. */
export function cutInReply(session: Session): CounterpartReply {
  const line = CUT_IN_LINES[countCutIns(session) % CUT_IN_LINES.length] as string;
  return { reply: line, mood: "impatient", give: currentGive(session) };
}
