import { describe, expect, it, vi } from "vitest";
import { createSpeechOutput } from "./output";

class FakeUtterance {
  lang = "";
  voice: unknown = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly text: string) {}
}

class FakeSynthesis {
  voices: { lang: string; name: string }[] = [];
  spoken: FakeUtterance[] = [];
  cancelCalls = 0;
  private listeners: (() => void)[] = [];
  getVoices() {
    return this.voices;
  }
  addEventListener(_type: string, cb: () => void) {
    this.listeners.push(cb);
  }
  fireVoicesChanged() {
    this.listeners.forEach((l) => l());
  }
  speak(u: FakeUtterance) {
    this.spoken.push(u);
  }
  cancel() {
    this.cancelCalls += 1;
  }
}

function setup() {
  const synth = new FakeSynthesis();
  const out = createSpeechOutput({ speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance });
  return { synth, out };
}

describe("createSpeechOutput", () => {
  it("is unavailable and resolves at once without synthesis", async () => {
    const out = createSpeechOutput({});
    expect(out.available).toBe(false);
    const result = await out.speak("hi");
    expect(result.cancelled).toBe(false);
    expect(out.isSpeaking()).toBe(false);
    expect(() => out.cancel()).not.toThrow();
  });

  it("resolves on end with en-US and the first English voice", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const { synth, out } = setup();
    synth.voices = [
      { lang: "fr-FR", name: "fr" },
      { lang: "en-GB", name: "gb" },
      { lang: "en-US", name: "us" },
    ];
    synth.fireVoicesChanged();
    const p = out.speak("hello");
    expect(out.isSpeaking()).toBe(true);
    const u = synth.spoken[0]!;
    expect(u.lang).toBe("en-US");
    expect(u.voice).toEqual({ lang: "en-GB", name: "gb" });
    vi.setSystemTime(2500);
    u.onend?.();
    expect(await p).toEqual({ startedAtMs: 1000, endedAtMs: 2500, cancelled: false });
    expect(out.isSpeaking()).toBe(false);
    vi.useRealTimers();
  });

  it("leaves the voice unset when no voices are loaded", () => {
    const { synth, out } = setup();
    void out.speak("hello");
    expect(synth.spoken[0]!.voice).toBeNull();
  });

  it("resolves on error", async () => {
    const { synth, out } = setup();
    const p = out.speak("hello");
    synth.spoken[0]!.onerror?.();
    expect((await p).cancelled).toBe(false);
    expect(out.isSpeaking()).toBe(false);
  });

  it("cancel resolves cancelled and stops speaking", async () => {
    const { synth, out } = setup();
    const p = out.speak("hello");
    out.cancel();
    expect(synth.cancelCalls).toBe(1);
    expect(out.isSpeaking()).toBe(false);
    expect((await p).cancelled).toBe(true);
  });

  it("a new speak cancels the previous one", async () => {
    const { synth, out } = setup();
    const first = out.speak("one");
    const second = out.speak("two");
    expect((await first).cancelled).toBe(true);
    expect(out.isSpeaking()).toBe(true);
    // a late event from the cancelled utterance must not settle the new one
    synth.spoken[0]!.onerror?.();
    expect(out.isSpeaking()).toBe(true);
    synth.spoken[1]!.onend?.();
    expect((await second).cancelled).toBe(false);
  });
});
