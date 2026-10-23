import { describe, expect, it } from "vitest";
import { ScenarioSchema } from "@/contracts/types";
import { BUILTIN_SCENARIOS } from "./builtins";

describe("BUILTIN_SCENARIOS", () => {
  it("has exactly the five expected scenarios with their difficulties", () => {
    expect(BUILTIN_SCENARIOS.map((s) => [s.id, s.difficulty])).toEqual([
      ["salary-raise", 3],
      ["faulty-refund", 2],
      ["say-no-extra-work", 3],
      ["seed-pitch", 4],
      ["rent-renewal", 2],
    ]);
  });

  it.each(BUILTIN_SCENARIOS.map((s) => [s.id, s] as const))("%s passes ScenarioSchema", (_id, s) => {
    expect(ScenarioSchema.safeParse(s).success).toBe(true);
  });
});
