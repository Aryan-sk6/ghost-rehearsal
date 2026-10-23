import { describe, expect, it } from "vitest";
import { LLM_ERROR_KINDS, type LlmErrorKind } from "@/contracts/errors";
import { MIC_DENIED_COPY, VOICE_UNSUPPORTED_COPY, describeLlmError } from "./errorCopy";

const REJECTED = "Anthropic rejected that API key. Check it and enter it again.";
const GENERIC = "Something went wrong. Try again.";

const EXPECTED: Record<LlmErrorKind, { message: string; action: "retry" | "new-key" }> = {
  invalid_key: { message: REJECTED, action: "new-key" },
  missing_key: { message: REJECTED, action: "new-key" },
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
  bad_request: { message: GENERIC, action: "retry" },
  unknown: { message: GENERIC, action: "retry" },
};

describe("describeLlmError", () => {
  it.each(LLM_ERROR_KINDS)("maps %s", (kind) => {
    expect(describeLlmError(kind)).toEqual(EXPECTED[kind]);
  });
});

describe("speech copy", () => {
  it("has the microphone denied copy", () => {
    expect(MIC_DENIED_COPY).toBe(
      "Microphone access is blocked. Allow it in your browser's site settings, or keep going by typing.",
    );
  });

  it("has the voice unsupported copy", () => {
    expect(VOICE_UNSUPPORTED_COPY).toBe(
      "Voice input isn't supported in this browser. Type your replies instead. Chrome or Edge on desktop support voice.",
    );
  });
});
