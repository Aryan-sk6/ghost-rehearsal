import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "@/contracts/fakes";
import { ScenarioSchema } from "@/contracts/types";

describe("smoke", () => {
  it("parses a sample scenario", () => {
    const result = ScenarioSchema.safeParse({
      id: "sample",
      title: "Ask for a raise",
      userGoal: "Get a 10% raise",
      counterpartRole: "Your manager",
      counterpartTraits: ["busy"],
      difficulty: 3,
      openingLine: "You wanted a word?",
      hiddenBottomLine: "Can approve at most 6%",
    });
    expect(result.success).toBe(true);
  });

  it("returns a scripted string from FakeLlmClient", async () => {
    const llm = new FakeLlmClient(["hello"]);
    const text = await llm.complete({
      purpose: "counterpart",
      system: "s",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 10,
    });
    expect(text).toBe("hello");
  });

  it("blocks real fetch", () => {
    expect(() => fetch("https://example.com")).toThrow(
      "Real network calls are not allowed in tests",
    );
  });
});
