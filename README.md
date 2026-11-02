# Ghost Rehearsal

Ghost Rehearsal lets you practise a hard conversation out loud against a voice AI before you have it for real. Pick one of five built-in scenarios (asking for a raise, returning a faulty product, saying no to extra work, pitching for seed funding, negotiating a rent renewal) or build your own. Before you start, you can spend 30 seconds noting what you'll ask for and the least you'd accept. The AI plays the other person and has a hidden bottom line you have to find. If you talk for 40 seconds without a break, they cut in, the way an impatient person would. Afterwards you get scores, how their willingness and mood moved turn by turn, a check of your plan against what you said, a comparison with your last attempt, speaking metrics (pace, talk ratio, filler words, hedges, pauses) and the three moments where you lost the most ground, each with a stronger line to try and a "Retry from here" button.

> Ghost Rehearsal is practice, not therapy or professional advice.

## Requirements

- Node.js 20.9 or newer, with npm.
- An Anthropic API key (it starts with `sk-ant-`). You paste it into the app when it starts. There are no environment variables to set and no `.env` file.

## Run

```sh
npm install
npm run dev
```

Then open <http://localhost:3000>.

## Checks

```sh
npm run typecheck   # tsc --noEmit
npm run lint        # eslint . --max-warnings=0
npm test            # vitest run
npm run build       # next build
```

## How it fits together

- The app is a single page (Next.js App Router, no database).
- Your browser sends the conversation text to `POST /api/llm`, a dynamic route in this app. The route forwards it to Anthropic with the key from the request and returns the reply text. It keeps no state.
- The other person's replies are streamed, so they start speaking as soon as their first sentence is ready. A sentence is only spoken once it is finished, within the three-sentence limit and clear of the hidden bottom line.
- Per-turn feedback, pause markers, the plan check, the cut-in and progress history are worked out in the browser. They make no extra model calls.
- Speech uses the browser's Web Speech API: recognition for your voice and synthesis for the other person's voice.

## Browser support

- Voice input works in desktop Chrome and Edge.
- Other browsers, and any browser where the microphone is blocked, fall back to typed replies. The app shows a notice and a text box instead of the microphone button.
- Use headphones. Without them the microphone can pick up the other person's voice.

## Privacy

- Audio is never sent to this app's server or to Anthropic.
- Only the text transcript goes to Anthropic, through a stateless proxy (`/api/llm`).
- The API key is held in memory only. It is sent with each request in the `x-anthropic-key` header, and it is never stored or logged.
- Conversations are not saved. A refresh clears the key and the conversation.
- Progress history is the one thing kept: for each finished rehearsal, the scenario, final score, number of turns and counts of habits such as hedging. It lives in this browser's `localStorage`, is never sent anywhere, and never includes what anyone said. "Clear progress" on the scenario screen deletes it.
- Chrome's built-in speech recognition may send your audio to Google to transcribe it. That happens in the browser and is outside this app's control.

## Known limitations

- **Speech errors other than a blocked or missing microphone and an unsupported browser** (network, unknown, aborted, no-speech) are not shown to the user. The app just returns to "Your turn".
- **Speech heard during a turn is ignored.** If the recogniser delivers an utterance while the other person is thinking or speaking, it is dropped.
- **Pace and pauses are rough when you type.** The results screen says so.

## Tested only against fakes

All automated tests use fakes: `FakeLlmClient`, `FakeSpeechInput` and `FakeSpeechOutput`, or hand-written stand-ins for browser objects. No test touches the network, a microphone or a speaker. Nobody has yet verified the following against the real thing.

**LLM transport (`src/lib/llm`)**
- Real Anthropic responses. The SDK is mocked and the content block shape is assumed.
- Real error payloads. The proxy maps errors from a numeric `status` on fake error objects, so the real SDK's error classes and statuses (including 529) are not exercised.
- Connection errors from a real network outage. One test runs the real SDK with a failing `fetch`.
- Real streaming: whether text arrives sentence by sentence through the route, and whether hosting buffers the stream.
- Whether the model IDs in `MODEL_IDS` are accepted by the real API. They are never sent.
- Real latency, timeouts and the SDK's single retry.
- The `/api/llm` route wiring, which is covered by the build only. No request has gone through a real server.
- The browser client with a real `fetch`: CORS, redirects and non-JSON gateway pages.

**Analysis (`src/lib/analysis`)**
- The quality of real Sonnet scores, summaries and stronger lines, and how often it returns valid JSON with three distinct user-turn indexes on the first try.
- Whether the real model follows the prompt. Tests only check what the prompt contains.
- Metrics and replay on real timing data from speech recognition and synthesis (turn start and end times, pauses, overlaps).
- Real HTTP client failures. Only scripted `LlmError`s are tested.

**Speech (`src/lib/speech`)**
- Real Chrome, Safari and Firefox global shapes (prefixes, partial support).
- Speech synthesis: voice loading (`voiceschanged`), which English voice is picked, event order after `cancel()`, how fast `cancel()` silences playback, and Chrome's long-utterance cut-off.
- Speech recognition: the shape of real `results` lists, how Chrome rewrites earlier entries, when Chrome ends recognition on its own and whether an immediate restart is accepted, the exact error codes and their order relative to `onend`, and whether `onspeechstart` fires before the first result.
- The no-speech timeout, which is armed once per `start()` and not re-armed after each continuous utterance or restart.
- Chrome's recognition accuracy.
- Echo: whether the other person's voice triggers barge-in on a real device. Headphones are recommended for this reason.
- Edge, Safari and Firefox behaviour. Firefox has no recognition and falls back to typed replies.
- A recognition failure after the input has been chosen (for example a failed restart) does not switch the bundle to typed input. The app only switches to typed input on a blocked or missing microphone or an unsupported browser.

**The interface in a real browser**
- The real microphone permission prompt: timing, dismissal and remembered denial.
- Real audio playback of the other person's voice.
- Real Anthropic responses driving a full conversation, including how the interface behaves during real latency.
- The 40-second cut-in with real speech recognition, including whether Chrome delivers the last words after the mic is stopped.
- The file download of the transcript JSON in a real browser.

## Licence

MIT licence. See [LICENSE](./LICENSE).
