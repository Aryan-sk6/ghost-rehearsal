import { describe, expect, it } from "vitest";
import { applyGive } from "./give";
import { DIFFICULTY_TRAITS } from "./difficulty";

describe("applyGive", () => {
  it("never leaves 0-100", () => {
    for (const d of [1, 2, 3, 4, 5]) {
      for (const proposed of [-50, 250, -1e9, 1e9, Infinity, -Infinity, NaN]) {
        for (const prev of [0, 5, 50, 95, 100]) {
          const next = applyGive(prev, proposed, d);
          expect(next).toBeGreaterThanOrEqual(0);
          expect(next).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("caps the move at 25 for difficulty 1", () => {
    expect(applyGive(50, 100, 1)).toBe(75);
    expect(applyGive(50, 0, 1)).toBe(25);
  });

  it("caps the move at 8 for difficulty 5", () => {
    expect(applyGive(50, 100, 5)).toBe(58);
    expect(applyGive(50, 0, 5)).toBe(42);
  });

  it("rounds and passes small moves through", () => {
    expect(applyGive(30, 34.6, 3)).toBe(35);
  });

  it("holds on NaN", () => {
    expect(applyGive(40, NaN, 3)).toBe(40);
  });
});

describe("DIFFICULTY_TRAITS", () => {
  it("covers 1-5", () => {
    expect(Object.keys(DIFFICULTY_TRAITS)).toEqual(["1", "2", "3", "4", "5"]);
    expect(DIFFICULTY_TRAITS[5]).toContain("rarely concedes");
  });
});
