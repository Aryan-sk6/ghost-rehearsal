import Anthropic, { APIConnectionError, APIConnectionTimeoutError } from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_KEY_HEADER, LLM_ERROR_HTTP_STATUS, LlmRouteResponseSchema } from "@/contracts/api";
import type { LlmErrorKind } from "@/contracts/errors";
import { MODEL_IDS, type LlmRequest } from "@/contracts/llm";
import { classifyError, handleLlmProxy } from "./proxy";

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
    ["SDK connection error", new APIConnectionError({ message: "down" }), "network"],
    ["SDK connection timeout", new APIConnectionTimeoutError(), "network"],
    ["fetch failure", new TypeError("fetch failed"), "network"],
    ["other TypeError", new TypeError("x is not a function"), "unknown"],
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

describe("classifyError with the real SDK", () => {
  it("maps a failed connection to network", async () => {
    // Node's fetch throws this TypeError when it cannot connect. The SDK
    // wraps it itself, so this checks the error the proxy really receives.
    const client = new Anthropic({
      apiKey: "sk-ant-test",
      maxRetries: 0,
      dangerouslyAllowBrowser: true, // tests run in jsdom
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });
    const error = await client.messages
      .create({ model: "x", max_tokens: 1, messages: [{ role: "user", content: "hi" }] })
      .then(
        () => undefined,
        (e: unknown) => e,
      );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe("Error");
    expect(classifyError(error)).toBe("network");
  });

  describe("streaming", () => {
    const streamReq = () => request({ body: { ...body, stream: true } });
    async function* pieces(parts: readonly string[], fail?: unknown) {
      for (const p of parts) yield p;
      if (fail !== undefined) throw fail;
    }
    const lines = async (res: Response) => {
      const text = await res.text();
      expect(text).not.toContain(KEY);
      for (const s of spies) expect(JSON.stringify(s.mock.calls)).not.toContain(KEY);
      return text.trim().split("\n").map((l) => JSON.parse(l) as unknown);
    };

    it("sends text line by line, then done", async () => {
      const stream = vi.fn(() => pieces(["Hel", "lo"]));
      const res = await handleLlmProxy(streamReq(), { complete: never, stream });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/x-ndjson");
      expect(await lines(res)).toEqual([
        { type: "text", text: "Hel" },
        { type: "text", text: "lo" },
        { type: "done" },
      ]);
      expect(stream).toHaveBeenCalledWith(KEY, MODEL_IDS.counterpart, { ...body, stream: true });
    });

    it("keeps the usual status and JSON body for a failure before any text", async () => {
      const res = await handleLlmProxy(streamReq(), {
        complete: never,
        stream: () => pieces([], new StatusError(401)),
      });
      expect(res.status).toBe(401);
      const text = await res.text();
      expect(text).not.toContain(KEY);
      expect(LlmRouteResponseSchema.parse(JSON.parse(text))).toMatchObject({ ok: false, error: { kind: "invalid_key" } });
    });

    it("ends with an error line when the model fails mid-reply", async () => {
      const res = await handleLlmProxy(streamReq(), {
        complete: never,
        stream: () => pieces(["Hi"], new StatusError(529)),
      });
      expect(await lines(res)).toEqual([
        { type: "text", text: "Hi" },
        { type: "error", error: { kind: "overloaded", message: "The model is overloaded right now." } },
      ]);
    });

    it("answers normally when streaming isn't available", async () => {
      const { parsed } = await run(streamReq(), async () => "whole");
      expect(parsed).toEqual({ ok: true, text: "whole" });
    });
  });
});
