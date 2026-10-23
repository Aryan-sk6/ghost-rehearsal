import { MAX_REPLY_SENTENCES } from "@/contracts/constants";
import { extractJsonObject } from "@/contracts/json";
import { CounterpartReplySchema, type CounterpartReply, type Scenario } from "@/contracts/types";

export type ValidateReplyResult = { ok: true; reply: CounterpartReply } | { ok: false; problem: string };

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function countSentences(text: string): number {
  const segments = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  return segments.filter((s) => /[^\s.!?]/.test(s)).length;
}

export function validateReply(raw: string, scenario: Scenario): ValidateReplyResult {
  const json = extractJsonObject(raw);
  if (json === undefined) {
    return { ok: false, problem: "The output was not a JSON object." };
  }
  const parsed = CounterpartReplySchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return { ok: false, problem: `The JSON did not match the required shape (${issues}).` };
  }
  const reply = parsed.data;
  if (countSentences(reply.reply) > MAX_REPLY_SENTENCES) {
    return { ok: false, problem: `The reply had more than ${MAX_REPLY_SENTENCES} sentences.` };
  }
  const bottomLine = normalise(scenario.hiddenBottomLine);
  if (bottomLine && normalise(reply.reply).includes(bottomLine)) {
    return { ok: false, problem: "The reply revealed the hidden bottom line." };
  }
  return { ok: true, reply };
}
