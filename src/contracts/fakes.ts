import { LlmError } from "./errors";
import type { LlmClient, LlmRequest } from "./llm";
import type {
  ListeningEndReason,
  SpeakResult,
  SpeechError,
  SpeechInput,
  SpeechMode,
  SpeechOutput,
  SpeechResult,
  Unsubscribe,
  Utterance,
} from "./speech";

class Emitter<T> {
  private readonly listeners = new Set<(value: T) => void>();

  on(cb: (value: T) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  emit(value: T): void {
    for (const listener of [...this.listeners]) listener(value);
  }
}

export type FakeLlmStep = string | LlmError;

/** Scripted LLM: each complete() call consumes the next step. */
export class FakeLlmClient implements LlmClient {
  readonly calls: LlmRequest[] = [];
  private readonly steps: FakeLlmStep[];

  constructor(steps: readonly FakeLlmStep[]) {
    this.steps = [...steps];
  }

  get remaining(): number {
    return this.steps.length;
  }

  async complete(req: LlmRequest): Promise<string> {
    this.calls.push(req);
    const next = this.steps.shift();
    if (next === undefined) throw new LlmError("unknown", "FakeLlmClient: script exhausted");
    if (next instanceof LlmError) throw next;
    return next;
  }
}

/** Test double for SpeechInput; drive it with the emit* methods. */
export class FakeSpeechInput implements SpeechInput {
  readonly kind = "fake" as const;
  readonly mode: SpeechMode;
  startCalls = 0;
  stopCalls = 0;
  private listening = false;
  private readonly results = new Emitter<SpeechResult>();
  private readonly utterances = new Emitter<Utterance>();
  private readonly speechStarts = new Emitter<void>();
  private readonly errors = new Emitter<SpeechError>();
  private readonly ends = new Emitter<ListeningEndReason>();

  constructor(mode: SpeechMode = "push-to-talk") {
    this.mode = mode;
  }

  isListening(): boolean {
    return this.listening;
  }

  start(): void {
    this.startCalls += 1;
    this.listening = true;
  }

  stop(): void {
    this.stopCalls += 1;
    if (!this.listening) return;
    this.listening = false;
    this.ends.emit("stopped");
  }

  onResult(cb: (result: SpeechResult) => void): Unsubscribe {
    return this.results.on(cb);
  }

  onUtterance(cb: (utterance: Utterance) => void): Unsubscribe {
    return this.utterances.on(cb);
  }

  onSpeechStart(cb: () => void): Unsubscribe {
    return this.speechStarts.on(cb);
  }

  onError(cb: (error: SpeechError) => void): Unsubscribe {
    return this.errors.on(cb);
  }

  onEnd(cb: (reason: ListeningEndReason) => void): Unsubscribe {
    return this.ends.on(cb);
  }

  emitResult(result: SpeechResult): void {
    this.results.emit(result);
  }

  emitUtterance(utterance: Utterance): void {
    this.utterances.emit(utterance);
  }

  emitSpeechStart(): void {
    this.speechStarts.emit();
  }

  emitError(error: SpeechError): void {
    this.errors.emit(error);
  }

  emitEnd(reason: ListeningEndReason): void {
    this.listening = false;
    this.ends.emit(reason);
  }
}

export interface FakeSpeechOutputOptions {
  /** Default true: speak() resolves immediately. False: call finish(). */
  autoFinish?: boolean;
  available?: boolean;
  now?: () => number;
}

/** Test double for SpeechOutput; records everything spoken. */
export class FakeSpeechOutput implements SpeechOutput {
  readonly available: boolean;
  readonly spoken: string[] = [];
  cancelCalls = 0;
  private readonly autoFinish: boolean;
  private readonly now: () => number;
  private pending: { resolve: (result: SpeakResult) => void; startedAtMs: number } | null = null;

  constructor(opts: FakeSpeechOutputOptions = {}) {
    this.autoFinish = opts.autoFinish ?? true;
    this.available = opts.available ?? true;
    this.now = opts.now ?? (() => 0);
  }

  isSpeaking(): boolean {
    return this.pending !== null;
  }

  speak(text: string): Promise<SpeakResult> {
    this.spoken.push(text);
    const startedAtMs = this.now();
    if (this.autoFinish) {
      return Promise.resolve({ startedAtMs, endedAtMs: this.now(), cancelled: false });
    }
    this.settle(true);
    return new Promise<SpeakResult>((resolve) => {
      this.pending = { resolve, startedAtMs };
    });
  }

  finish(): void {
    this.settle(false);
  }

  cancel(): void {
    this.cancelCalls += 1;
    this.settle(true);
  }

  private settle(cancelled: boolean): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    pending.resolve({ startedAtMs: pending.startedAtMs, endedAtMs: this.now(), cancelled });
  }
}
