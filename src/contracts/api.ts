import { z } from "zod";
import { LLM_ERROR_KINDS, type LlmErrorKind } from "./errors";
import type { LlmRequest } from "./llm";

/** POST only. Body: LlmRequest (validated with LlmRequestSchema). */
export const LLM_ROUTE_PATH = "/api/llm";

/** Request header carrying the user's Anthropic key. Never logged or stored. */
export const API_KEY_HEADER = "x-anthropic-key";

export type LlmRouteRequestBody = LlmRequest;

export const LlmRouteSuccessSchema = z.object({
  ok: z.literal(true),
  text: z.string(),
});
export type LlmRouteSuccess = z.infer<typeof LlmRouteSuccessSchema>;

export const LlmRouteFailureSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    kind: z.enum(LLM_ERROR_KINDS),
    message: z.string(),
  }),
});
export type LlmRouteFailure = z.infer<typeof LlmRouteFailureSchema>;

export const LlmRouteResponseSchema = z.discriminatedUnion("ok", [
  LlmRouteSuccessSchema,
  LlmRouteFailureSchema,
]);
export type LlmRouteResponse = z.infer<typeof LlmRouteResponseSchema>;

/** HTTP status the route returns for each failure kind. Success is 200. */
export const LLM_ERROR_HTTP_STATUS: Readonly<Record<LlmErrorKind, number>> = {
  missing_key: 401,
  invalid_key: 401,
  rate_limited: 429,
  overloaded: 503,
  bad_request: 400,
  network: 502,
  invalid_output: 502,
  unknown: 500,
};
