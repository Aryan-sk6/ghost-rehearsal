import { IllegalTransitionError, LlmError } from "@/contracts/errors";
import { extractJsonObject } from "@/contracts/json";
import type { LlmRequest } from "@/contracts/llm";
import type { RequestCounterpartReply } from "@/contracts/modules";
import { MoodSchema, type CounterpartReply, type Session } from "@/contracts/types";
import { currentGive } from "./machine";
import { buildRetryMessage, buildSystemPrompt, buildUserMessage } from "./prompt";
import { SentenceGate } from "./replyStream";
import { validateReply } from "./validateReply";

/**
 * Part of the reply was already said aloud but the full output was invalid.
 * Asking again would cost a call and contradict what was said, so keep what
 * was said and take mood and give from the output where they're usable.
 */
function salvage(raw: string, spoken: readonly string[], session: Session): CounterpartReply {
  const json = extractJsonObject(raw);
  const fields = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  const mood = MoodSchema.safeParse(fields.mood);
  const give = typeof fields.give === "number" && Number.isFinite(fields.give) ? fields.give : currentGive(session);
  return {
    reply: spoken.join(" "),
    mood: mood.success ? mood.data : (session.moodHistory[session.moodHistory.length - 1] ?? "neutral"),
    give,
  };
}

export const requestCounterpartReply: RequestCounterpartReply = async (session, llm, opts = {}) => {
  if (session.status !== "awaiting_counterpart") {
    throw new IllegalTransitionError(session.status, "requestCounterpartReply");
  }
  const system = buildSystemPrompt(session);
  const message = buildUserMessage(session);
  const request = (content: string): LlmRequest => ({
    purpose: "counterpart",
    system,
    messages: [{ role: "user", content }],
    maxTokens: 400,
    temperature: 0.7,
  });
  const { onSpeakable } = opts;

  const attempt = async (content: string) => {
    const gate = new SentenceGate(session.scenario.hiddenBottomLine, (text) => onSpeakable?.(text));
    let raw: string;
    try {
      raw =
        onSpeakable !== undefined && llm.stream !== undefined
          ? await llm.stream(request(content), (piece) => gate.feed(piece))
          : await llm.complete(request(content));
    } catch (error) {
      // Cut off after some of it was said aloud: keep what was said.
      if (gate.spoken.length > 0) {
        return { raw: gate.received, gate, result: { ok: false as const, problem: "cut off" } };
      }
      throw error;
    }
    return { raw, gate, result: validateReply(raw, session.scenario) };
  };

  const first = await attempt(message);
  if (first.result.ok) {
    first.gate.finish(first.result.reply.reply);
    return first.result.reply;
  }
  if (first.gate.spoken.length > 0) return salvage(first.raw, first.gate.spoken, session);

  const second = await attempt(buildRetryMessage(message, first.result.problem));
  if (second.result.ok) {
    second.gate.finish(second.result.reply.reply);
    return second.result.reply;
  }
  if (second.gate.spoken.length > 0) return salvage(second.raw, second.gate.spoken, session);
  throw new LlmError("invalid_output", "The counterpart did not return a valid reply.");
};
