# Analysis: behaviour verified only against fakes

- **Real Sonnet output:** `requestAnalysis` is tested with `FakeLlmClient` scripts. The quality of the real model's scores, summary and stronger lines, and how often it returns valid JSON with three distinct user-turn indexes on the first try, are not verified.
- **Prompt effectiveness:** tests check that the prompt contains the scenario, bottom line, indexed transcript and metrics, not that the model follows it.
- **Real timing data:** `computeMetrics` and `replayFrom` run on hand-built transcripts. Timings from real speech recognition and synthesis (turn start and end times, pauses, overlaps) are not covered.
- **Transport errors:** only scripted `LlmError`s are tested, not the HTTP client's real failures.
