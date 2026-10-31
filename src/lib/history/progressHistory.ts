import { z } from "zod";
import { GOAL_GIVE, START_GIVE } from "@/contracts/constants";
import { EndReasonSchema, type Session } from "@/contracts/types";
import { checkUserTurn, type TurnCheckKind } from "@/lib/analysis";

/** Bump the version if the entry shape changes; old entries are then ignored. */
export const HISTORY_STORAGE_KEY = "ghost-rehearsal.history.v1";
export const MAX_HISTORY_ENTRIES = 100;

export const HABIT_KINDS = ["number", "reason", "hedge", "apology", "concession"] as const satisfies readonly TurnCheckKind[];

const CountSchema = z.number().int().nonnegative();

/** One finished rehearsal. Holds scores and counts only, never what anyone said. */
export const HistoryEntrySchema = z.object({
  /** Unique per finished attempt, so the same ending is never saved twice. */
  key: z.string().min(1),
  scenarioId: z.string().min(1),
  scenarioTitle: z.string(),
  endedAtMs: z.number().nonnegative(),
  finalGive: z.number().min(0).max(100),
  goal: z.number().min(0).max(100),
  endReason: EndReasonSchema,
  userTurns: CountSchema,
  /** How many of the user's turns showed each habit. */
  habits: z.object({
    number: CountSchema,
    reason: CountSchema,
    hedge: CountSchema,
    apology: CountSchema,
    concession: CountSchema,
  }),
  /** True when this attempt came from "Retry from here". */
  retry: z.boolean(),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export interface HistoryStore {
  load(): HistoryEntry[];
  save(entries: readonly HistoryEntry[]): void;
}

/** Builds the record for an ended session. */
export function entryFromSession(session: Session, opts: { endedAtMs: number; retry: boolean }): HistoryEntry {
  const habits = { number: 0, reason: 0, hedge: 0, apology: 0, concession: 0 };
  let userTurns = 0;
  for (const turn of session.turns) {
    if (turn.speaker !== "user") continue;
    userTurns += 1;
    for (const check of checkUserTurn(turn.text)) habits[check.kind] += 1;
  }
  const endedAtMs = session.endedAtMs ?? opts.endedAtMs;
  return {
    key: `${session.id}:${endedAtMs}:${session.turns.length}`,
    scenarioId: session.scenario.id,
    scenarioTitle: session.scenario.title,
    endedAtMs,
    finalGive: session.giveHistory[session.giveHistory.length - 1] ?? START_GIVE,
    goal: GOAL_GIVE,
    endReason: session.endReason ?? "user_ended",
    userTurns,
    habits,
    retry: opts.retry,
  };
}

/** Newest first, no duplicate keys, at most MAX_HISTORY_ENTRIES. */
export function addEntry(entries: readonly HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...entries.filter((e) => e.key !== entry.key)].slice(0, MAX_HISTORY_ENTRIES);
}

function parseEntries(raw: string | null): HistoryEntry[] {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  // Keep every valid entry even if one is damaged.
  return data.flatMap((item) => {
    const parsed = HistoryEntrySchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

function browserStorage(): Storage | null {
  try {
    // The one allowed use of storage: progress scores and counts, never text or the API key.
    // eslint-disable-next-line no-restricted-properties
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * History kept in this browser's localStorage. Private windows or blocked
 * storage just mean nothing is remembered; the app works the same.
 */
export function createLocalHistoryStore(given?: Storage | null): HistoryStore {
  // Looked up on use, not on import, so server rendering never touches it.
  const resolve = (): Storage | null => (given === undefined ? browserStorage() : given);
  return {
    load() {
      const storage = resolve();
      if (storage === null) return [];
      try {
        return parseEntries(storage.getItem(HISTORY_STORAGE_KEY));
      } catch {
        return [];
      }
    },
    save(entries) {
      const storage = resolve();
      if (storage === null) return;
      try {
        if (entries.length === 0) storage.removeItem(HISTORY_STORAGE_KEY);
        else storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
      } catch {
        // Storage full or blocked: progress just isn't remembered.
      }
    },
  };
}

/** In-memory store for tests. */
export function createMemoryHistoryStore(initial: readonly HistoryEntry[] = []): HistoryStore & {
  entries: HistoryEntry[];
} {
  const store = {
    entries: [...initial],
    load: () => [...store.entries],
    save: (entries: readonly HistoryEntry[]) => {
      store.entries = [...entries];
    },
  };
  return store;
}

/** Earlier attempts at one scenario, for the results screen. */
export interface ScenarioProgress {
  /** Attempts so far, including the current one. */
  attempts: number;
  previous: HistoryEntry | null;
  /** Best ending of the earlier attempts. */
  bestBefore: HistoryEntry | null;
}

export function progressFor(entries: readonly HistoryEntry[], current: HistoryEntry): ScenarioProgress {
  const earlier = entries.filter((e) => e.scenarioId === current.scenarioId && e.key !== current.key);
  const bestBefore = earlier.reduce<HistoryEntry | null>(
    (best, e) => (best === null || e.finalGive > best.finalGive ? e : best),
    null,
  );
  return { attempts: earlier.length + 1, previous: earlier[0] ?? null, bestBefore };
}

/** One row per scenario practised, most recent first, for the picker. */
export interface ScenarioSummary {
  scenarioId: string;
  scenarioTitle: string;
  attempts: number;
  latest: number;
  best: number;
  goal: number;
  /** Final scores, oldest to newest, at most the last 8. */
  recent: number[];
}

export function summarizeByScenario(entries: readonly HistoryEntry[]): ScenarioSummary[] {
  const byId = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const list = byId.get(entry.scenarioId) ?? [];
    list.push(entry);
    byId.set(entry.scenarioId, list);
  }
  return [...byId.values()].map((list) => {
    const newest = list[0] as HistoryEntry;
    return {
      scenarioId: newest.scenarioId,
      scenarioTitle: newest.scenarioTitle,
      attempts: list.length,
      latest: newest.finalGive,
      best: Math.max(...list.map((e) => e.finalGive)),
      goal: newest.goal,
      recent: list.slice(0, 8).map((e) => e.finalGive).reverse(),
    };
  });
}

export const HABIT_LABELS: Record<(typeof HABIT_KINDS)[number], { label: string; good: boolean }> = {
  number: { label: "Named a number", good: true },
  reason: { label: "Gave a reason", good: true },
  hedge: { label: "Hedged", good: false },
  apology: { label: "Apologised", good: false },
  concession: { label: "Gave ground", good: false },
};

export interface HabitChange {
  kind: (typeof HABIT_KINDS)[number];
  label: string;
  now: number;
  nowTurns: number;
  before: number;
  beforeTurns: number;
  /** True when the change is in the helpful direction. */
  better: boolean;
}

/** Habits whose share of turns changed since the previous attempt. */
export function habitChanges(current: HistoryEntry, previous: HistoryEntry): HabitChange[] {
  const share = (count: number, turns: number) => (turns === 0 ? 0 : count / turns);
  return HABIT_KINDS.flatMap((kind) => {
    const nowShare = share(current.habits[kind], current.userTurns);
    const beforeShare = share(previous.habits[kind], previous.userTurns);
    if (Math.abs(nowShare - beforeShare) < 1e-9) return [];
    const { label, good } = HABIT_LABELS[kind];
    return [
      {
        kind,
        label,
        now: current.habits[kind],
        nowTurns: current.userTurns,
        before: previous.habits[kind],
        beforeTurns: previous.userTurns,
        better: good ? nowShare > beforeShare : nowShare < beforeShare,
      },
    ];
  });
}
