import Anthropic from "@anthropic-ai/sdk";
import type { LlmRequest } from "@/contracts/llm";

export async function completeWithAnthropic(
  apiKey: string,
  model: string,
  body: LlmRequest,
): Promise<string> {
  const client = new Anthropic({ apiKey, maxRetries: 1 });
  const message = await client.messages.create({
    model,
    max_tokens: body.maxTokens,
    system: body.system,
    messages: body.messages,
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
  });
  return message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
}

/** Yields the model's text piece by piece as it is written. */
export async function* streamWithAnthropic(
  apiKey: string,
  model: string,
  body: LlmRequest,
): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey, maxRetries: 1 });
  const stream = await client.messages.create({
    model,
    max_tokens: body.maxTokens,
    system: body.system,
    messages: body.messages,
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    stream: true,
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}
