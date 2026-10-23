# Speech: fake-only report

Verified only against hand-written fakes, never a real browser, microphone or speaker:

- `detectSpeechSupport`: real Chrome/Safari/Firefox global shapes (prefixes, partial support).
- `createSpeechOutput`: real `speechSynthesis` voice-loading timing (`voiceschanged`), voice choice, `onend`/`onerror` ordering after `cancel()`, and Chrome's long-utterance cut-off.
- `createWebSpeechInput`, never run against a real `SpeechRecognition` or microphone:
  - Result shape: real `results` lists, including how interim and final entries accumulate across a continuous session and when Chrome rewrites earlier entries.
  - Final results that Chrome delivers after `stop()` are dropped (the instance is detached first), so the last words of a push-to-talk turn depend on an interim result having arrived.
  - When and why Chrome ends recognition on its own, and whether an immediate restart is accepted (it may throw or need a delay); a failed restart is reported as an `unknown` error.
  - The exact error codes Chrome raises (`not-allowed`, `service-not-allowed`, `no-speech`, `network`, `aborted`) and their ordering relative to `onend`.
  - The no-speech timeout is armed once per `start()`, not re-armed after each continuous utterance or restart.
  - Whether `onspeechstart` fires before the first result on real hardware.
  - Counterpart audio leaking into the microphone (use headphones).
