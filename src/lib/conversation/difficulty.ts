export const DIFFICULTY_TRAITS: Readonly<Record<1 | 2 | 3 | 4 | 5, readonly string[]>> = {
  1: ["patient", "open to reason"],
  2: ["polite", "a little cautious"],
  3: ["busy", "sceptical"],
  4: ["firm", "tests every claim"],
  5: ["stubborn", "dismisses weak arguments", "rarely concedes"],
};

/** Extra traits for a difficulty; out-of-range values are clamped to 1-5. */
export function traitsForDifficulty(difficulty: number): readonly string[] {
  const level = Math.min(5, Math.max(1, Math.round(difficulty))) as 1 | 2 | 3 | 4 | 5;
  return DIFFICULTY_TRAITS[level];
}
