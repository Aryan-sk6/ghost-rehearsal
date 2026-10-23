import type { SessionStatus } from "./types";

export const LLM_ERROR_KINDS = [
  "missing_key",
  "invalid_key",
  "rate_limited",
  "overloaded",
  "bad_request",
  "network",
  "invalid_output",
  "unknown",
] as const;
export type LlmErrorKind = (typeof LLM_ERROR_KINDS)[number];

/** Message must be user-safe and must never contain the API key. */
export class LlmError extends Error {
  readonly kind: LlmErrorKind;

  constructor(kind: LlmErrorKind, message: string) {
    super(message);
    this.name = "LlmError";
    this.kind = kind;
  }
}

export type TransitionAction =
  | "addOpeningTurn"
  | "addUserTurn"
  | "requestCounterpartReply"
  | "addCounterpartTurn"
  | "endSession";

export class IllegalTransitionError extends Error {
  readonly from: SessionStatus;
  readonly action: TransitionAction;

  constructor(from: SessionStatus, action: TransitionAction) {
    super(`Cannot ${action} while the session is ${from}`);
    this.name = "IllegalTransitionError";
    this.from = from;
    this.action = action;
  }
}

export const REHEARSAL_ERROR_CODES = [
  "empty_user_turn",
  "not_a_user_turn",
  "turn_index_out_of_range",
  "too_short_for_analysis",
] as const;
export type RehearsalErrorCode = (typeof REHEARSAL_ERROR_CODES)[number];

export class RehearsalError extends Error {
  readonly code: RehearsalErrorCode;

  constructor(code: RehearsalErrorCode, message: string) {
    super(message);
    this.name = "RehearsalError";
    this.code = code;
  }
}
