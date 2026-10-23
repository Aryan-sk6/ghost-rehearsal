"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import type { SessionPhase } from "./SessionScreen";

export interface TypedReplyProps {
  phase: SessionPhase;
  onSend: (text: string) => void;
}

export function TypedReply({ phase, onSend }: TypedReplyProps) {
  const id = useId();
  const [text, setText] = useState("");
  const canSend = phase === "your-turn" && text.trim() !== "";

  function send() {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Your reply
      </label>
      <textarea
        id={id}
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-card border border-line bg-raised px-4 py-2 text-ink focus-visible:outline-2 focus-visible:outline-accent"
      />
      <Button className="self-end" disabled={!canSend} onClick={send}>
        Send
      </Button>
    </div>
  );
}
