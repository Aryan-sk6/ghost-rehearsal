import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ListeningEndReason,
  SpeechError,
  SpeechInput,
  SpeechInputOptions,
  SpeechResult,
  Utterance,
} from "@/contracts/speech";
import { createWebSpeechInput } from "./webSpeechInput";

interface FakeResult {
  t: string;
  final: boolean;
}

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: { results: unknown[] }) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  startCalls = 0;
  stopCalls = 0;

  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.startCalls += 1;
  }
  stop() {
    this.stopCalls += 1;
  }
  // Drive helpers: handlers are read at call time so detached ones are no-ops.
  emitResults(list: FakeResult[]) {
    this.onresult?.({
      results: list.map((r) => ({ isFinal: r.final, 0: { transcript: r.t } })),
    });
  }
  emitError(error: string) {
    this.onerror?.({ error });
  }
  emitEnd() {
    this.onend?.();
  }
}

function setup(opts: SpeechInputOptions, key: "SpeechRecognition" | "webkitSpeechRecognition" = "SpeechRecognition") {
  const input = createWebSpeechInput(opts, { [key]: FakeRecognition });
  const log = {
    results: [] as SpeechResult[],
    utterances: [] as Utterance[],
    errors: [] as SpeechError[],
    ends: [] as ListeningEndReason[],
    speechStarts: 0,
  };
  input.onResult((r) => log.results.push(r));
  input.onUtterance((u) => log.utterances.push(u));
  input.onError((e) => log.errors.push(e));
  input.onEnd((e) => log.ends.push(e));
  input.onSpeechStart(() => {
    log.speechStarts += 1;
  });
  return { input, log };
}

const rec = (i = FakeRecognition.instances.length - 1) => FakeRecognition.instances[i]!;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  FakeRecognition.instances = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createWebSpeechInput setup", () => {
  it("configures recognition and reports its kind and mode", () => {
    const { input } = setup({ mode: "push-to-talk" });
    expect(input.kind).toBe("web-speech");
    expect(input.mode).toBe("push-to-talk");
    input.start();
    expect(rec().continuous).toBe(true);
    expect(rec().interimResults).toBe(true);
    expect(rec().lang).toBe("en-US");
    expect(rec().startCalls).toBe(1);
    expect(input.isListening()).toBe(true);
  });

  it("uses the lang option and the webkit constructor", () => {
    const { input } = setup({ mode: "continuous", lang: "en-GB" }, "webkitSpeechRecognition");
    input.start();
    expect(rec().lang).toBe("en-GB");
  });

  it("reports unsupported when no constructor exists", () => {
    const input: SpeechInput = createWebSpeechInput({ mode: "push-to-talk" }, {});
    const errors: SpeechError[] = [];
    const ends: ListeningEndReason[] = [];
    input.onError((e) => errors.push(e));
    input.onEnd((e) => ends.push(e));
    input.start();
    expect(errors.map((e) => e.kind)).toEqual(["unsupported"]);
    expect(ends).toEqual(["error"]);
    expect(input.isListening()).toBe(false);
  });
});

describe("push-to-talk", () => {
  it("emits interim then final results and one utterance on stop", () => {
    const { input, log } = setup({ mode: "push-to-talk" });
    input.start();
    vi.setSystemTime(100);
    rec().emitResults([{ t: "hello", final: false }]);
    vi.setSystemTime(300);
    rec().emitResults([
      { t: "hello there", final: true },
      { t: "my friend", final: false },
    ]);
    rec().emitResults([
      { t: "hello there", final: true },
      { t: "my friend", final: true },
    ]);
    expect(log.results.map((r) => [r.text, r.isFinal])).toEqual([
      ["hello", false],
      ["hello there my friend", false],
      ["hello there my friend", true],
    ]);
    expect(log.speechStarts).toBe(1);
    expect(log.utterances).toEqual([]);

    vi.setSystemTime(900);
    input.stop();
    expect(rec().stopCalls).toBe(1);
    expect(log.utterances).toEqual([
      { text: "hello there my friend", startedAtMs: 100, endedAtMs: 900 },
    ]);
    expect(log.ends).toEqual(["stopped"]);
    expect(input.isListening()).toBe(false);
  });

  it("emits no utterance for empty text but still ends", () => {
    const { input, log } = setup({ mode: "push-to-talk" });
    input.start();
    input.stop();
    expect(log.utterances).toEqual([]);
    expect(log.ends).toEqual(["stopped"]);
  });

  it("fires onSpeechStart from the engine's speech event once", () => {
    const { input, log } = setup({ mode: "push-to-talk" });
    input.start();
    rec().onspeechstart?.();
    rec().emitResults([{ t: "hi", final: false }]);
    expect(log.speechStarts).toBe(1);
  });

  it("ignores late events after stop", () => {
    const { input, log } = setup({ mode: "push-to-talk" });
    input.start();
    const first = rec();
    input.stop();
    first.emitResults([{ t: "late", final: true }]);
    first.emitEnd();
    first.emitError("network");
    expect(log.results).toEqual([]);
    expect(log.errors).toEqual([]);
    expect(log.ends).toEqual(["stopped"]);
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it("keeps text across a Chrome-initiated end and restart", () => {
    const { input, log } = setup({ mode: "push-to-talk" });
    input.start();
    rec().emitResults([{ t: "first part", final: true }]);
    const first = rec();
    first.emitEnd();
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(rec().startCalls).toBe(1);
    expect(input.isListening()).toBe(true);
    first.emitResults([{ t: "stale", final: true }]);
    rec().emitResults([{ t: "second part", final: true }]);
    input.stop();
    expect(log.utterances.map((u) => u.text)).toEqual(["first part second part"]);
    expect(log.ends).toEqual(["stopped"]);
  });
});

describe("continuous mode", () => {
  it("emits the utterance at exactly the silence timeout and keeps listening", () => {
    const { input, log } = setup({ mode: "continuous" });
    input.start();
    rec().emitResults([{ t: "I want a raise", final: true }]);
    vi.advanceTimersByTime(1499);
    expect(log.utterances).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(log.utterances.map((u) => u.text)).toEqual(["I want a raise"]);
    expect(input.isListening()).toBe(true);
    expect(log.ends).toEqual([]);
  });

  it("restarts the silence timer on each result", () => {
    const { input, log } = setup({ mode: "continuous" });
    input.start();
    rec().emitResults([{ t: "one", final: false }]);
    vi.advanceTimersByTime(1000);
    rec().emitResults([{ t: "one two", final: false }]);
    vi.advanceTimersByTime(1499);
    expect(log.utterances).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(log.utterances.map((u) => u.text)).toEqual(["one two"]);
  });

  it("honours a custom silence timeout", () => {
    const { input, log } = setup({ mode: "continuous", silenceTimeoutMs: 500 });
    input.start();
    rec().emitResults([{ t: "quick", final: true }]);
    vi.advanceTimersByTime(499);
    expect(log.utterances).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(log.utterances).toHaveLength(1);
  });

  it("separates consecutive utterances within one recognition session", () => {
    const { input, log } = setup({ mode: "continuous" });
    input.start();
    rec().emitResults([{ t: "first", final: true }]);
    vi.advanceTimersByTime(1500);
    rec().emitResults([
      { t: "first", final: true },
      { t: "second", final: true },
    ]);
    vi.advanceTimersByTime(1500);
    expect(log.utterances.map((u) => u.text)).toEqual(["first", "second"]);
    expect(log.speechStarts).toBe(2);
  });

  it("restarts recognition when Chrome ends it and keeps listening", () => {
    const { input, log } = setup({ mode: "continuous" });
    input.start();
    const first = rec();
    first.emitEnd();
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(rec()).not.toBe(first);
    expect(rec().continuous).toBe(true);
    expect(input.isListening()).toBe(true);
    expect(log.ends).toEqual([]);
    rec().emitResults([{ t: "after restart", final: true }]);
    vi.advanceTimersByTime(1500);
    expect(log.utterances.map((u) => u.text)).toEqual(["after restart"]);
  });

  it("does not restart after stop()", () => {
    const { input } = setup({ mode: "continuous" });
    input.start();
    const first = rec();
    input.stop();
    first.emitEnd();
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it("flushes pending text on stop and cancels the silence timer", () => {
    const { input, log } = setup({ mode: "continuous" });
    input.start();
    rec().emitResults([{ t: "wrap up", final: false }]);
    input.stop();
    vi.advanceTimersByTime(5000);
    expect(log.utterances.map((u) => u.text)).toEqual(["wrap up"]);
  });

  it("ignores no-speech errors", () => {
    const { input, log } = setup({ mode: "continuous" });
    input.start();
    rec().emitError("no-speech");
    expect(log.errors).toEqual([]);
    expect(log.ends).toEqual([]);
    expect(input.isListening()).toBe(true);
  });
});

describe("no-speech timeout", () => {
  it.each(["push-to-talk", "continuous"] as const)("ends at exactly 8000 ms in %s", (mode) => {
    const { input, log } = setup({ mode });
    input.start();
    const first = rec();
    vi.advanceTimersByTime(7999);
    expect(log.ends).toEqual([]);
    expect(input.isListening()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(log.ends).toEqual(["no-speech-timeout"]);
    expect(input.isListening()).toBe(false);
    expect(first.stopCalls).toBe(1);
  });

  it("is cancelled once speech is heard", () => {
    const { input, log } = setup({ mode: "push-to-talk" });
    input.start();
    vi.advanceTimersByTime(4000);
    rec().emitResults([{ t: "hi", final: false }]);
    vi.advanceTimersByTime(10_000);
    expect(log.ends).toEqual([]);
    expect(input.isListening()).toBe(true);
  });

  it("honours a custom timeout", () => {
    const { input, log } = setup({ mode: "push-to-talk", noSpeechTimeoutMs: 2000 });
    input.start();
    vi.advanceTimersByTime(1999);
    expect(log.ends).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(log.ends).toEqual(["no-speech-timeout"]);
  });

  it("is cleared by stop()", () => {
    const { input, log } = setup({ mode: "push-to-talk" });
    input.start();
    input.stop();
    vi.advanceTimersByTime(20_000);
    expect(log.ends).toEqual(["stopped"]);
  });
});

describe("errors", () => {
  it.each([
    ["not-allowed", "not-allowed"],
    ["service-not-allowed", "not-allowed"],
    ["audio-capture", "audio-capture"],
    ["network", "network"],
    ["aborted", "aborted"],
    ["language-not-supported", "unknown"],
  ] as const)("maps %s to %s and ends with error", (code, kind) => {
    const { input, log } = setup({ mode: "continuous" });
    input.start();
    const first = rec();
    first.emitError(code);
    expect(log.errors.map((e) => e.kind)).toEqual([kind]);
    expect(log.errors[0]!.message).not.toBe("");
    expect(log.ends).toEqual(["error"]);
    expect(input.isListening()).toBe(false);
    // Chrome's trailing onend must not restart or end twice.
    first.emitEnd();
    expect(log.ends).toEqual(["error"]);
    expect(FakeRecognition.instances).toHaveLength(1);
    vi.advanceTimersByTime(20_000);
    expect(log.ends).toEqual(["error"]);
  });

  it("reports no-speech in push-to-talk without ending", () => {
    const { input, log } = setup({ mode: "push-to-talk" });
    input.start();
    rec().emitError("no-speech");
    expect(log.errors.map((e) => e.kind)).toEqual(["no-speech"]);
    expect(log.ends).toEqual([]);
    expect(input.isListening()).toBe(true);
  });

  it("can start again after a fatal error", () => {
    const { input } = setup({ mode: "push-to-talk" });
    input.start();
    rec().emitError("not-allowed");
    input.start();
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(input.isListening()).toBe(true);
  });
});
