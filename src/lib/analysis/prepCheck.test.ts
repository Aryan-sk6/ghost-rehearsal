import { describe, expect, it } from "vitest";
import type { Turn } from "@/contracts/types";
import { checkPrep, findAmounts, hasPlan } from "./prepCheck";

function conversation(...userLines: string[]): Turn[] {
  const turns: Turn[] = [{ speaker: "counterpart", text: "Hello.", startedAtMs: 0, endedAtMs: 1 }];
  userLines.forEach((text, i) => {
    turns.push({ speaker: "user", text, startedAtMs: i * 10 + 2, endedAtMs: i * 10 + 3 });
    turns.push({ speaker: "counterpart", text: "Hmm.", startedAtMs: i * 10 + 4, endedAtMs: i * 10 + 5 });
  });
  return turns;
}

const texts = (plan: { ask: string; walkAway: string }, turns: Turn[]) =>
  checkPrep(plan, turns).map((f) => `${f.tone}: ${f.text}`);

describe("findAmounts", () => {
  it.each([
    ["A 10% raise", [{ value: 10, unit: "percent", raw: "10%" }]],
    ["ten percent please", [{ value: 10, unit: "percent", raw: "ten percent" }]],
    ["$95,000, or 95k", [
      { value: 95000, unit: "amount", raw: "$95,000" },
      { value: 95000, unit: "amount", raw: "95k" },
    ]],
    ["Lead a $1.5M round", [{ value: 1_500_000, unit: "amount", raw: "$1.5M" }]],
    ["fifty thousand", [{ value: 50000, unit: "amount", raw: "fifty thousand" }]],
    ["No figure at all", []],
  ])("reads %s", (text, expected) => {
    expect(findAmounts(text)).toEqual(expected);
  });
});

describe("checkPrep", () => {
  const plan = { ask: "10% raise", walkAway: "6%" };

  it("says nothing without a plan", () => {
    expect(checkPrep({ ask: " ", walkAway: "" }, conversation("Hi."))).toEqual([]);
    expect(hasPlan({ ask: " ", walkAway: "" })).toBe(false);
    expect(hasPlan(null)).toBe(false);
    expect(hasPlan(plan)).toBe(true);
  });

  it("praises opening with the planned ask and holding the walk-away", () => {
    expect(texts(plan, conversation("I'd like a 10% raise.", "I could do 8%."))).toEqual([
      "good: You opened with 10%, as planned.",
      "good: You never went past your walk-away of 6%.",
    ]);
  });

  it("flags a weaker opening and going past the walk-away", () => {
    expect(texts(plan, conversation("Could I get 7%?", "Fine, 5% then."))).toEqual([
      "warn: You planned 10% but opened with 7%, a weaker ask than planned.",
      "warn: In your turn 2 you offered 5%, past the 6% you said you'd walk away at.",
    ]);
  });

  it("flags a late ask and a never-named ask", () => {
    expect(texts(plan, conversation("Can we talk pay?", "I want 10%."))[0]).toBe(
      "warn: You asked for 10% as planned, but not until your turn 2.",
    );
    expect(texts(plan, conversation("Can we talk pay?"))[0]).toBe(
      "warn: You planned to ask for 10% but never named it.",
    );
  });

  it("works when lower is better, like rent", () => {
    const rent = { ask: "0% increase", walkAway: "3%" };
    expect(texts(rent, conversation("I'd like to keep it at 0%.", "I could accept 4%."))).toEqual([
      "good: You opened with 0%, as planned.",
      "warn: In your turn 2 you offered 4%, past the 3% you said you'd walk away at.",
    ]);
  });

  it("ignores figures of another kind or size", () => {
    const money = { ask: "$95,000", walkAway: "$88,000" };
    expect(texts(money, conversation("Can we revisit in 3 months? $95,000 is fair."))).toEqual([
      "good: You opened with $95,000, as planned.",
      "good: You never went past your walk-away of $88,000.",
    ]);
  });

  it("asks for numbers when the plan has none", () => {
    expect(texts({ ask: "Ask for a raise", walkAway: "" }, conversation("I'd like 10%."))).toEqual([
      "neutral: Put a number in both boxes next time and this will check your opening ask and your walk-away against what you said.",
    ]);
  });
});
