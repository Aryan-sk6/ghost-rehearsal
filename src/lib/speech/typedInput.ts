import type { CreateTypedTextInput } from "@/contracts/modules";
import type {
  ListeningEndReason,
  SpeechError,
  SpeechResult,
  TypedTextInput,
  Unsubscribe,
  Utterance,
} from "@/contracts/speech";

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

export const createTypedTextInput: CreateTypedTextInput = (): TypedTextInput => {
  const results = createEmitter<SpeechResult>();
  const utterances = createEmitter<Utterance>();
  const speechStarts = createEmitter<void>();
  const errors = createEmitter<SpeechError>();
  const ends = createEmitter<ListeningEndReason>();

  let listening = false;
  let startedAtMs: number | null = null;

  return {
    kind: "typed",
    mode: "push-to-talk",
    isListening: () => listening,
    start() {
      listening = true;
      startedAtMs = Date.now();
    },
    stop() {
      if (!listening) return;
      listening = false;
      startedAtMs = null;
      ends.emit("stopped");
    },
    submit(text) {
      const trimmed = text.trim();
      if (trimmed === "") return;
      const endedAtMs = Date.now();
      const began = startedAtMs ?? endedAtMs;
      startedAtMs = null;
      speechStarts.emit();
      utterances.emit({ text: trimmed, startedAtMs: began, endedAtMs });
    },
    onResult: (cb) => results.on(cb),
    onUtterance: (cb) => utterances.on(cb),
    onSpeechStart: (cb) => speechStarts.on(cb),
    onError: (cb) => errors.on(cb),
    onEnd: (cb) => ends.on(cb),
  };
};
