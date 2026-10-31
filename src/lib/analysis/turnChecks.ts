import { CONCESSION_PHRASES, HEDGE_PHRASES } from "@/contracts/constants";
import { countPhrases, normalizeText } from "./normalize";

export type TurnCheckKind = "number" | "reason" | "hedge" | "apology" | "concession";

/** One thing a user turn did, found by plain word matching (no model call). */
export interface TurnCheck {
  kind: TurnCheckKind;
  /** True for habits that help an ask, false for ones that weaken it. */
  good: boolean;
  label: string;
  /** The words that triggered it, as the user said them where possible. */
  evidence: string;
}

export const REASON_PHRASES = [
  "because",
  "given that",
  "due to",
  "based on",
  "that's why",
  "which is why",
  "the reason",
  "so that",
] as const;

export const APOLOGY_PHRASES = ["sorry", "apologies", "i apologise", "i apologize"] as const;

// "one" is left out: "the one thing" is not a figure.
const NUMBER_WORDS = new Set([
  "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "fifteen", "twenty", "thirty", "forty", "fifty",
  "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "million",
  "half", "percent",
]);

const NUMBER_PATTERN = /[$£€]?\d[\d,.]*\s?(?:%|k\b|percent\b)?/i;

function findNumber(text: string): string | null {
  const digits = NUMBER_PATTERN.exec(text);
  if (digits) return digits[0].trim().replace(/[.,]$/, "");
  const word = normalizeText(text)
    .split(" ")
    .find((w) => NUMBER_WORDS.has(w));
  return word === undefined ? null : asWritten(text, word);
}

/** The phrase as written in `text` (original case), or the phrase itself. */
function asWritten(text: string, phrase: string): string {
  const pattern = phrase
    .split(" ")
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]"))
    .join("[^\\p{L}\\p{N}']+");
  return new RegExp(pattern, "iu").exec(text)?.[0] ?? phrase;
}

function firstPhrase(text: string, phrases: readonly string[]): string | null {
  const counts = countPhrases(text, phrases);
  const found = phrases.find((p) => (counts[p] ?? 0) > 0);
  return found === undefined ? null : asWritten(text, found);
}

/** What one of the user's turns did. Helpful habits first, then weak ones. */
export function checkUserTurn(text: string): TurnCheck[] {
  const checks: TurnCheck[] = [];
  const number = findNumber(text);
  if (number !== null) checks.push({ kind: "number", good: true, label: "Named a number", evidence: number });
  const reason = firstPhrase(text, REASON_PHRASES);
  if (reason !== null) checks.push({ kind: "reason", good: true, label: "Gave a reason", evidence: reason });
  const hedge = firstPhrase(text, HEDGE_PHRASES);
  if (hedge !== null) checks.push({ kind: "hedge", good: false, label: "Hedged", evidence: hedge });
  const apology = firstPhrase(text, APOLOGY_PHRASES);
  if (apology !== null) checks.push({ kind: "apology", good: false, label: "Apologised", evidence: apology });
  const concession = firstPhrase(text, CONCESSION_PHRASES);
  if (concession !== null) {
    checks.push({ kind: "concession", good: false, label: "Gave ground", evidence: concession });
  }
  return checks;
}
