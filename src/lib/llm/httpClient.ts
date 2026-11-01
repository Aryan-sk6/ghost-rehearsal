import {
  API_KEY_HEADER,
  LLM_ROUTE_PATH,
  LLM_STREAM_CONTENT_TYPE,
  LlmRouteResponseSchema,
  LlmStreamEventSchema,
} from "@/contracts/api";
import { LlmError } from "@/contracts/errors";
import type { LlmRequest } from "@/contracts/llm";
import type { CreateHttpLlmClient } from "@/contracts/modules";

/** Reads a normal JSON reply from the route. */
async function readJson(response: Response): Promise<string> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new LlmError("unknown", "The server sent an unreadable response.");
  }
  const parsed = LlmRouteResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new LlmError("unknown", "The server sent an unexpected response.");
  }
  if (!parsed.data.ok) {
    throw new LlmError(parsed.data.error.kind, parsed.data.error.message);
  }
  return parsed.data.text;
}

/** Reads newline-delimited stream events, passing text on as it arrives. */
async function readStream(body: ReadableStream<Uint8Array>, onText: (text: string) => void): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let text = "";
  let done = false;

  const handle = (raw: string): void => {
    if (raw.trim() === "") return;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new LlmError("unknown", "The server sent an unreadable response.");
    }
    const event = LlmStreamEventSchema.safeParse(json);
    if (!event.success) throw new LlmError("unknown", "The server sent an unexpected response.");
    if (event.data.type === "error") throw new LlmError(event.data.error.kind, event.data.error.message);
    if (event.data.type === "done") {
      done = true;
      return;
    }
    text += event.data.text;
    onText(event.data.text);
  };

  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch {
      throw new LlmError("network", "The connection dropped mid-reply.");
    }
    if (chunk.done) break;
    buffered += decoder.decode(chunk.value, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const raw of lines) handle(raw);
  }
  handle(buffered + decoder.decode());
  if (!done) throw new LlmError("network", "The connection dropped mid-reply.");
  return text;
}

export const createHttpLlmClient: CreateHttpLlmClient = ({ apiKey, endpoint, fetchImpl }) => {
  const post = async (req: LlmRequest): Promise<Response> => {
    const doFetch = fetchImpl ?? fetch;
    try {
      return await doFetch(endpoint ?? LLM_ROUTE_PATH, {
        method: "POST",
        headers: { "content-type": "application/json", [API_KEY_HEADER]: apiKey },
        body: JSON.stringify(req),
      });
    } catch {
      throw new LlmError("network", "Could not reach the server.");
    }
  };

  return {
    async complete(req) {
      return readJson(await post(req));
    },
    async stream(req, onText) {
      const response = await post({ ...req, stream: true });
      const type = response.headers.get("content-type") ?? "";
      // Failures before any text, and servers that don't stream, answer with plain JSON.
      if (!type.includes(LLM_STREAM_CONTENT_TYPE) || response.body === null) {
        const text = await readJson(response);
        onText(text);
        return text;
      }
      return readStream(response.body, onText);
    },
  };
};
