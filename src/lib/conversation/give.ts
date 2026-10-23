import { MAX_GIVE, MIN_GIVE, maxGiveDeltaFor } from "@/contracts/constants";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Next give from the previous one and the model's proposal, per contracts/README.md. */
export function applyGive(prev: number, proposed: number, difficulty: number): number {
  const d = maxGiveDeltaFor(difficulty);
  const p = clamp(Number.isNaN(proposed) ? prev : Math.round(proposed), MIN_GIVE, MAX_GIVE);
  return clamp(prev + clamp(p - prev, -d, d), MIN_GIVE, MAX_GIVE);
}
