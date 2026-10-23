import { describe, expect, it } from "vitest";
import { LlmError, RehearsalError } from "@/contracts/errors";
import { FakeLlmClient } from "@/contracts/fakes";
import type { Session, Turn } from "@/contracts/types";
import { requestAnalysis } from "./analysis";
import { computeMetrics } from "./metrics";

const scenario = {
  id: "s",
  title: "Ask for a raise",
  userGoal: "Get a 10% raise",
  counterpartRole: "your manager",
  counterpartTraits: ["firm"],
  difficulty: 3,
  openingLine: "Hi",
  hiddenBottomLine: "Budget allows 6%",
};

const t = (speaker: Turn["speaker"], text: string, n: number): Turn => ({
  speaker,
  text,
  startedAtMs: n * 1000,
  endedAtMs: n * 1000 + 800,
});

// indexes: 0 them, 1 you, 2 them, 3 you, 4 them, 5 you, 6 them
const session: Session = {
  id: "x",
  scenario,
  status: "ended",
  turns: [
    t("counterpart", "Hi, what is on your mind?", 0),
    t("user", "I would like a raise, maybe.", 1),
    t("counterpart", "Why now?", 2),
    t("user", "Um, I took on more work.", 3),
    t("counterpart", "I see.", 4),
    t("user", "Fair enough, never mind.", 5),
    t("counterpart", "Thanks.", 6),
  ],
  giveHistory: [30, 30, 35, 35, 30, 30, 25],
  moodHistory: ["neutral", "neutral", "guarded", "guarded", "guarded", "guarded", "impatient"],
  endReason: "user_ended",
  startedAtMs: 0,
  endedAtMs: 7000,
};

const metrics = computeMetrics(session);

function analysisJson(indexes: number[], userSaid = "paraphrase"): string {
  return JSON.stringify({
    scores: { clarity: 6, confidence: 4, handlingPushback: 5, outcome: 3 },
    summary: "You hedged and gave up early.",
    lostGround: indexes.map((turnIndex) => ({
      turnIndex,
      userSaid,
      whyItHurt: "It weakened the ask.",
      strongerLine: "I am asking for 10%, and here is why.",
    })),
  });
}

describe("requestAnalysis", () => {
  it("returns a valid analysis whose moments refer to real user turns", async () => {
    const llm = new FakeLlmClient([analysisJson([1, 3, 5])]);
    const result = await requestAnalysis(session, metrics, llm);
    expect(result.scores).toEqual({ clarity: 6, confidence: 4, handlingPushback: 5, outcome: 3 });
    expect(result.lostGround.map((m) => m.turnIndex)).toEqual([1, 3, 5]);
    for (const moment of result.lostGround) {
      expect(session.turns[moment.turnIndex]?.speaker).toBe("user");
    }
    expect(llm.calls).toHaveLength(1);
  });

  it("builds the request and prompt as specified", async () => {
    const llm = new FakeLlmClient([analysisJson([1, 3, 5])]);
    await requestAnalysis(session, metrics, llm);
    const call = llm.calls[0];
    expect(call?.purpose).toBe("analysis");
    expect(call?.maxTokens).toBe(1500);
    expect(call?.temperature).toBe(0.3);
    expect(call?.system).toContain("blunt");
    expect(call?.system).toContain("Budget allows 6%");
    expect(call?.system).toContain('"wordsPerMinute"');
    const message = call?.messages[0]?.content ?? "";
    expect(message).toContain("[turn 1] You: I would like a raise, maybe.");
    expect(message).toContain("[turn 2] Them: Why now?");
  });

  it("replaces userSaid with the real turn text", async () => {
    const llm = new FakeLlmClient([analysisJson([1, 3, 5], "something invented")]);
    const result = await requestAnalysis(session, metrics, llm);
    expect(result.lostGround.map((m) => m.userSaid)).toEqual([
      "I would like a raise, maybe.",
      "Um, I took on more work.",
      "Fair enough, never mind.",
    ]);
  });

  it("retries once when a moment points at a counterpart turn", async () => {
    const llm = new FakeLlmClient([analysisJson([1, 2, 5]), analysisJson([1, 3, 5])]);
    const result = await requestAnalysis(session, metrics, llm);
    expect(result.lostGround.map((m) => m.turnIndex)).toEqual([1, 3, 5]);
    expect(llm.calls).toHaveLength(2);
    const retry = llm.calls[1]?.messages[0]?.content ?? "";
    expect(retry).toContain("Your previous output was invalid:");
    expect(retry).toContain("turnIndex 2");
  });

  it("retries once on duplicate indexes", async () => {
    const llm = new FakeLlmClient([analysisJson([1, 3, 3]), analysisJson([1, 3, 5])]);
    await requestAnalysis(session, metrics, llm);
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1]?.messages[0]?.content).toContain("more than once");
  });

  it("retries once when only 2 moments are returned", async () => {
    const llm = new FakeLlmClient([analysisJson([1, 3]), analysisJson([1, 3, 5])]);
    await requestAnalysis(session, metrics, llm);
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1]?.messages[0]?.content).toContain("lostGround");
  });

  it("retries once on text that is not JSON", async () => {
    const llm = new FakeLlmClient(["not json at all", analysisJson([1, 3, 5])]);
    await requestAnalysis(session, metrics, llm);
    expect(llm.calls).toHaveLength(2);
  });

  it("throws invalid_output after two invalid answers", async () => {
    const llm = new FakeLlmClient([analysisJson([1, 3]), analysisJson([1, 2, 5])]);
    await expect(requestAnalysis(session, metrics, llm)).rejects.toMatchObject({
      name: "LlmError",
      kind: "invalid_output",
    });
    expect(llm.calls).toHaveLength(2);
  });

  it("rethrows transport errors without a retry", async () => {
    const llm = new FakeLlmClient([new LlmError("rate_limited", "slow down"), analysisJson([1, 3, 5])]);
    await expect(requestAnalysis(session, metrics, llm)).rejects.toMatchObject({ kind: "rate_limited" });
    expect(llm.calls).toHaveLength(1);
    expect(llm.remaining).toBe(1);
  });

  it("throws too_short_for_analysis with fewer than 3 user turns", async () => {
    const short: Session = {
      ...session,
      turns: session.turns.slice(0, 5),
      giveHistory: session.giveHistory.slice(0, 5),
      moodHistory: session.moodHistory.slice(0, 5),
    };
    const llm = new FakeLlmClient([analysisJson([1, 3, 5])]);
    const error = await requestAnalysis(short, metrics, llm).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RehearsalError);
    expect((error as RehearsalError).code).toBe("too_short_for_analysis");
    expect(llm.calls).toHaveLength(0);
  });
});
