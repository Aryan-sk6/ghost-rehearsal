import type { LlmClient } from "./llm";
import type {
  SpeechBundle,
  SpeechGlobalScope,
  SpeechInput,
  SpeechInputOptions,
  SpeechOutput,
  SpeechSupport,
  TypedTextInput,
  Unsubscribe,
} from "./speech";
import type { CounterpartReply, Scenario, Session, SessionAnalysis, SessionMetrics } from "./types";

export interface TurnTiming {
  startedAtMs: number;
  endedAtMs: number;
}

// ---- src/lib/conversation/index.ts (engine) ----
export type CreateSession = (scenario: Scenario, opts: { id: string; nowMs: number }) => Session;
export type AddOpeningTurn = (session: Session, timing: TurnTiming) => Session;
export type AddUserTurn = (session: Session, text: string, timing: TurnTiming) => Session;
export interface CounterpartReplyOptions {
  /**
   * Called with each piece of the reply as soon as it is safe to say aloud,
   * before the whole reply has arrived. Pieces come in order and never repeat.
   */
  onSpeakable?: (text: string) => void;
}
export type RequestCounterpartReply = (
  session: Session,
  llm: LlmClient,
  opts?: CounterpartReplyOptions,
) => Promise<CounterpartReply>;
export type AddCounterpartTurn = (session: Session, reply: CounterpartReply, timing: TurnTiming) => Session;
export type EndSession = (session: Session, nowMs: number) => Session;
export type CurrentGive = (session: Session) => number;
export type CountUserTurns = (session: Session) => number;

// ---- src/lib/llm/index.ts (engine) ----
export type CreateHttpLlmClient = (opts: {
  apiKey: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}) => LlmClient;

// ---- src/lib/analysis/index.ts (analysis) ----
export type ComputeMetrics = (session: Session) => SessionMetrics;
export type RequestAnalysis = (
  session: Session,
  metrics: SessionMetrics,
  llm: LlmClient,
) => Promise<SessionAnalysis>;
export type ReplayFrom = (session: Session, turnIndex: number) => Session;

// ---- src/lib/speech/index.ts (speech) ----
export type DetectSpeechSupport = (scope?: SpeechGlobalScope) => SpeechSupport;
export type CreateSpeechOutput = (scope?: SpeechGlobalScope) => SpeechOutput;
export type CreateTypedTextInput = () => TypedTextInput;
export type CreateSpeech = (opts: SpeechInputOptions, scope?: SpeechGlobalScope) => SpeechBundle;
export type LinkBargeIn = (input: SpeechInput, output: SpeechOutput) => Unsubscribe;
