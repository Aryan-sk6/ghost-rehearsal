import type { CreateSpeechOutput } from "@/contracts/modules";
import type { SpeakResult, SpeechOutput } from "@/contracts/speech";
import { detectSpeechSupport } from "./support";

interface VoiceLike {
  lang: string;
}

interface UtteranceLike {
  lang: string;
  voice: unknown;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

interface SynthesisLike {
  speak(utterance: unknown): void;
  cancel(): void;
  getVoices(): VoiceLike[];
  addEventListener?(type: string, cb: () => void): void;
}

type UtteranceCtor = new (text: string) => UtteranceLike;

interface Pending {
  resolve: (result: SpeakResult) => void;
  startedAtMs: number;
}

export const createSpeechOutput: CreateSpeechOutput = (scope = globalThis) => {
  const support = detectSpeechSupport(scope);
  if (!support.synthesis) {
    return {
      available: false,
      speak: () => {
        const now = Date.now();
        return Promise.resolve({ startedAtMs: now, endedAtMs: now, cancelled: false });
      },
      cancel: () => {},
      isSpeaking: () => false,
    } satisfies SpeechOutput;
  }

  const synthesis = scope.speechSynthesis as SynthesisLike;
  const Utterance = scope.SpeechSynthesisUtterance as UtteranceCtor;
  let voicesReady = false;
  let pending: Pending | null = null;

  synthesis.addEventListener?.("voiceschanged", () => {
    voicesReady = true;
  });

  const pickVoice = (): VoiceLike | undefined => {
    const voices = synthesis.getVoices();
    if (voices.length > 0) voicesReady = true;
    if (!voicesReady) return undefined;
    return voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  };

  const settle = (cancelled: boolean): void => {
    const current = pending;
    if (!current) return;
    pending = null;
    current.resolve({ startedAtMs: current.startedAtMs, endedAtMs: Date.now(), cancelled });
  };

  return {
    available: true,
    isSpeaking: () => pending !== null,
    cancel: () => {
      synthesis.cancel();
      settle(true);
    },
    speak: (text) => {
      if (pending) {
        synthesis.cancel();
        settle(true);
      }
      return new Promise<SpeakResult>((resolve) => {
        const entry: Pending = { resolve, startedAtMs: Date.now() };
        pending = entry;
        const utterance = new Utterance(text);
        utterance.lang = "en-US";
        const voice = pickVoice();
        if (voice) utterance.voice = voice;
        // Events from a superseded utterance must not settle the new one.
        const finish = (): void => {
          if (pending === entry) settle(false);
        };
        utterance.onstart = () => {
          if (pending === entry) entry.startedAtMs = Date.now();
        };
        utterance.onend = finish;
        utterance.onerror = finish;
        synthesis.speak(utterance);
      });
    },
  };
};
