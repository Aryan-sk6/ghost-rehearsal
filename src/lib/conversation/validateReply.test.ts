import { describe, expect, it } from "vitest";
import type { Scenario } from "@/contracts/types";
import { validateReply } from "./validateReply";

const scenario: Scenario = {
  id: "s",
  title: "Raise",
  userGoal: "Get a raise",
  counterpartRole: "Manager",
  counterpartTraits: ["busy"],
  difficulty: 3,
  openingLine: "Hi.",
  hiddenBottomLine: "I can go up to 8% max",
};

const json = (reply: string) => JSON.stringify({ reply, mood: "neutral", give: 40 });

describe("validateReply", () => {
  it("accepts 3 sentences", () => {
    expect(validateReply(json("One. Two! Three?"), scenario).ok).toBe(true);
  });

  it("rejects 4 sentences", () => {
    expect(validateReply(json("One. Two. Three. Four."), scenario).ok).toBe(false);
  });

  it("counts trailing text as a sentence", () => {
    expect(validateReply(json("One. Two. Three. Four"), scenario).ok).toBe(false);
  });

  it("rejects a bottom-line leak regardless of case and spacing", () => {
    const r = validateReply(json("Well,  i CAN go\nup   to 8% MAX, honestly."), scenario);
    expect(r.ok).toBe(false);
  });

  it("parses fenced JSON", () => {
    const r = validateReply("Here:\n```json\n" + json("Fine.") + "\n```", scenario);
    expect(r).toMatchObject({ ok: true, reply: { reply: "Fine.", mood: "neutral", give: 40 } });
  });

  it("rejects non-JSON and bad shape", () => {
    expect(validateReply("nope", scenario).ok).toBe(false);
    expect(validateReply('{"reply":"x","mood":"angry","give":1}', scenario).ok).toBe(false);
  });
});
