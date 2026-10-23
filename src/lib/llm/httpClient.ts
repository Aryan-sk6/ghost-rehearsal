import { API_KEY_HEADER, LLM_ROUTE_PATH, LlmRouteResponseSchema } from "@/contracts/api";
import { LlmError } from "@/contracts/errors";
import type { CreateHttpLlmClient } from "@/contracts/modules";

export const createHttpLlmClient: CreateHttpLlmClient = ({ apiKey, endpoint, fetchImpl }) => ({
  async complete(req) {
    const doFetch = fetchImpl ?? fetch;
    let response: Response;
    try {
      response = await doFetch(endpoint ?? LLM_ROUTE_PATH, {
        method: "POST",
        headers: { "content-type": "application/json", [API_KEY_HEADER]: apiKey },
        body: JSON.stringify(req),
      });
    } catch {
      throw new LlmError("network", "Could not reach the server.");
    }

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
  },
});
