import { API_KEY_HEADER, LLM_ERROR_HTTP_STATUS, type LlmRouteResponse } from "@/contracts/api";
import type { LlmErrorKind } from "@/contracts/errors";
import { LlmRequestSchema, MODEL_IDS, type LlmRequest } from "@/contracts/llm";

export interface LlmProxyDeps {
  complete(apiKey: string, model: string, body: LlmRequest): Promise<string>;
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

const CONNECTION_ERROR_NAMES = new Set(["APIConnectionError", "APIConnectionTimeoutError"]);

export function classifyError(error: unknown): LlmErrorKind {
  const status = statusOf(error);
  if (status === 401 || status === 403) return "invalid_key";
  if (status === 429) return "rate_limited";
  if (status === 503 || status === 529) return "overloaded";
  if (status === 400) return "bad_request";
  if (status === undefined && error instanceof Error && CONNECTION_ERROR_NAMES.has(error.name)) {
    return "network";
  }
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

  try {
    const text = await deps.complete(apiKey, MODEL_IDS[parsed.data.purpose], parsed.data);
    const body: LlmRouteResponse = { ok: true, text };
    return Response.json(body, { status: 200 });
  } catch (error) {
    return failure(classifyError(error));
  }
}
