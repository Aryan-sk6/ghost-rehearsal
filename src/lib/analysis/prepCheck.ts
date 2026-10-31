import type { Turn } from "@/contracts/types";

/** What the user planned before the conversation. Both fields are optional. */
export interface PrepPlan {
  ask: string;
  walkAway: string;
}

export type AmountUnit = "percent" | "amount";

/** A figure found in text, e.g. "10%" or "$95,000". */
export interface Amount {
  value: number;
  unit: AmountUnit;
  /** As written, for showing back to the user. */
  raw: string;
}

export type PrepTone = "good" | "warn" | "neutral";

export interface PrepFinding {
  tone: PrepTone;
  text: string;
}

const WORD_VALUES: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6 };

const DIGIT_PATTERN = /([$£€])?\s?(\d[\d,]*(?:\.\d+)?)\s?(%|percent\b|per cent\b|k\b|m\b|thousand\b|million\b)?/gi;
// Spelled-out numbers only count with a unit after them: "ten percent", "fifty thousand".
const WORD_PATTERN = new RegExp(
  `\\b(${Object.keys(WORD_VALUES).join("|")})\\s(percent|per cent|thousand|million)\\b`,
  "gi",
);

function toAmount(raw: string, number: number, suffix: string | undefined): Amount {
  const unitWord = suffix?.toLowerCase();
  if (unitWord === "%" || unitWord === "percent" || unitWord === "per cent") {
    return { value: number, unit: "percent", raw };
  }
  return { value: number * (unitWord !== undefined ? (SCALE[unitWord] ?? 1) : 1), unit: "amount", raw };
}

/** Every figure in `text`, in the order written. */
export function findAmounts(text: string): Amount[] {
  const found: { at: number; amount: Amount }[] = [];
  for (const m of text.matchAll(DIGIT_PATTERN)) {
    const number = Number((m[2] ?? "").replace(/,/g, ""));
    if (!Number.isFinite(number)) continue;
    found.push({ at: m.index, amount: toAmount(m[0].trim().replace(/[,.]$/, ""), number, m[3]) });
  }
  for (const m of text.matchAll(WORD_PATTERN)) {
    const number = WORD_VALUES[(m[1] ?? "").toLowerCase()];
    if (number === undefined) continue;
    found.push({ at: m.index, amount: toAmount(m[0], number, m[2]) });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.amount);
}

/** Same kind of figure and roughly the same size, so "3 months" is not read as a $95,000 offer. */
function comparable(said: Amount, target: Amount): boolean {
  if (said.unit !== target.unit) return false;
  if (target.value === 0) return said.value === 0;
  const ratio = said.value / target.value;
  return ratio >= 0.1 && ratio <= 10;
}

interface Said {
  amount: Amount;
  /** 1-based count of the user's turns. */
  turnNumber: number;
}

function saidAmounts(turns: readonly Turn[], target: Amount): Said[] {
  const said: Said[] = [];
  let turnNumber = 0;
  for (const turn of turns) {
    if (turn.speaker !== "user") continue;
    turnNumber += 1;
    for (const amount of findAmounts(turn.text)) {
      if (comparable(amount, target)) said.push({ amount, turnNumber });
    }
  }
  return said;
}

function sameValue(a: Amount, b: Amount): boolean {
  return Math.abs(a.value - b.value) < 1e-9;
}

/** True if you want the figure high (a raise), false if low (rent), null if unknown. */
function wantsHigh(ask: Amount | null, walkAway: Amount | null, firstSaid: Amount | null): boolean | null {
  const reference = ask ?? firstSaid;
  if (reference === null || walkAway === null || reference.unit !== walkAway.unit) return null;
  if (sameValue(reference, walkAway)) return null;
  return reference.value > walkAway.value;
}

function openingFinding(ask: Amount, said: Said[], high: boolean | null): PrepFinding {
  const first = said[0];
  if (first === undefined) {
    return { tone: "warn", text: `You planned to ask for ${ask.raw} but never named it.` };
  }
  if (sameValue(first.amount, ask)) {
    if (first.turnNumber === 1) return { tone: "good", text: `You opened with ${first.amount.raw}, as planned.` };
    return {
      tone: "warn",
      text: `You asked for ${first.amount.raw} as planned, but not until your turn ${first.turnNumber}.`,
    };
  }
  const lower = first.amount.value < ask.value;
  const weaker = high === null ? null : lower === high;
  const where = first.turnNumber === 1 ? "opened with" : `first asked for (turn ${first.turnNumber})`;
  if (weaker === true) {
    return { tone: "warn", text: `You planned ${ask.raw} but ${where} ${first.amount.raw}, a weaker ask than planned.` };
  }
  if (weaker === false) {
    return { tone: "good", text: `You planned ${ask.raw} but ${where} ${first.amount.raw}, a stronger ask than planned.` };
  }
  return { tone: "neutral", text: `You planned ${ask.raw} but ${where} ${first.amount.raw}.` };
}

function walkAwayFinding(walkAway: Amount, said: Said[], high: boolean | null): PrepFinding | null {
  if (high === null) {
    return said.length === 0
      ? null
      : { tone: "neutral", text: `Your walk-away was ${walkAway.raw}. Add a target to check you stayed on the right side of it.` };
  }
  const crossed = said.find((s) => (high ? s.amount.value < walkAway.value : s.amount.value > walkAway.value));
  if (crossed !== undefined) {
    return {
      tone: "warn",
      text: `In your turn ${crossed.turnNumber} you offered ${crossed.amount.raw}, past the ${walkAway.raw} you said you'd walk away at.`,
    };
  }
  if (said.length === 0) return null;
  return { tone: "good", text: `You never went past your walk-away of ${walkAway.raw}.` };
}

/** Compares the plan with what the user said, using number matching only (no model call). */
export function checkPrep(plan: PrepPlan, turns: readonly Turn[]): PrepFinding[] {
  const askText = plan.ask.trim();
  const walkText = plan.walkAway.trim();
  if (askText === "" && walkText === "") return [];

  const ask = findAmounts(askText)[0] ?? null;
  const walkAway = findAmounts(walkText)[0] ?? null;
  const findings: PrepFinding[] = [];

  const askSaid = ask === null ? [] : saidAmounts(turns, ask);
  const walkSaid = walkAway === null ? [] : saidAmounts(turns, walkAway);
  const high = wantsHigh(ask, walkAway, walkSaid[0]?.amount ?? null);

  if (ask !== null) findings.push(openingFinding(ask, askSaid, high));
  if (walkAway !== null) {
    const finding = walkAwayFinding(walkAway, walkSaid, high);
    if (finding !== null) findings.push(finding);
  }
  if (ask === null || walkAway === null) {
    findings.push({
      tone: "neutral",
      text: "Put a number in both boxes next time and this will check your opening ask and your walk-away against what you said.",
    });
  }
  return findings;
}

/** True when the user wrote anything in the plan. */
export function hasPlan(plan: PrepPlan | null): plan is PrepPlan {
  return plan !== null && (plan.ask.trim() !== "" || plan.walkAway.trim() !== "");
}
