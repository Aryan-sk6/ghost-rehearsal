import type { SpeakResult, SpeechOutput } from "@/contracts/speech";

export interface SpeechQueue {
  /** Says this after everything already queued. Ignored once stopped. */
  push(text: string): void;
  /** Stops now and drops anything still queued. */
  stop(): void;
  /** True once anything has been queued. */
  hasStarted(): boolean;
  /** Resolves once everything pushed so far has been said or dropped. */
  done(): Promise<SpeakResult>;
}

/**
 * Speaks pieces of one reply back to back. If any piece is cut short (the user
 * talked over it), the rest is dropped too.
 */
export function createSpeechQueue(output: SpeechOutput | undefined, now: () => number): SpeechQueue {
  let chain: Promise<void> = Promise.resolve();
  let startedAtMs: number | null = null;
  let endedAtMs: number | null = null;
  let stopped = false;
  let pushed = 0;

  return {
    push(text) {
      if (stopped) return;
      pushed += 1;
      chain = chain.then(async () => {
        if (stopped) return;
        const result = output
          ? await output.speak(text)
          : { startedAtMs: now(), endedAtMs: now(), cancelled: false };
        startedAtMs ??= result.startedAtMs;
        endedAtMs = result.endedAtMs;
        if (result.cancelled) stopped = true;
      });
    },
    hasStarted: () => pushed > 0,
    stop() {
      stopped = true;
      output?.cancel();
    },
    async done() {
      await chain;
      const end = endedAtMs ?? now();
      return { startedAtMs: startedAtMs ?? end, endedAtMs: end, cancelled: stopped };
    },
  };
}
