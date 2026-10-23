import type { LinkBargeIn } from "@/contracts/modules";

export const linkBargeIn: LinkBargeIn = (input, output) =>
  input.onSpeechStart(() => {
    if (output.isSpeaking()) output.cancel();
  });
