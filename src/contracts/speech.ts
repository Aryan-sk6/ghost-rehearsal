export type Unsubscribe = () => void;

export type SpeechMode = "push-to-talk" | "continuous";
export type SpeechInputKind = "web-speech" | "typed" | "fake";

/** Interim or final partial recognition, for the live transcript. */
export interface SpeechResult {
  text: string;
  isFinal: boolean;
  atMs: number;
}

/** One complete user turn. */
export interface Utterance {
  text: string;
  startedAtMs: number;
  endedAtMs: number;
}

export type SpeechErrorKind =
  | "not-allowed"
  | "audio-capture"
  | "network"
  | "no-speech"
  | "unsupported"
  | "aborted"
  | "unknown";

export interface SpeechError {
  kind: SpeechErrorKind;
  message: string;
}

export type ListeningEndReason = "stopped" | "no-speech-timeout" | "error";

export interface SpeechInput {
  readonly kind: SpeechInputKind;
  readonly mode: SpeechMode;
  isListening(): boolean;
  start(): void;
  /** Push-to-talk: ends the utterance and emits it (if non-empty), then onEnd("stopped"). */
  stop(): void;
  onResult(cb: (result: SpeechResult) => void): Unsubscribe;
  onUtterance(cb: (utterance: Utterance) => void): Unsubscribe;
  /** Fires once at the start of each utterance; used for barge-in. */
  onSpeechStart(cb: () => void): Unsubscribe;
  onError(cb: (error: SpeechError) => void): Unsubscribe;
  onEnd(cb: (reason: ListeningEndReason) => void): Unsubscribe;
}

/** Typed-text fallback: submit() emits one utterance. */
export interface TypedTextInput extends SpeechInput {
  readonly kind: "typed";
  submit(text: string): void;
}

export interface SpeakResult {
  startedAtMs: number;
  endedAtMs: number;
  cancelled: boolean;
}

export interface SpeechOutput {
  /** False when speechSynthesis is missing; speak() then resolves at once. */
  readonly available: boolean;
  speak(text: string): Promise<SpeakResult>;
  cancel(): void;
  isSpeaking(): boolean;
}

export interface SpeechSupport {
  recognition: boolean;
  synthesis: boolean;
}

export interface SpeechInputOptions {
  mode: SpeechMode;
  /** Default "en-US". */
  lang?: string;
  /** Continuous mode only. Default SILENCE_TIMEOUT_MS. */
  silenceTimeoutMs?: number;
  /** Default NO_SPEECH_TIMEOUT_MS. */
  noSpeechTimeoutMs?: number;
}

export interface SpeechBundle {
  input: SpeechInput;
  output: SpeechOutput;
  support: SpeechSupport;
}

/** Injectable stand-in for window; defaults to globalThis. */
export interface SpeechGlobalScope {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
  speechSynthesis?: unknown;
  SpeechSynthesisUtterance?: unknown;
}
