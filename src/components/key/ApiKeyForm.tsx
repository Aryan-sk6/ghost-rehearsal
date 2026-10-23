"use client";

import { useId, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KEY_REJECTED_COPY } from "@/components/errors/errorCopy";

export const KEY_PREFIX = "sk-ant-";
export const KEY_EMPTY_COPY = "Paste your API key to continue.";
export const KEY_FORMAT_COPY =
  "That doesn't look like an Anthropic key (it should start with sk-ant-).";
export const KEY_HELPER_COPY = "Kept in memory for this tab only. Never stored or logged.";

export interface ApiKeyFormProps {
  onSubmit: (key: string) => void;
  rejected?: boolean;
}

export function ApiKeyForm({ onSubmit, rejected = false }: ApiKeyFormProps) {
  const inputId = useId();
  const helperId = `${inputId}-helper`;
  const [value, setValue] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = value.trim();
    if (key === "") {
      setProblem(KEY_EMPTY_COPY);
      return;
    }
    if (!key.startsWith(KEY_PREFIX)) {
      setProblem(KEY_FORMAT_COPY);
      return;
    }
    setProblem(null);
    onSubmit(key);
  }

  return (
    <Card className="mx-auto flex max-w-lg flex-col gap-4">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {rejected ? <Alert tone="error">{KEY_REJECTED_COPY}</Alert> : null}
        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            Anthropic API key
          </label>
          <input
            id={inputId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={problem !== null}
            aria-describedby={helperId}
            className="w-full rounded-card border border-line bg-raised px-4 py-2 text-ink focus-visible:outline-2 focus-visible:outline-accent"
          />
          <p id={helperId} className="text-xs text-ink-muted">
            {KEY_HELPER_COPY}
          </p>
        </div>
        {problem ? <Alert tone="error">{problem}</Alert> : null}
        <Button type="submit" variant="primary" size="lg">
          Start rehearsing
        </Button>
      </form>
    </Card>
  );
}
