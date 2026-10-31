import type { LlmClient } from "@/contracts/llm";
import type { SpeechBundle, SpeechInputOptions } from "@/contracts/speech";
import { createLocalHistoryStore, type HistoryStore } from "@/lib/history";
import { createSpeech } from "@/lib/speech";
import { createHttpLlmClient } from "@/lib/llm";

/** Everything the controller needs from the outside world, so tests can inject fakes. */
export interface RehearsalDeps {
  createLlm(apiKey: string): LlmClient;
  createSpeech(opts: SpeechInputOptions): SpeechBundle;
  now(): number;
  newId(): string;
  /** Where finished rehearsals are remembered. Left out, nothing is saved. */
  history?: HistoryStore;
}

/** Real browser wiring. Nothing here runs until a method is called, so `next build` can prerender. */
export const browserDeps: RehearsalDeps = {
  createLlm: (apiKey) => createHttpLlmClient({ apiKey }),
  createSpeech: (opts) => createSpeech(opts),
  now: () => Date.now(),
  newId: () => crypto.randomUUID(),
  history: createLocalHistoryStore(),
};
