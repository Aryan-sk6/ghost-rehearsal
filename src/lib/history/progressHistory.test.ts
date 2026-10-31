import { describe, expect, it } from "vitest";
import type { Session, Turn } from "@/contracts/types";
import { BUILTIN_SCENARIOS } from "@/scenarios/builtins";
import {
  HISTORY_STORAGE_KEY,
  MAX_HISTORY_ENTRIES,
  addEntry,
  createLocalHistoryStore,
  entryFromSession,
  habitChanges,
  progressFor,
  summarizeByScenario,
  type HistoryEntry,
} from "./progressHistory";

const SCENARIO = BUILTIN_SCENARIOS[0] as (typeof BUILTIN_SCENARIOS)[number];

function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    key: "k",
    scenarioId: SCENARIO.id,
    scenarioTitle: SCENARIO.title,
    endedAtMs: 1000,
    finalGive: 40,
    goal: 80,
    endReason: "user_ended",
    userTurns: 4,
    habits: { number: 1, reason: 1, hedge: 2, apology: 0, concession: 0 },
    retry: false,
    ...over,
  };
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

describe("entryFromSession", () => {
  it("records scores and habit counts, never the words", () => {
    const t = (speaker: Turn["speaker"], text: string): Turn => ({ speaker, text, startedAtMs: 0, endedAtMs: 0 });
    const session: Session = {
      id: "s1",
      scenario: SCENARIO,
      status: "ended",
      turns: [
        t("counterpart", "Hello."),
        t("user", "Sorry, maybe 10%?"),
        t("counterpart", "No."),
        t("user", "I want 10% because I led the launch."),
        t("counterpart", "OK."),
      ],
      giveHistory: [30, 30, 25, 25, 45],
      moodHistory: ["neutral", "neutral", "guarded", "guarded", "open"],
      endReason: "user_ended",
      startedAtMs: 0,
      endedAtMs: 5000,
    };
    const result = entryFromSession(session, { endedAtMs: 9999, retry: true });
    expect(result).toEqual({
      key: "s1:5000:5",
      scenarioId: SCENARIO.id,
      scenarioTitle: SCENARIO.title,
      endedAtMs: 5000,
      finalGive: 45,
      goal: 80,
      endReason: "user_ended",
      userTurns: 2,
      habits: { number: 2, reason: 1, hedge: 1, apology: 1, concession: 0 },
      retry: true,
    });
    expect(JSON.stringify(result)).not.toContain("launch");
  });
});

describe("addEntry", () => {
  it("puts the newest first, drops duplicates and caps the list", () => {
    const many = Array.from({ length: MAX_HISTORY_ENTRIES }, (_, i) => entry({ key: `k${i}` }));
    const next = addEntry(many, entry({ key: "new" }));
    expect(next).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(next[0]?.key).toBe("new");
    expect(addEntry([entry({ key: "a" }), entry({ key: "b" })], entry({ key: "b", finalGive: 70 })).map((e) => e.key)).toEqual(["b", "a"]);
  });
});

describe("createLocalHistoryStore", () => {
  it("saves and loads entries", () => {
    const storage = memoryStorage();
    const store = createLocalHistoryStore(storage);
    expect(store.load()).toEqual([]);
    store.save([entry()]);
    expect(store.load()).toEqual([entry()]);
    store.save([]);
    expect(storage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
  });

  it("skips damaged entries and bad JSON", () => {
    const storage = memoryStorage();
    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([entry(), { key: "broken" }]));
    expect(createLocalHistoryStore(storage).load()).toEqual([entry()]);
    storage.setItem(HISTORY_STORAGE_KEY, "{not json");
    expect(createLocalHistoryStore(storage).load()).toEqual([]);
  });

  it("works without storage and when storage throws", () => {
    const none = createLocalHistoryStore(null);
    none.save([entry()]);
    expect(none.load()).toEqual([]);
    const throwing = memoryStorage();
    throwing.getItem = () => {
      throw new Error("blocked");
    };
    throwing.setItem = () => {
      throw new Error("full");
    };
    const store = createLocalHistoryStore(throwing);
    expect(() => store.save([entry()])).not.toThrow();
    expect(store.load()).toEqual([]);
  });
});

describe("progress", () => {
  const history = [
    entry({ key: "c", finalGive: 52, endedAtMs: 3000 }),
    entry({ key: "b", finalGive: 60, endedAtMs: 2000 }),
    entry({ key: "x", scenarioId: "other", scenarioTitle: "Other", finalGive: 90 }),
    entry({ key: "a", finalGive: 40, endedAtMs: 1000 }),
  ];

  it("finds the previous and best earlier attempt", () => {
    const current = history[0] as HistoryEntry;
    const progress = progressFor(history, current);
    expect(progress.attempts).toBe(3);
    expect(progress.previous?.key).toBe("b");
    expect(progress.bestBefore?.key).toBe("b");
    expect(progressFor([current], current)).toEqual({ attempts: 1, previous: null, bestBefore: null });
  });

  it("summarises each scenario, most recent first", () => {
    expect(summarizeByScenario(history)).toEqual([
      {
        scenarioId: SCENARIO.id,
        scenarioTitle: SCENARIO.title,
        attempts: 3,
        latest: 52,
        best: 60,
        goal: 80,
        recent: [40, 60, 52],
      },
      { scenarioId: "other", scenarioTitle: "Other", attempts: 1, latest: 90, best: 90, goal: 80, recent: [90] },
    ]);
  });

  it("lists habits whose share of turns changed", () => {
    const before = entry({ userTurns: 4, habits: { number: 1, reason: 1, hedge: 2, apology: 0, concession: 0 } });
    const now = entry({ userTurns: 2, habits: { number: 1, reason: 1, hedge: 0, apology: 1, concession: 0 } });
    expect(habitChanges(now, before).map((c) => [c.kind, c.better])).toEqual([
      ["number", true],
      ["reason", true],
      ["hedge", true],
      ["apology", false],
    ]);
  });
});
