import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
const ctor = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
    constructor(opts: unknown) {
      ctor(opts);
    }
  },
}));

import { completeWithAnthropic } from "./anthropic";

const req = {
  purpose: "counterpart" as const,
  system: "sys",
  messages: [{ role: "user" as const, content: "hi" }],
  maxTokens: 50,
  temperature: 0.5,
};

beforeEach(() => {
  create.mockReset();
  ctor.mockReset();
});

describe("completeWithAnthropic", () => {
  it("calls the SDK and joins text blocks", async () => {
    create.mockResolvedValue({
      content: [
        { type: "text", text: "a" },
        { type: "tool_use" },
        { type: "text", text: "b" },
      ],
    });
    await expect(completeWithAnthropic("k", "model-x", req)).resolves.toBe("ab");
    expect(ctor).toHaveBeenCalledWith({ apiKey: "k", maxRetries: 1 });
    expect(create).toHaveBeenCalledWith({
      model: "model-x",
      max_tokens: 50,
      system: "sys",
      messages: req.messages,
      temperature: 0.5,
    });
  });

  it("omits temperature when unset", async () => {
    create.mockResolvedValue({ content: [] });
    const { temperature, ...rest } = req;
    void temperature;
    await completeWithAnthropic("k", "m", rest);
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("temperature");
  });
});
