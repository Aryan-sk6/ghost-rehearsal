/** Lowercase, curly apostrophe to straight, keep letters/digits/apostrophes/spaces, collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, (run) => (/\s/.test(run) ? " " : ""))
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(text: string): number {
  const normalized = normalizeText(text);
  return normalized === "" ? 0 : normalized.split(" ").length;
}

/**
 * Counts whole-word phrase matches. Longest phrase first, matches never
 * overlap. Returns one key per phrase, zeros included.
 */
export function countPhrases(text: string, phrases: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const phrase of phrases) counts[phrase] = 0;

  const normalized = normalizeText(text);
  if (normalized === "") return counts;
  const words = normalized.split(" ");
  const used: boolean[] = words.map(() => false);

  const ordered = phrases
    .map((phrase) => ({ phrase, tokens: normalizeText(phrase).split(" ") }))
    .filter((entry) => entry.tokens[0] !== "")
    .sort((a, b) => b.tokens.length - a.tokens.length || b.phrase.length - a.phrase.length);

  for (const { phrase, tokens } of ordered) {
    for (let start = 0; start + tokens.length <= words.length; start += 1) {
      let matches = true;
      for (let k = 0; k < tokens.length; k += 1) {
        if (used[start + k] || words[start + k] !== tokens[k]) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
      for (let k = 0; k < tokens.length; k += 1) used[start + k] = true;
      counts[phrase] = (counts[phrase] ?? 0) + 1;
      start += tokens.length - 1;
    }
  }
  return counts;
}

export function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, n) => total + n, 0);
}
