import { describe, expect, it } from "vitest";
import { createSpeech } from "./createSpeech";

class FakeRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  onresult = null;
  onerror = null;
  onend = null;
  onspeechstart = null;
  start() {}
  stop() {}
}

class FakeUtterance {}

const synthesis = { speak() {}, cancel() {}, getVoices: () => [] };

describe("createSpeech", () => {
  it("falls back to typed input when the scope has no recognition", () => {
    const bundle = createSpeech(
      { mode: "push-to-talk" },
      { speechSynthesis: synthesis, SpeechSynthesisUtterance: FakeUtterance },
    );
    expect(bundle.input.kind).toBe("typed");
    expect(bundle.support).toEqual({ recognition: false, synthesis: true });
    expect(bundle.output.available).toBe(true);
  });

  it("returns an unavailable output alongside typed input in an empty scope", () => {
    const bundle = createSpeech({ mode: "continuous" }, {});
    expect(bundle.input.kind).toBe("typed");
    expect(bundle.output.available).toBe(false);
    expect(bundle.support).toEqual({ recognition: false, synthesis: false });
  });

  it("uses web speech input when recognition is supported", () => {
    const bundle = createSpeech(
      { mode: "continuous" },
      { webkitSpeechRecognition: FakeRecognition },
    );
    expect(bundle.input.kind).toBe("web-speech");
    expect(bundle.input.mode).toBe("continuous");
    expect(bundle.support.recognition).toBe(true);
    expect(bundle.output.available).toBe(false);
  });
});
