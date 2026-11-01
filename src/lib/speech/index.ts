export { detectSpeechSupport } from "./support";
export { createSpeechOutput } from "./output";
export { createWebSpeechInput } from "./webSpeechInput";
export { createTypedTextInput } from "./typedInput";
export { createSpeech } from "./createSpeech";
export { linkBargeIn } from "./bargeIn";
export { createSpeechQueue } from "./speechQueue";
export type { SpeechQueue } from "./speechQueue";

export type {
  CreateSpeech,
  CreateSpeechOutput,
  CreateTypedTextInput,
  DetectSpeechSupport,
  LinkBargeIn,
} from "@/contracts/modules";
export type {
  ListeningEndReason,
  SpeakResult,
  SpeechBundle,
  SpeechError,
  SpeechErrorKind,
  SpeechGlobalScope,
  SpeechInput,
  SpeechInputKind,
  SpeechInputOptions,
  SpeechMode,
  SpeechOutput,
  SpeechResult,
  SpeechSupport,
  TypedTextInput,
  Unsubscribe,
  Utterance,
} from "@/contracts/speech";
