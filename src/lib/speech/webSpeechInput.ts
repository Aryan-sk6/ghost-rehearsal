import { NO_SPEECH_TIMEOUT_MS, SILENCE_TIMEOUT_MS } from "@/contracts/constants";
import type {
  ListeningEndReason,
  SpeechError,
  SpeechErrorKind,
  SpeechGlobalScope,
  SpeechInput,
  SpeechInputOptions,
  SpeechResult,
  Unsubscribe,
  Utterance,
} from "@/contracts/speech";
import { resolveRecognitionCtor } from "./support";

interface AlternativeLike {
  transcript: string;
}

interface ResultLike {
  isFinal: boolean;
  0?: AlternativeLike;
}

interface ResultEventLike {
  results: ArrayLike<ResultLike>;
}

interface ErrorEventLike {
  error?: string;
}

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: ResultEventLike) => void) | null;
  onerror: ((event: ErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort?(): void;
}

type RecognitionCtor = new () => RecognitionLike;

/**
 * After stop(), Chrome usually sends the final result for the last phrase
 * and then ends. Wait this long for that end before emitting what we have.
 */
export const STOP_FLUSH_TIMEOUT_MS = 1000;

function createEmitter<T>() {
  const listeners = new Set<(value: T) => void>();
  return {
    on(cb: (value: T) => void): Unsubscribe {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    emit(value: T): void {
      for (const listener of [...listeners]) listener(value);
    },
  };
}

function mapErrorKind(code: string | undefined): SpeechErrorKind {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "not-allowed";
    case "audio-capture":
    case "network":
    case "aborted":
    case "no-speech":
      return code;
    default:
      return "unknown";
  }
}

const ERROR_MESSAGES: Record<SpeechErrorKind, string> = {
  "not-allowed": "Microphone access was denied.",
  "audio-capture": "No microphone could be used.",
  network: "Speech recognition lost its network connection.",
  "no-speech": "No speech was heard.",
  unsupported: "Speech recognition is not supported in this browser.",
  aborted: "Speech recognition was interrupted.",
  unknown: "Speech recognition failed.",
};

export function createWebSpeechInput(
  opts: SpeechInputOptions,
  scope: SpeechGlobalScope = globalThis,
): SpeechInput {
  const mode = opts.mode;
  const lang = opts.lang ?? "en-US";
  const silenceTimeoutMs = opts.silenceTimeoutMs ?? SILENCE_TIMEOUT_MS;
  const noSpeechTimeoutMs = opts.noSpeechTimeoutMs ?? NO_SPEECH_TIMEOUT_MS;

  const results = createEmitter<SpeechResult>();
  const utterances = createEmitter<Utterance>();
  const speechStarts = createEmitter<void>();
  const errors = createEmitter<SpeechError>();
  const ends = createEmitter<ListeningEndReason>();

  let listening = false;
  /** The live recognition; events from any other instance are stale and ignored. */
  let current: RecognitionLike | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let noSpeechTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set between stop() and Chrome's final end, while late results still count. */
  let draining = false;
  let drainTimer: ReturnType<typeof setTimeout> | null = null;
  let stoppedAtMs = 0;

  // Utterance state. `carried` holds text from instances that Chrome ended
  // before the utterance was emitted; `consumed` is how many results of the
  // current instance already belong to an emitted utterance.
  let carried = "";
  let instanceText = "";
  let resultCount = 0;
  let consumed = 0;
  let utteranceStarted = false;
  let utteranceStartMs = 0;

  const clearTimers = (): void => {
    if (silenceTimer !== null) clearTimeout(silenceTimer);
    if (noSpeechTimer !== null) clearTimeout(noSpeechTimer);
    silenceTimer = null;
    noSpeechTimer = null;
  };

  const fullText = (): string => [carried, instanceText].filter((p) => p !== "").join(" ").trim();

  const resetUtterance = (): void => {
    carried = "";
    instanceText = "";
    consumed = resultCount;
    utteranceStarted = false;
  };

  const flushUtterance = (endedAtMs: number = Date.now()): void => {
    const text = fullText();
    const startedAtMs = utteranceStartMs;
    resetUtterance();
    if (text !== "") utterances.emit({ text, startedAtMs, endedAtMs });
  };

  const detach = (): void => {
    const rec = current;
    current = null;
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    rec.onspeechstart = null;
  };

  const halt = (): void => {
    const rec = current;
    detach();
    listening = false;
    clearTimers();
    try {
      rec?.stop();
    } catch {
      // Already stopped; nothing to do.
    }
  };

  /** Ends a stop() that was waiting for Chrome's last results. */
  const finishDrain = (): void => {
    if (!draining) return;
    draining = false;
    if (drainTimer !== null) clearTimeout(drainTimer);
    drainTimer = null;
    detach();
    flushUtterance(stoppedAtMs);
    ends.emit("stopped");
  };

  const markSpeech = (): void => {
    if (noSpeechTimer !== null) clearTimeout(noSpeechTimer);
    noSpeechTimer = null;
    if (utteranceStarted) return;
    utteranceStarted = true;
    utteranceStartMs = Date.now();
    speechStarts.emit();
  };

  const fail = (kind: SpeechErrorKind): void => {
    halt();
    errors.emit({ kind, message: ERROR_MESSAGES[kind] });
    ends.emit("error");
  };

  const open = (): boolean => {
    const Ctor = resolveRecognitionCtor(scope) as RecognitionCtor | undefined;
    if (!Ctor) {
      fail("unsupported");
      return false;
    }
    let rec: RecognitionLike;
    try {
      rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = lang;
      resultCount = 0;
      consumed = 0;
      instanceText = "";
      current = rec;

      rec.onspeechstart = () => {
        if (current === rec) markSpeech();
      };
      rec.onresult = (event) => {
        if (current !== rec) return;
        const list = event.results;
        resultCount = list.length;
        const parts: string[] = [];
        let allFinal = true;
        for (let i = consumed; i < list.length; i += 1) {
          const item = list[i];
          if (!item) continue;
          parts.push((item[0]?.transcript ?? "").trim());
          if (!item.isFinal) allFinal = false;
        }
        instanceText = parts.filter((p) => p !== "").join(" ");
        const text = fullText();
        if (text === "") return;
        if (draining) {
          // Late words after release: keep them, but don't signal new speech.
          if (!utteranceStarted) {
            utteranceStarted = true;
            utteranceStartMs = stoppedAtMs;
          }
        } else {
          markSpeech();
        }
        results.emit({ text, isFinal: allFinal, atMs: Date.now() });
        if (mode === "continuous" && !draining) {
          if (silenceTimer !== null) clearTimeout(silenceTimer);
          silenceTimer = setTimeout(() => {
            silenceTimer = null;
            if (current === rec) flushUtterance();
          }, silenceTimeoutMs);
        }
      };
      rec.onerror = (event) => {
        if (current !== rec) return;
        if (draining) {
          finishDrain();
          return;
        }
        const kind = mapErrorKind(event.error);
        if (kind === "no-speech") {
          // Chrome follows this with onend; we restart and our own timeout decides.
          if (mode !== "continuous") {
            errors.emit({ kind, message: ERROR_MESSAGES[kind] });
          }
          return;
        }
        fail(kind);
      };
      rec.onend = () => {
        if (current !== rec) return;
        if (draining) {
          finishDrain();
          return;
        }
        if (!listening) return;
        // Chrome ended recognition on its own; keep the text and listen again.
        carried = fullText();
        detach();
        open();
      };
      rec.start();
      return true;
    } catch {
      fail("unknown");
      return false;
    }
  };

  return {
    kind: "web-speech",
    mode,
    isListening: () => listening,
    start() {
      if (listening) return;
      finishDrain();
      listening = true;
      carried = "";
      utteranceStarted = false;
      clearTimers();
      if (!open()) return;
      noSpeechTimer = setTimeout(() => {
        noSpeechTimer = null;
        halt();
        ends.emit("no-speech-timeout");
      }, noSpeechTimeoutMs);
    },
    stop() {
      if (!listening) return;
      const rec = current;
      listening = false;
      clearTimers();
      stoppedAtMs = Date.now();
      if (!rec) {
        flushUtterance(stoppedAtMs);
        ends.emit("stopped");
        return;
      }
      // Keep the handlers attached so the final result for the last phrase,
      // which Chrome sends after stop(), still reaches the utterance.
      draining = true;
      rec.onspeechstart = null;
      drainTimer = setTimeout(finishDrain, STOP_FLUSH_TIMEOUT_MS);
      try {
        rec.stop();
      } catch {
        finishDrain();
      }
    },
    onResult: (cb) => results.on(cb),
    onUtterance: (cb) => utterances.on(cb),
    onSpeechStart: (cb) => speechStarts.on(cb),
    onError: (cb) => errors.on(cb),
    onEnd: (cb) => ends.on(cb),
  };
}
