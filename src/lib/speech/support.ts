import type { DetectSpeechSupport } from "@/contracts/modules";
import type { SpeechGlobalScope } from "@/contracts/speech";

/** The recognition constructor in `scope` (prefixed or not), or undefined. */
export function resolveRecognitionCtor(scope: SpeechGlobalScope): (new () => unknown) | undefined {
  if (typeof scope.SpeechRecognition === "function") return scope.SpeechRecognition as new () => unknown;
  if (typeof scope.webkitSpeechRecognition === "function") {
    return scope.webkitSpeechRecognition as new () => unknown;
  }
  return undefined;
}

export const detectSpeechSupport: DetectSpeechSupport = (scope = globalThis as SpeechGlobalScope) => {
  const s: SpeechGlobalScope = scope ?? {};
  return {
    recognition: resolveRecognitionCtor(s) !== undefined,
    synthesis: Boolean(s.speechSynthesis) && Boolean(s.SpeechSynthesisUtterance),
  };
};
