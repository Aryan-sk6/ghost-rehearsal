import { APIConnectionError } from "@anthropic-ai/sdk";
import {
  API_KEY_HEADER,
  LLM_ERROR_HTTP_STATUS,
  LLM_STREAM_CONTENT_TYPE,
  type LlmRouteResponse,
  type LlmStreamEvent,
} from "@/contracts/api";
import type { LlmErrorKind } from "@/contracts/errors";
import { LlmRequestSchema, MODEL_IDS, type LlmRequest } from "@/contracts/llm";

export interface LlmProxyDeps {
  complete(apiKey: string, model: string, body: LlmRequest): Promise<string>;
  /** Text pieces as they are written. Without it, streamed requests get one normal reply. */
  stream?(apiKey: string, model: string, body: LlmRequest): AsyncIterable<string>;
}

const MESSAGES: Record<LlmErrorKind, string> = {
  missing_key: "No API key was provided.",
  invalid_key: "The API key was rejected.",
  rate_limited: "The model is rate limited right now.",
  overloaded: "The model is overloaded right now.",
  bad_request: "The request was not accepted.",
  network: "Could not reach the model.",
  invalid_output: "The model returned unusable output.",
  unknown: "Something went wrong talking to the model.",
};

function failure(kind: LlmErrorKind): Response {
  const body: LlmRouteResponse = { ok: false, error: { kind, message: MESSAGES[kind] } };
  return Response.json(body, { status: LLM_ERROR_HTTP_STATUS[kind] });
}

function statusOf(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

/** The SDK's connection and timeout errors, or a raw `fetch` network failure. */
function isConnectionError(error: unknown): boolean {
  if (error instanceof APIConnectionError) return true;
  return error instanceof TypeError && error.message === "fetch failed";
}

export function classifyError(error: unknown): LlmErrorKind {
  const status = statusOf(error);
  if (status === 401 || status === 403) return "invalid_key";
  if (status === 429) return "rate_limited";
  if (status === 503 || status === 529) return "overloaded";
  if (status === 400) return "bad_request";
  if (status === undefined && isConnectionError(error)) return "network";
  return "unknown";
}

export async function handleLlmProxy(req: Request, deps: LlmProxyDeps): Promise<Response> {
  const apiKey = req.headers.get(API_KEY_HEADER)?.trim();
  if (!apiKey) return failure("missing_key");

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return failure("bad_request");
  }
  const parsed = LlmRequestSchema.safeParse(json);
  if (!parsed.success) return failure("bad_request");

  if (parsed.data.stream === true && deps.stream !== undefined) {
    return streamed(deps.stream(apiKey, MODEL_IDS[parsed.data.purpose], parsed.data));
  }

  try {
    const text = await deps.complete(apiKey, MODEL_IDS[parsed.data.purpose], parsed.data);
    const body: LlmRouteResponse = { ok: true, text };
    return Response.json(body, { status: 200 });
  } catch (error) {
    return failure(classifyError(error));
  }
}

function line(event: LlmStreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

/**
 * Waits for the first piece of text, so a rejected key or a rate limit still
 * gets its usual status and JSON body. After that, text goes out line by line.
 */
async function streamed(source: AsyncIterable<string>): Promise<Response> {
  const iterator = source[Symbol.asyncIterator]();
  let first: IteratorResult<string>;
  try {
    first = await iterator.next();
  } catch (error) {
    return failure(classifyError(error));
  }
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let current = first;
        while (current.done !== true) {
          if (current.value !== "") controller.enqueue(line({ type: "text", text: current.value }));
          current = await iterator.next();
        }
        controller.enqueue(line({ type: "done" }));
      } catch (error) {
        const kind = classifyError(error);
        controller.enqueue(line({ type: "error", error: { kind, message: MESSAGES[kind] } }));
      }
      controller.close();
    },
    async cancel() {
      await iterator.return?.();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": LLM_STREAM_CONTENT_TYPE, "cache-control": "no-store" },
  });
}
