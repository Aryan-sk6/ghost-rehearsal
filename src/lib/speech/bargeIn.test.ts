import { describe, expect, it } from "vitest";
import { FakeSpeechInput, FakeSpeechOutput } from "@/contracts/fakes";
import { linkBargeIn } from "./bargeIn";

describe("linkBargeIn", () => {
  it("cancels output when the user starts speaking during playback", async () => {
    const input = new FakeSpeechInput("continuous");
    const output = new FakeSpeechOutput({ autoFinish: false });
    linkBargeIn(input, output);
    const spoken = output.speak("Let me explain our position.");
    expect(output.isSpeaking()).toBe(true);
    input.emitSpeechStart();
    expect(output.cancelCalls).toBe(1);
    expect(output.isSpeaking()).toBe(false);
    expect((await spoken).cancelled).toBe(true);
  });

  it("does not cancel when nothing is playing", () => {
    const input = new FakeSpeechInput("continuous");
    const output = new FakeSpeechOutput({ autoFinish: false });
    linkBargeIn(input, output);
    input.emitSpeechStart();
    expect(output.cancelCalls).toBe(0);
  });

  it("does not cancel after playback finished", async () => {
    const input = new FakeSpeechInput("continuous");
    const output = new FakeSpeechOutput({ autoFinish: false });
    linkBargeIn(input, output);
    const spoken = output.speak("Done.");
    output.finish();
    await spoken;
    input.emitSpeechStart();
    expect(output.cancelCalls).toBe(0);
  });

  it("stops cancelling after unsubscribe", () => {
    const input = new FakeSpeechInput("continuous");
    const output = new FakeSpeechOutput({ autoFinish: false });
    const unsubscribe = linkBargeIn(input, output);
    void output.speak("Hello.");
    unsubscribe();
    input.emitSpeechStart();
    expect(output.cancelCalls).toBe(0);
    expect(output.isSpeaking()).toBe(true);
  });
});
