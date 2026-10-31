# llm: verified only against fakes

- Real Anthropic responses: `anthropic.ts` is tested with a mocked SDK; content block shapes are assumed.
- Real error payloads: the proxy maps errors by a numeric `status` on fake error objects; the real SDK's error classes and statuses (including 529) are not exercised.
- Connection errors: detected with `instanceof APIConnectionError` (which covers timeouts) or a raw `fetch failed` TypeError. The SDK leaves `error.name` as `"Error"`, so checking the name never worked. A test runs the real SDK with a `fetch` that fails the way Node's does when it can't connect, and checks the wrapped error maps to `network`. A real network outage and a connection dropped mid-response have not been tried.
- Model ID validity: `MODEL_IDS` values are never sent to the real API.
- Real latency, timeouts and the SDK's single retry (`maxRetries: 1`).
- The Next.js route wiring (`src/app/api/llm/route.ts`) is covered by build only; no request goes through a real server.
- The browser client uses a stubbed `fetchImpl`; real CORS, redirects and non-JSON gateway pages are not exercised.
