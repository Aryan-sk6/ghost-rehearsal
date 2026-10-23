import { IllegalTransitionError, LlmError } from "@/contracts/errors";
import type { RequestCounterpartReply } from "@/contracts/modules";
import type { LlmRequest } from "@/contracts/llm";
import { buildRetryMessage, buildSystemPrompt, buildUserMessage } from "./prompt";
import { validateReply } from "./validateReply";

export const requestCounterpartReply: RequestCounterpartReply = async (session, llm) => {
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

  const first = validateReply(await llm.complete(request(message)), session.scenario);
  if (first.ok) return first.reply;

  const second = validateReply(
    await llm.complete(request(buildRetryMessage(message, first.problem))),
    session.scenario,
  );
  if (second.ok) return second.reply;
  throw new LlmError("invalid_output", "The counterpart did not return a valid reply.");
};
