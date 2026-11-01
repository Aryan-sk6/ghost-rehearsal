import { describe, expect, it } from "vitest";
import { SentenceGate, finishedSentences, partialReply } from "./replyStream";

describe("partialReply", () => {
  it("is null until the reply key appears", () => {
    expect(partialReply('{"mo')).toBeNull();
    expect(partialReply('{"mood": "open", "reply": ')).toBeNull();
  });

  it("reads the string so far, with escapes, and notices when it closes", () => {
    expect(partialReply('{"reply": "Fine. Tell')).toEqual({ text: "Fine. Tell", closed: false });
    expect(partialReply('{"reply":"She said \\"no\\".\\nOK \\u00e9","mood"')).toEqual({
      text: 'She said "no". OK é',
      closed: true,
    });
  });

  it("waits on an escape cut off mid-stream", () => {
    expect(partialReply('{"reply": "Hi \\')).toEqual({ text: "Hi ", closed: false });
    expect(partialReply('{"reply": "Hi \\u00')).toEqual({ text: "Hi ", closed: false });
  });
});

describe("finishedSentences", () => {
  it("holds back the last piece until it is followed by a space or the string closes", () => {
    expect(finishedSentences("Fine. Tell me why", false)).toEqual(["Fine."]);
    expect(finishedSentences("We can do 8.", false)).toEqual([]);
    expect(finishedSentences("We can do 8.5% now. ", false)).toEqual(["We can do 8.5% now."]);
    expect(finishedSentences("Fine. Tell me why", true)).toEqual(["Fine.", "Tell me why"]);
  });
});

describe("SentenceGate", () => {
  const run = (bottomLine: string, raw: string, size = 3) => {
    const said: string[] = [];
    const gate = new SentenceGate(bottomLine, (s) => said.push(s));
    for (let i = 0; i < raw.length; i += size) gate.feed(raw.slice(i, i + size));
    return { said, gate };
  };

  it("hands out each sentence as soon as it is finished", () => {
    const { said, gate } = run("secret", JSON.stringify({ reply: "Fine. Tell me why. Go on.", mood: "open", give: 40 }));
    expect(said).toEqual(["Fine.", "Tell me why.", "Go on."]);
    gate.finish("Fine. Tell me why. Go on.");
    expect(said).toHaveLength(3);
  });

  it("stops before a sentence that gives away the bottom line", () => {
    const { said } = run("I can go up to 8% max", JSON.stringify({ reply: "Hmm. I can go up to 8% max. OK.", mood: "open", give: 40 }));
    expect(said).toEqual(["Hmm."]);
  });

  it("stops after the sentence limit", () => {
    const { said } = run("secret", JSON.stringify({ reply: "A. B. C. D.", mood: "open", give: 40 }));
    expect(said).toEqual(["A.", "B.", "C."]);
  });

  it("says a reply that arrived all at once as one piece", () => {
    const said: string[] = [];
    const gate = new SentenceGate("secret", (s) => said.push(s));
    gate.finish("Fine. Tell me why.");
    expect(said).toEqual(["Fine. Tell me why."]);
  });
});
