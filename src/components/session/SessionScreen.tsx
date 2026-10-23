"use client";

import { useEffect, useRef } from "react";
import type { LlmErrorAction } from "@/components/errors/errorCopy";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { MAX_USER_TURNS } from "@/contracts/constants";
import type { SpeechMode } from "@/contracts/speech";
import type { Mood, Turn } from "@/contracts/types";
import { MicButton } from "./MicButton";
import { TypedReply } from "./TypedReply";

export type SessionPhase = "listening" | "thinking" | "speaking" | "your-turn" | "idle";
export type InputKind = "voice" | "typed";

export type TranscriptTurn = Pick<Turn, "speaker" | "text">;

export interface SessionError {
  message: string;
  action: LlmErrorAction;
}

/** Props only: no Session object and nothing about the counterpart's hidden state. */
export interface SessionScreenProps {
  title: string;
  counterpartRole: string;
  turns: readonly TranscriptTurn[];
  mood: Mood;
  userTurnCount: number;
  phase: SessionPhase;
  interimText?: string;
  inputKind: InputKind;
  mode: SpeechMode;
  /** A non-fatal notice, for example the microphone being blocked. */
  notice?: string;
  error?: SessionError | null;
  onToggleMic: () => void;
  onModeChange: (mode: SpeechMode) => void;
  onSendTyped: (text: string) => void;
  onEnd: () => void;
  onRetry: () => void;
  onNewKey: () => void;
}

const STATUS_COPY: Record<SessionPhase, string> = {
  listening: "Listening…",
  thinking: "They're thinking…",
  speaking: "They're speaking…",
  "your-turn": "Your turn",
  idle: "",
};

function turnNumber(phase: SessionPhase, userTurnCount: number): number {
  const userToSpeak = phase === "listening" || phase === "your-turn" || phase === "idle";
  const n = userToSpeak ? userTurnCount + 1 : Math.max(userTurnCount, 1);
  return Math.min(n, MAX_USER_TURNS);
}

export function SessionScreen({
  title,
  counterpartRole,
  turns,
  mood,
  userTurnCount,
  phase,
  interimText,
  inputKind,
  mode,
  notice,
  error,
  onToggleMic,
  onModeChange,
  onSendTyped,
  onEnd,
  onRetry,
  onNewKey,
}: SessionScreenProps) {
  const endRef = useRef<HTMLLIElement>(null);
  const interim = interimText?.trim() ?? "";
  const status = STATUS_COPY[phase];

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [turns.length, interim]);

  return (
    <section aria-label="Conversation" className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <p className="text-sm text-ink-muted">{counterpartRole}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-muted">
            Turn {turnNumber(phase, userTurnCount)} of {MAX_USER_TURNS}
          </span>
          <Button variant="danger" onClick={onEnd}>
            End conversation
          </Button>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-muted">
          They seem {mood}
        </span>
        <p role="status" className="text-sm text-ink-muted">
          {status}
        </p>
      </div>

      <ul
        aria-label="Transcript"
        className="flex max-h-[50vh] min-h-48 flex-col gap-3 overflow-y-auto rounded-card border border-line bg-surface p-4"
      >
        {turns.map((turn, index) => (
          <li
            key={index}
            className={
              turn.speaker === "user"
                ? "ml-auto max-w-[80%] rounded-card bg-accent-strong/30 px-4 py-2 text-ink"
                : "mr-auto max-w-[80%] rounded-card bg-raised px-4 py-2 text-ink"
            }
          >
            <span className="sr-only">{turn.speaker === "user" ? "You: " : "Them: "}</span>
            {turn.text}
          </li>
        ))}
        {interim !== "" ? (
          <li className="ml-auto max-w-[80%] rounded-card bg-accent-strong/30 px-4 py-2 text-ink-muted italic">
            {interim}
          </li>
        ) : null}
        <li ref={endRef} aria-hidden="true" className="h-0" />
      </ul>

      {error ? (
        <Alert tone="error" className="flex flex-wrap items-center justify-between gap-3">
          <span>{error.message}</span>
          {error.action === "retry" ? (
            <Button variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          ) : (
            <Button variant="secondary" onClick={onNewKey}>
              Enter a new key
            </Button>
          )}
        </Alert>
      ) : notice ? (
        <Alert tone="warning">{notice}</Alert>
      ) : null}

      {inputKind === "voice" ? (
        <div className="flex flex-col items-center gap-3">
          <MicButton phase={phase} mode={mode} onClick={onToggleMic} />
          <div role="group" aria-label="Input mode" className="flex gap-2">
            <Button
              variant={mode === "push-to-talk" ? "primary" : "secondary"}
              aria-pressed={mode === "push-to-talk"}
              onClick={() => onModeChange("push-to-talk")}
            >
              Push to talk
            </Button>
            <Button
              variant={mode === "continuous" ? "primary" : "secondary"}
              aria-pressed={mode === "continuous"}
              onClick={() => onModeChange("continuous")}
            >
              Continuous
            </Button>
          </div>
          <p className="text-xs text-ink-muted">Use headphones so the mic doesn&apos;t hear them.</p>
        </div>
      ) : (
        <TypedReply phase={phase} onSend={onSendTyped} />
      )}
    </section>
  );
}
