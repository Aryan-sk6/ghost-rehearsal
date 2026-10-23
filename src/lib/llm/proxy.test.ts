import { afterEach, describe, expect, it, vi } from "vitest";
import { API_KEY_HEADER, LLM_ERROR_HTTP_STATUS, LlmRouteResponseSchema } from "@/contracts/api";
import type { LlmErrorKind } from "@/contracts/errors";
import { MODEL_IDS, type LlmRequest } from "@/contracts/llm";
import { handleLlmProxy } from "./proxy";

const KEY = "sk-ant-test-secret-123";
const body: LlmRequest = {
  purpose: "counterpart",
  system: "sys",
  messages: [{ role: "user", content: "hi" }],
  maxTokens: 10,
};

const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
  vi.spyOn(console, m).mockImplementation(() => undefined),
);
afterEach(() => {
  for (const s of spies) s.mockClear();
});

function request(opts: { key?: string | null; body?: unknown } = {}): Request {
  const headers = new Headers({ "content-type": "application/json" });
  const key = opts.key === undefined ? KEY : opts.key;
  if (key !== null) headers.set(API_KEY_HEADER, key);
  const payload = opts.body === undefined ? body : opts.body;
  return new Request("http://localhost/api/llm", {
    method: "POST",
    headers,
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

async function run(req: Request, complete: (k: string, m: string, b: LlmRequest) => Promise<string>) {
  const res = await handleLlmProxy(req, { complete });
  const text = await res.text();
  expect(text).not.toContain(KEY);
  for (const s of spies) expect(JSON.stringify(s.mock.calls)).not.toContain(KEY);
  return { status: res.status, parsed: LlmRouteResponseSchema.parse(JSON.parse(text)) };
}

const never = async (): Promise<string> => {
  throw new Error("complete should not be called");
};

class StatusError extends Error {
  readonly status: number | undefined;
  constructor(status: number | undefined, name = "Error") {
    super(`upstream failed for ${KEY}`);
    this.name = name;
    this.status = status;
  }
}

describe("handleLlmProxy", () => {
  it("returns text and passes the key, model and body", async () => {
    const complete = vi.fn(async () => "hi there");
    const { status, parsed } = await run(request(), complete);
    expect(status).toBe(200);
    expect(parsed).toEqual({ ok: true, text: "hi there" });
    expect(complete).toHaveBeenCalledWith(KEY, MODEL_IDS.counterpart, body);
  });

  it("maps the analysis purpose to its model", async () => {
    let model: string | undefined;
    await run(request({ body: { ...body, purpose: "analysis" } }), async (_key, m) => {
      model = m;
      return "x";
    });
    expect(model).toBe(MODEL_IDS.analysis);
  });

  it.each([null, "", "   "])("returns missing_key for %j", async (key) => {
    const { status, parsed } = await run(request({ key }), never);
    expect(status).toBe(401);
    expect(parsed).toMatchObject({ ok: false, error: { kind: "missing_key" } });
  });

  it.each([
    ["not json", "{nope"],
    ["wrong shape", { purpose: "x" }],
    ["too many tokens", { ...body, maxTokens: 99999 }],
  ])("returns bad_request for %s", async (_name, payload) => {
    const { status, parsed } = await run(request({ body: payload }), never);
    expect(status).toBe(400);
    expect(parsed).toMatchObject({ ok: false, error: { kind: "bad_request" } });
  });

  const cases: [string, unknown, LlmErrorKind][] = [
    ["401", new StatusError(401), "invalid_key"],
    ["403", new StatusError(403), "invalid_key"],
    ["429", new StatusError(429), "rate_limited"],
    ["503", new StatusError(503), "overloaded"],
    ["529", new StatusError(529), "overloaded"],
    ["400", new StatusError(400), "bad_request"],
    ["500", new StatusError(500), "unknown"],
    ["connection error", new StatusError(undefined, "APIConnectionError"), "network"],
    ["connection timeout", new StatusError(undefined, "APIConnectionTimeoutError"), "network"],
    ["plain error", new Error("boom"), "unknown"],
    ["non-error throw", "boom", "unknown"],
  ];
  it.each(cases)("maps %s to %s", async (_name, thrown, kind) => {
    const { status, parsed } = await run(request(), async () => {
      throw thrown;
    });
    expect(status).toBe(LLM_ERROR_HTTP_STATUS[kind]);
    expect(parsed).toMatchObject({ ok: false, error: { kind } });
  });
});
