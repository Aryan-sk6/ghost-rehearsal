import { describe, expect, it } from "vitest";
import { FakeSpeechOutput } from "@/contracts/fakes";
import { createSpeechQueue } from "./speechQueue";

describe("createSpeechQueue", () => {
  it("speaks pieces one after another and reports the whole span", async () => {
    let clock = 0;
    const output = new FakeSpeechOutput({ autoFinish: false, now: () => (clock += 10) });
    const queue = createSpeechQueue(output, () => 0);
    expect(queue.hasStarted()).toBe(false);
    queue.push("One.");
    queue.push("Two.");
    await Promise.resolve();
    expect(output.spoken).toEqual(["One."]);
    output.finish();
    await new Promise((r) => setTimeout(r, 0));
    expect(output.spoken).toEqual(["One.", "Two."]);
    output.finish();
    await expect(queue.done()).resolves.toEqual({ startedAtMs: 10, endedAtMs: 40, cancelled: false });
  });

  it("drops the rest once a piece is cut short", async () => {
    const output = new FakeSpeechOutput({ autoFinish: false });
    const queue = createSpeechQueue(output, () => 0);
    queue.push("One.");
    queue.push("Two.");
    await Promise.resolve();
    output.cancel();
    const result = await queue.done();
    expect(result.cancelled).toBe(true);
    expect(output.spoken).toEqual(["One."]);
  });

  it("ignores pieces after stop", async () => {
    const output = new FakeSpeechOutput();
    const queue = createSpeechQueue(output, () => 5);
    queue.stop();
    queue.push("Late.");
    await expect(queue.done()).resolves.toEqual({ startedAtMs: 5, endedAtMs: 5, cancelled: true });
    expect(output.spoken).toEqual([]);
  });

  it("works without speech output", async () => {
    const queue = createSpeechQueue(undefined, () => 7);
    queue.push("Silent.");
    await expect(queue.done()).resolves.toEqual({ startedAtMs: 7, endedAtMs: 7, cancelled: false });
  });
});
