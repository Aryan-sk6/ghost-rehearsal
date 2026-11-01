import { MAX_REPLY_SENTENCES } from "@/contracts/constants";

/**
 * The "reply" string so far, from JSON that is still being written.
 * Returns null until the key appears. `closed` is true once its closing quote arrives.
 */
export function partialReply(raw: string): { text: string; closed: boolean } | null {
  const key = /"reply"\s*:\s*"/.exec(raw);
  if (key === null) return null;
  let text = "";
  for (let i = key.index + key[0].length; i < raw.length; i += 1) {
    const ch = raw[i] as string;
    if (ch === '"') return { text, closed: true };
    if (ch !== "\\") {
      text += ch;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) break; // Escape cut off mid-stream; wait for more.
    if (next === "u") {
      const hex = raw.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      text += String.fromCharCode(Number.parseInt(hex, 16));
      i += 5;
      continue;
    }
    const escapes: Record<string, string> = { n: " ", t: " ", r: "", b: "", f: "", "/": "/", "\\": "\\", '"': '"' };
    text += escapes[next] ?? next;
    i += 1;
  }
  return { text, closed: false };
}

/**
 * Sentences that are known to be finished. The last piece only counts once the
 * string is closed, since "8." may still become "8.5%".
 */
export function finishedSentences(text: string, closed: boolean): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
  if (closed) return parts;
  // Without trailing space the last part may still grow.
  return /[.!?]\s+$/.test(text) ? parts : parts.slice(0, -1);
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Hands out sentences of a reply as soon as they are safe to say aloud:
 * finished, within the sentence limit, and not giving away the bottom line.
 * Once one fails, nothing more is handed out for this attempt.
 */
export class SentenceGate {
  readonly spoken: string[] = [];
  private raw = "";
  private stopped = false;
  private readonly bottomLine: string;

  constructor(
    hiddenBottomLine: string,
    private readonly onSpeakable: (text: string) => void,
  ) {
    this.bottomLine = normalise(hiddenBottomLine);
  }

  /** Everything fed in so far. */
  get received(): string {
    return this.raw;
  }

  /** Feed raw model output as it streams in. */
  feed(piece: string): void {
    this.raw += piece;
    const partial = partialReply(this.raw);
    if (partial === null) return;
    for (const sentence of finishedSentences(partial.text, partial.closed).slice(this.spoken.length)) {
      if (!this.offer(sentence)) return;
    }
  }

  /**
   * After the reply is validated: say whatever wasn't said yet, in one go, so a
   * reply that arrived all at once is spoken as one utterance.
   */
  finish(reply: string): void {
    const rest = finishedSentences(reply, true).slice(this.spoken.length);
    if (rest.length === 0 || this.stopped) return;
    this.spoken.push(...rest);
    this.onSpeakable(rest.join(" "));
  }

  private offer(sentence: string): boolean {
    if (this.stopped) return false;
    const said = normalise([...this.spoken, sentence].join(" "));
    if (this.spoken.length >= MAX_REPLY_SENTENCES || (this.bottomLine !== "" && said.includes(this.bottomLine))) {
      this.stopped = true;
      return false;
    }
    this.spoken.push(sentence);
    this.onSpeakable(sentence);
    return true;
  }
}
