import { describe, expect, it } from "vitest";
import { checkUserTurn } from "./turnChecks";

const summary = (text: string) => checkUserTurn(text).map((c) => `${c.kind}:${c.evidence}`);

describe("checkUserTurn", () => {
  it.each([
    ["I'd like a 10% raise.", ["number:10%"]],
    ["I'm asking for $95,000.", ["number:$95,000"]],
    ["Let's say 95k.", ["number:95k"]],
    ["Ten percent feels right.", ["number:Ten"]],
    ["That is the one thing I need.", []],
  ])("finds numbers: %s", (text, expected) => {
    expect(summary(text)).toEqual(expected);
  });

  it("finds a reason", () => {
    expect(summary("I should get it because I led the launch.")).toEqual(["reason:because"]);
    expect(summary("Given that I doubled sales, it's fair.")).toEqual(["reason:Given that"]);
  });

  it("finds hedges, apologies and concessions as weak habits", () => {
    const checks = checkUserTurn("Sorry, I think maybe it's fine. Fair enough.");
    expect(checks.map((c) => [c.kind, c.good, c.evidence])).toEqual([
      ["hedge", false, "I think maybe"],
      ["apology", false, "Sorry"],
      ["concession", false, "Fair enough"],
    ]);
  });

  it("lists helpful habits before weak ones", () => {
    expect(checkUserTurn("Maybe 10%, because I earned it.").map((c) => c.kind)).toEqual([
      "number",
      "reason",
      "hedge",
    ]);
  });

  it("returns nothing for a plain line", () => {
    expect(checkUserTurn("Could we revisit in spring?")).toEqual([]);
    expect(checkUserTurn("")).toEqual([]);
  });

  it("keeps curly apostrophes and the user's casing", () => {
    expect(summary("That’s why I asked. I SUPPOSE so.")).toEqual(["reason:That’s why", "hedge:I SUPPOSE"]);
  });

  it("matches whole words only", () => {
    expect(summary("I'm becausey and unsorry.")).toEqual([]);
  });
});
