import { describe, expect, it } from "vitest";
import { LlmError } from "@/contracts/errors";
import { FakeLlmClient, FakeStreamingLlmClient, chunk } from "@/contracts/fakes";
import type { Scenario } from "@/contracts/types";
import { requestCounterpartReply } from "./counterpart";
import { addOpeningTurn, addUserTurn, createSession } from "./machine";

const scenario: Scenario = {
  id: "s",
  title: "Raise",
  userGoal: "Get a raise",
  counterpartRole: "Manager",
  counterpartTraits: ["busy"],
  difficulty: 5,
  openingLine: "Hello.",
  hiddenBottomLine: "I can go up to 8% max",
};

const t = { startedAtMs: 0, endedAtMs: 1 };
const awaiting = () =>
  addUserTurn(addOpeningTurn(createSession(scenario, { id: "x", nowMs: 0 }), t), "I deserve a raise", t);

const good = JSON.stringify({ reply: "Tell me why.", mood: "guarded", give: 35 });
const tooLong = JSON.stringify({ reply: "A. B. C. D.", mood: "guarded", give: 35 });
const leak = JSON.stringify({ reply: "I can go up to 8% max.", mood: "open", give: 50 });

describe("requestCounterpartReply", () => {
  it("returns a valid reply with one call", async () => {
    const llm = new FakeLlmClient([good]);
    await expect(requestCounterpartReply(awaiting(), llm)).resolves.toEqual({
      reply: "Tell me why.",
      mood: "guarded",
      give: 35,
    });
    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0]).toMatchObject({ purpose: "counterpart", maxTokens: 400, temperature: 0.7 });
  });

  it("retries once on invalid output and names the problem", async () => {
    const llm = new FakeLlmClient(["not json", good]);
    const reply = await requestCounterpartReply(awaiting(), llm);
    expect(reply.reply).toBe("Tell me why.");
    expect(llm.calls).toHaveLength(2);
    const retry = llm.calls[1]?.messages[0]?.content ?? "";
    expect(retry).toContain("Your previous output was invalid:");
    expect(retry).toContain("not a JSON object");
  });

  it("throws invalid_output after two invalid outputs", async () => {
    const llm = new FakeLlmClient([tooLong, "nope", good]);
    await expect(requestCounterpartReply(awaiting(), llm)).rejects.toMatchObject({
      name: "LlmError",
      kind: "invalid_output",
    });
    expect(llm.calls).toHaveLength(2);
  });

  it("retries on a bottom-line leak", async () => {
    const llm = new FakeLlmClient([leak, good]);
    await requestCounterpartReply(awaiting(), llm);
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1]?.messages[0]?.content).toContain("bottom line");
  });

  it("does not retry transport errors", async () => {
    const llm = new FakeLlmClient([new LlmError("rate_limited", "slow down"), good]);
    await expect(requestCounterpartReply(awaiting(), llm)).rejects.toMatchObject({ kind: "rate_limited" });
    expect(llm.calls).toHaveLength(1);
  });

  it("rejects outside awaiting_counterpart", async () => {
    const llm = new FakeLlmClient([good]);
    const s = createSession(scenario, { id: "x", nowMs: 0 });
    await expect(requestCounterpartReply(s, llm)).rejects.toMatchObject({
      name: "IllegalTransitionError",
      from: "counterpart_opening",
      action: "requestCounterpartReply",
    });
    expect(llm.calls).toHaveLength(0);
  });

  it("builds the system prompt and transcript", async () => {
    const llm = new FakeLlmClient([good]);
    await requestCounterpartReply(awaiting(), llm);
    const req = llm.calls[0];
    expect(req?.system).toContain("stubborn");
    expect(req?.system).toContain("rarely concedes");
    expect(req?.system).toContain("busy");
    expect(req?.system).toContain("Get a raise");
    expect(req?.system).toContain("PRIVATE");
    expect(req?.system).toContain("current give is 30");
    expect(req?.system).toContain("at most 8 points");
    expect(req?.system).toContain("at most 3 sentences");
    expect(req?.system).toContain("irritated");
    const msg = req?.messages[0]?.content ?? "";
    expect(msg).toContain("You: Hello.");
    expect(msg).toContain("Them: I deserve a raise");
    expect(req?.messages).toHaveLength(1);
  });

  describe("streaming", () => {
    const streamOf = (text: string) => ({ pieces: chunk(text, 4) });

    it("hands out sentences while the reply is still arriving", async () => {
      const text = JSON.stringify({ reply: "Fine. Tell me why.", mood: "open", give: 40 });
      const llm = new FakeStreamingLlmClient([streamOf(text)]);
      const reply = await requestCounterpartReply(awaiting(), llm, {
        onSpeakable: (s) => llm.log.push(`say:${s}`),
      });
      expect(reply).toEqual({ reply: "Fine. Tell me why.", mood: "open", give: 40 });
      const says = llm.log.filter((e) => e.startsWith("say:"));
      expect(says).toEqual(["say:Fine.", "say:Tell me why."]);
      // The first sentence was said before the last piece arrived.
      expect(llm.log.indexOf("say:Fine.")).toBeLessThan(llm.log.length - 3);
    });

    it("keeps what was already said instead of asking again", async () => {
      const llm = new FakeStreamingLlmClient([streamOf(tooLong)]);
      const said: string[] = [];
      const reply = await requestCounterpartReply(awaiting(), llm, { onSpeakable: (s) => said.push(s) });
      expect(llm.calls).toHaveLength(1);
      expect(said).toEqual(["A.", "B.", "C."]);
      expect(reply).toEqual({ reply: "A. B. C.", mood: "guarded", give: 35 });
    });

    it("never says the bottom line, and keeps mood and give from a broken reply where it can", async () => {
      const text = '{"reply": "Look. I can go up to 8% max.", "mood": "warm", "give": "lots"}';
      const llm = new FakeStreamingLlmClient([streamOf(text)]);
      const said: string[] = [];
      const reply = await requestCounterpartReply(awaiting(), llm, { onSpeakable: (s) => said.push(s) });
      expect(said).toEqual(["Look."]);
      expect(reply).toEqual({ reply: "Look.", mood: "warm", give: 30 });
    });

    it("asks again when nothing was said yet", async () => {
      const llm = new FakeStreamingLlmClient([{ pieces: ["not json"] }, streamOf(good)]);
      const said: string[] = [];
      const reply = await requestCounterpartReply(awaiting(), llm, { onSpeakable: (s) => said.push(s) });
      expect(llm.calls).toHaveLength(2);
      expect(said).toEqual(["Tell me why."]);
      expect(reply.reply).toBe("Tell me why.");
    });

    it("keeps what was said when the connection drops mid-reply", async () => {
      const llm = new FakeStreamingLlmClient([
        { pieces: ['{"reply": "Fine. ', "Tell me"], failAfter: new LlmError("network", "dropped") },
      ]);
      const said: string[] = [];
      const reply = await requestCounterpartReply(awaiting(), llm, { onSpeakable: (s) => said.push(s) });
      expect(reply).toEqual({ reply: "Fine.", mood: "neutral", give: 30 });
    });

    it("passes on a dropped connection when nothing was said", async () => {
      const llm = new FakeStreamingLlmClient([{ pieces: ['{"mo'], failAfter: new LlmError("network", "dropped") }]);
      await expect(requestCounterpartReply(awaiting(), llm, { onSpeakable: () => undefined })).rejects.toMatchObject({
        kind: "network",
      });
    });
  });
});
