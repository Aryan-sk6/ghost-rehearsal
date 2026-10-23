import type { CreateSpeech } from "@/contracts/modules";
import { createSpeechOutput } from "./output";
import { detectSpeechSupport } from "./support";
import { createTypedTextInput } from "./typedInput";
import { createWebSpeechInput } from "./webSpeechInput";

export const createSpeech: CreateSpeech = (opts, scope = globalThis) => {
  const support = detectSpeechSupport(scope);
  const input = support.recognition ? createWebSpeechInput(opts, scope) : createTypedTextInput();
  return { input, output: createSpeechOutput(scope), support };
};
