import type { DetectSpeechSupport } from "@/contracts/modules";
import type { SpeechGlobalScope } from "@/contracts/speech";

export const detectSpeechSupport: DetectSpeechSupport = (scope = globalThis as SpeechGlobalScope) => {
  const s: SpeechGlobalScope = scope ?? {};
  return {
    recognition:
      typeof s.SpeechRecognition === "function" || typeof s.webkitSpeechRecognition === "function",
    synthesis: Boolean(s.speechSynthesis) && Boolean(s.SpeechSynthesisUtterance),
  };
};
