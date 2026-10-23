import { LOST_GROUND_MOMENTS, MIN_USER_TURNS_FOR_ANALYSIS } from "@/contracts/constants";
import { LlmError, RehearsalError } from "@/contracts/errors";
import { extractJsonObject } from "@/contracts/json";
import type { LlmRequest } from "@/contracts/llm";
import type { RequestAnalysis } from "@/contracts/modules";
import { SessionAnalysisSchema, type Session, type SessionAnalysis } from "@/contracts/types";
import {
  buildAnalysisRetryMessage,
  buildAnalysisSystemPrompt,
  buildAnalysisUserMessage,
} from "./prompt";

type ValidateResult = { ok: true; analysis: SessionAnalysis } | { ok: false; problem: string };

function validateAnalysis(text: string, session: Session): ValidateResult {
  const json = extractJsonObject(text);
  if (json === undefined) return { ok: false, problem: "No JSON object could be parsed." };

  const parsed = SessionAnalysisSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "";
    return { ok: false, problem: `Schema check failed${path ? ` at ${path}` : ""}: ${issue?.message ?? "invalid"}.` };
  }

  const seen = new Set<number>();
  for (const moment of parsed.data.lostGround) {
    const turn = session.turns[moment.turnIndex];
    if (turn === undefined) {
      return { ok: false, problem: `turnIndex ${moment.turnIndex} does not exist.` };
    }
    if (turn.speaker !== "user") {
      return { ok: false, problem: `turnIndex ${moment.turnIndex} is not one of your ("You") turns.` };
    }
    if (seen.has(moment.turnIndex)) {
      return { ok: false, problem: `turnIndex ${moment.turnIndex} is used more than once; use ${LOST_GROUND_MOMENTS} different turns.` };
    }
    seen.add(moment.turnIndex);
  }

  return {
    ok: true,
    analysis: {
      ...parsed.data,
      lostGround: parsed.data.lostGround.map((moment) => ({
        ...moment,
        userSaid: session.turns[moment.turnIndex]?.text ?? moment.userSaid,
      })),
    },
  };
}

export const requestAnalysis: RequestAnalysis = async (session, metrics, llm) => {
  const userTurns = session.turns.filter((turn) => turn.speaker === "user").length;
  if (userTurns < MIN_USER_TURNS_FOR_ANALYSIS) {
    throw new RehearsalError(
      "too_short_for_analysis",
      `Analysis needs at least ${MIN_USER_TURNS_FOR_ANALYSIS} user turns`,
    );
  }

  const system = buildAnalysisSystemPrompt(session, metrics);
  const message = buildAnalysisUserMessage(session);
  const request = (content: string): LlmRequest => ({
    purpose: "analysis",
    system,
    messages: [{ role: "user", content }],
    maxTokens: 1500,
    temperature: 0.3,
  });

  const first = validateAnalysis(await llm.complete(request(message)), session);
  if (first.ok) return first.analysis;

  const second = validateAnalysis(
    await llm.complete(request(buildAnalysisRetryMessage(message, first.problem))),
    session,
  );
  if (second.ok) return second.analysis;
  throw new LlmError("invalid_output", "The analysis did not return a valid result.");
};
