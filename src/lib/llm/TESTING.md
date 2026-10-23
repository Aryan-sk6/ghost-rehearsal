# llm: verified only against fakes

- Real Anthropic responses: `anthropic.ts` is tested with a mocked SDK; content block shapes are assumed.
- Real error payloads: the proxy maps errors by a numeric `status` on fake error objects; the real SDK's error classes and statuses (including 529) are not exercised.
- Connection errors: detected by the SDK error name (`APIConnectionError`, `APIConnectionTimeoutError`); not tried against a real network failure.
- Model ID validity: `MODEL_IDS` values are never sent to the real API.
- Real latency, timeouts and the SDK's single retry (`maxRetries: 1`).
- The Next.js route wiring (`src/app/api/llm/route.ts`) is covered by build only; no request goes through a real server.
- The browser client uses a stubbed `fetchImpl`; real CORS, redirects and non-JSON gateway pages are not exercised.
