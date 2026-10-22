Project: Ghost Rehearsal — a web app where the user practises a hard
conversation (salary negotiation, refund, saying no, a pitch) against a voice
AI playing the other person, then gets feedback on where they lost ground.
TypeScript, Next.js App Router, Tailwind, Zod, Vitest. No database.

Plan first: architecture and shared contracts before feature code. Contracts:
- LlmClient { complete(req): Promise<string> } + FakeLlmClient (scripted).
- SpeechInput { start(), stop(), onResult(cb) } and SpeechOutput { speak(text),
  cancel() }, with a browser Web Speech implementation, a typed-text fallback,
  and fakes for tests. No test may call a real API or a real microphone.
- Scenario (Zod): id, title, userGoal, counterpartRole, counterpartTraits,
  difficulty 1-5, openingLine, hiddenBottomLine (what they will concede).
- Turn { speaker, text, startedAtMs, endedAtMs }, Session, SessionAnalysis.

Run these workstreams in parallel, each in its own worktree. Each must pass
typecheck, lint, unit tests and `next build` before moving on.

Workstream A — Conversation engine (pure TS, src/lib/conversation):
- State machine: counterpart opens -> user turn -> counterpart reply, repeated
  until the user ends it, a turn cap is hit, or the counterpart's "give" level
  reaches the goal or zero. Illegal transitions throw.
- Each counterpart reply is a Zod-validated object: { reply (max 3 sentences),
  mood, give (0-100) }. Retry once on invalid output. The `give` value moves
  up for clear, specific, calm asks and down for hedging or aggression, and is
  never shown to the user live.
- Difficulty changes traits and how much `give` can move per turn.
- Tests: turn order, caps, retry, give clamped 0-100, hiddenBottomLine never
  appears in a reply.

Workstream B — Speech layer (src/lib/speech):
- Web Speech implementations with continuous and push-to-talk modes, interim
  results, silence timeout, and cancelling playback when the user starts
  talking. Detect unsupported browsers and switch to typed text.
- Tests with the fakes: silence timeout, barge-in cancels speech, fallback.

Workstream C — Analysis and replay (src/lib/analysis):
- Deterministic metrics, fully unit-tested: words per minute, talk ratio,
  filler count (um, like, you know), hedge count ("I think maybe", "sorry
  but"), longest pause, number of times the user conceded first.
- Sonnet-written SessionAnalysis (Zod): scores for clarity, confidence,
  handling pushback, outcome; exactly 3 "lost ground" moments, each with the
  turn index, what the user said, why it hurt, and a stronger line.
  Retry once on invalid output.
- Replay: any turn index can restart the session from that point with the
  transcript truncated and `give` restored to its value at that turn.
- Tests: metrics on fixed transcripts, replay restores state exactly, the 3
  moments refer to real turn indexes.

Workstream D — UI:
- Scenario picker with 5 built-in scenarios plus a custom builder (who they
  are, how they behave, difficulty). Session screen with a big mic button,
  live transcript, an end button. Results screen with scores, metrics, the 3
  moments, and a "retry from here" button per moment.
- API key held in memory for the session, never stored or logged. Clear
  error states for bad keys, rate limits, and mic permission denied.
- Tests: component tests for the states above.

Rules: no secrets in the repo; MIT licence; README with run instructions, the
Chrome note, and a privacy section (audio stays in the browser). Add a plain
disclaimer that it is practice, not therapy or professional advice. Report
anything you could only test against fakes, especially microphone and speech
behaviour.
