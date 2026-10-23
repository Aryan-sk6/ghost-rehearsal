import { describe, expect, it } from "vitest";
import { detectSpeechSupport } from "./support";

class Ctor {}

describe("detectSpeechSupport", () => {
  it("reports nothing for an empty scope", () => {
    expect(detectSpeechSupport({})).toEqual({ recognition: false, synthesis: false });
  });

  it("detects unprefixed recognition", () => {
    expect(detectSpeechSupport({ SpeechRecognition: Ctor }).recognition).toBe(true);
  });

  it("detects webkit-prefixed recognition", () => {
    expect(detectSpeechSupport({ webkitSpeechRecognition: Ctor }).recognition).toBe(true);
  });

  it("ignores non-function recognition values", () => {
    expect(detectSpeechSupport({ SpeechRecognition: {} }).recognition).toBe(false);
  });

  it("needs both speechSynthesis and SpeechSynthesisUtterance", () => {
    expect(detectSpeechSupport({ speechSynthesis: {} }).synthesis).toBe(false);
    expect(detectSpeechSupport({ SpeechSynthesisUtterance: Ctor }).synthesis).toBe(false);
    expect(
      detectSpeechSupport({ speechSynthesis: {}, SpeechSynthesisUtterance: Ctor }).synthesis,
    ).toBe(true);
  });

  it("reports both together", () => {
    expect(
      detectSpeechSupport({
        webkitSpeechRecognition: Ctor,
        speechSynthesis: {},
        SpeechSynthesisUtterance: Ctor,
      }),
    ).toEqual({ recognition: true, synthesis: true });
  });

  it("does not throw with the default scope in jsdom", () => {
    expect(() => detectSpeechSupport()).not.toThrow();
  });
});
