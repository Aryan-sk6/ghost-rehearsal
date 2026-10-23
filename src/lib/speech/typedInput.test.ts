import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListeningEndReason, Utterance } from "@/contracts/speech";
import { createTypedTextInput } from "./typedInput";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
});

afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  const input = createTypedTextInput();
  const events: string[] = [];
  const utterances: Utterance[] = [];
  const ends: ListeningEndReason[] = [];
  input.onSpeechStart(() => events.push("start"));
  input.onUtterance((u) => {
    events.push("utterance");
    utterances.push(u);
  });
  input.onEnd((e) => ends.push(e));
  return { input, events, utterances, ends };
}

describe("createTypedTextInput", () => {
  it("is a typed input", () => {
    const { input } = setup();
    expect(input.kind).toBe("typed");
  });

  it("emits speech start then the trimmed utterance, timed from start()", () => {
    const { input, events, utterances } = setup();
    input.start();
    expect(input.isListening()).toBe(true);
    vi.setSystemTime(4200);
    input.submit("  I need a raise \n");
    expect(events).toEqual(["start", "utterance"]);
    expect(utterances).toEqual([{ text: "I need a raise", startedAtMs: 1000, endedAtMs: 4200 }]);
  });

  it("uses the submit time as the start when start() was not called", () => {
    const { input, utterances } = setup();
    vi.setSystemTime(2500);
    input.submit("hello");
    expect(utterances).toEqual([{ text: "hello", startedAtMs: 2500, endedAtMs: 2500 }]);
  });

  it("times a second submit from its own moment unless start() is called again", () => {
    const { input, utterances } = setup();
    input.start();
    vi.setSystemTime(2000);
    input.submit("one");
    vi.setSystemTime(3000);
    input.submit("two");
    expect(utterances.map((u) => [u.startedAtMs, u.endedAtMs])).toEqual([
      [1000, 2000],
      [3000, 3000],
    ]);
  });

  it("ignores empty and whitespace-only text", () => {
    const { input, events } = setup();
    input.start();
    input.submit("");
    input.submit("   \n\t");
    expect(events).toEqual([]);
  });

  it("stop() ends once with stopped", () => {
    const { input, ends } = setup();
    input.start();
    input.stop();
    input.stop();
    expect(ends).toEqual(["stopped"]);
    expect(input.isListening()).toBe(false);
  });
});
