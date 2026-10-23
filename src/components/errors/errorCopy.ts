import type { LlmErrorKind } from "@/contracts/errors";

export type LlmErrorAction = "retry" | "new-key";

export interface LlmErrorCopy {
  message: string;
  action: LlmErrorAction;
}

export const KEY_REJECTED_COPY = "Anthropic rejected that API key. Check it and enter it again.";

export const MIC_DENIED_COPY =
  "Microphone access is blocked. Allow it in your browser's site settings, or keep going by typing.";

export const VOICE_UNSUPPORTED_COPY =
  "Voice input isn't supported in this browser. Type your replies instead. Chrome or Edge on desktop support voice.";

const GENERIC_COPY = "Something went wrong. Try again.";

const COPY: Record<LlmErrorKind, LlmErrorCopy> = {
  invalid_key: { message: KEY_REJECTED_COPY, action: "new-key" },
  missing_key: { message: KEY_REJECTED_COPY, action: "new-key" },
  rate_limited: {
    message: "Anthropic is rate-limiting this key. Wait a minute, then try again.",
    action: "retry",
  },
  overloaded: { message: "Anthropic is busy right now. Try again in a moment.", action: "retry" },
  network: {
    message: "Couldn't reach the server. Check your connection and try again.",
    action: "retry",
  },
  invalid_output: {
    message: "The other person lost their train of thought. Try again.",
    action: "retry",
  },
  bad_request: { message: GENERIC_COPY, action: "retry" },
  unknown: { message: GENERIC_COPY, action: "retry" },
};

export function describeLlmError(kind: LlmErrorKind): LlmErrorCopy {
  return COPY[kind];
}
