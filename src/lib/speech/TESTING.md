# Speech: fake-only report

Verified only against hand-written fakes, never a real browser, microphone or speaker:

- `detectSpeechSupport`: real Chrome/Safari/Firefox global shapes (prefixes, partial support).
- `createSpeechOutput`: real `speechSynthesis` voice-loading timing (`voiceschanged`), voice choice, `onend`/`onerror` ordering after `cancel()`, and Chrome's long-utterance cut-off.
