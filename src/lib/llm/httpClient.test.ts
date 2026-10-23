import { afterEach, describe, expect, it, vi } from "vitest";
import { API_KEY_HEADER, LLM_ROUTE_PATH } from "@/contracts/api";
import { LLM_ERROR_KINDS, LlmError } from "@/contracts/errors";
import type { LlmRequest } from "@/contracts/llm";
import { createHttpLlmClient } from "./httpClient";

const KEY = "sk-ant-test-secret-123";
const req: LlmRequest = {
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

function expectNoKeyLogged() {
  for (const s of spies) expect(JSON.stringify(s.mock.calls)).not.toContain(KEY);
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function failureOf(fetchImpl: typeof fetch): Promise<LlmError> {
  const client = createHttpLlmClient({ apiKey: KEY, fetchImpl });
  try {
    await client.complete(req);
  } catch (e) {
    expect(e).toBeInstanceOf(LlmError);
    return e as LlmError;
  }
  throw new Error("expected failure");
}

describe("createHttpLlmClient", () => {
  it("posts JSON with the key header and returns text", async () => {
    let url: unknown;
    let init: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, options) => {
      url = input;
      init = options;
      return json({ ok: true, text: "hello" });
    };
    const client = createHttpLlmClient({ apiKey: KEY, fetchImpl });
    await expect(client.complete(req)).resolves.toBe("hello");
    if (!init) throw new Error("fetch not called");
    expect(url).toBe(LLM_ROUTE_PATH);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)[API_KEY_HEADER]).toBe(KEY);
    expect(JSON.parse(init.body as string)).toEqual(req);
    expect(init.body as string).not.toContain(KEY);
    expectNoKeyLogged();
  });

  it("uses a custom endpoint", async () => {
    let url: unknown;
    const fetchImpl: typeof fetch = async (input) => {
      url = input;
      return json({ ok: true, text: "x" });
    };
    await createHttpLlmClient({ apiKey: KEY, endpoint: "/other", fetchImpl }).complete(req);
    expect(url).toBe("/other");
  });

  it.each(LLM_ERROR_KINDS)("throws LlmError(%s) from a failure body", async (kind) => {
    const err = await failureOf(async () => json({ ok: false, error: { kind, message: "nope" } }, 500));
    expect(err.kind).toBe(kind);
    expect(err.message).toBe("nope");
    expect(err.message).not.toContain(KEY);
    expectNoKeyLogged();
  });

  it("throws network when fetch rejects", async () => {
    const err = await failureOf(async () => {
      throw new TypeError(`failed with ${KEY}`);
    });
    expect(err.kind).toBe("network");
    expect(err.message).not.toContain(KEY);
    expectNoKeyLogged();
  });

  it("throws unknown on an unparseable body", async () => {
    const err = await failureOf(async () => new Response("<html>bad gateway</html>", { status: 502 }));
    expect(err.kind).toBe("unknown");
  });

  it("throws unknown on a body that fails the schema", async () => {
    const err = await failureOf(async () => json({ ok: "maybe" }));
    expect(err.kind).toBe("unknown");
  });
});
