"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Slider } from "@/components/ui/Slider";
import { CustomScenarioInputSchema, type Scenario } from "@/contracts/types";

export interface CustomScenarioBuilderProps {
  onPick: (scenario: Scenario) => void;
  onCancel?: () => void;
}

type FieldName =
  | "title"
  | "userGoal"
  | "counterpartRole"
  | "counterpartTraits"
  | "openingLine"
  | "hiddenBottomLine";

type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly FieldName[] = [
  "title",
  "userGoal",
  "counterpartRole",
  "counterpartTraits",
  "openingLine",
  "hiddenBottomLine",
];

const FIELD_LABELS: Record<FieldName, string> = {
  title: "Title",
  userGoal: "Your goal",
  counterpartRole: "Who they are",
  counterpartTraits: "How they behave",
  openingLine: "Their opening line",
  hiddenBottomLine: "What they'd concede at most",
};

const DEFAULT_DIFFICULTY = 3;

function isFieldName(value: unknown): value is FieldName {
  return typeof value === "string" && (FIELD_NAMES as readonly string[]).includes(value);
}

function parseTraits(raw: string): string[] {
  return raw
    .split(",")
    .map((trait) => trait.trim())
    .filter((trait) => trait !== "");
}

interface TextFieldProps {
  name: FieldName;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | undefined;
  multiline?: boolean;
  hint?: string;
}

const CONTROL_CLASSES =
  "w-full rounded-card border bg-raised px-4 py-2 text-ink focus-visible:outline-2 focus-visible:outline-accent";

function TextField({ name, label, value, onChange, error, multiline = false, hint }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");
  const shared = {
    id,
    name,
    value,
    "aria-invalid": error !== undefined,
    "aria-describedby": describedBy === "" ? undefined : describedBy,
    className: `${CONTROL_CLASSES} ${error ? "border-danger" : "border-line"}`,
  };
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {multiline ? (
        <textarea {...shared} rows={2} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input {...shared} type="text" onChange={(event) => onChange(event.target.value)} />
      )}
      {hint ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function messageFor(field: FieldName, code: string, limit: number | undefined): string {
  const label = FIELD_LABELS[field];
  if (code === "too_big") {
    return limit === undefined ? `${label} is too long.` : `${label} is too long (max ${limit}).`;
  }
  if (field === "counterpartTraits") return "Add at least one trait, separated by commas.";
  return `${label} is required.`;
}

export function CustomScenarioBuilder({ onPick, onCancel }: CustomScenarioBuilderProps) {
  const counter = useRef(0);
  const [title, setTitle] = useState("");
  const [userGoal, setUserGoal] = useState("");
  const [counterpartRole, setCounterpartRole] = useState("");
  const [traits, setTraits] = useState("");
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY);
  const [openingLine, setOpeningLine] = useState("");
  const [hiddenBottomLine, setHiddenBottomLine] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = CustomScenarioInputSchema.safeParse({
      title,
      userGoal,
      counterpartRole,
      counterpartTraits: parseTraits(traits),
      difficulty,
      openingLine,
      hiddenBottomLine,
    });
    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (!isFieldName(field) || next[field] !== undefined) continue;
        const limit = "maximum" in issue && typeof issue.maximum === "number" ? issue.maximum : undefined;
        next[field] = messageFor(field, issue.code, limit);
      }
      setErrors(next);
      return;
    }
    setErrors({});
    counter.current += 1;
    onPick({ ...result.data, id: `custom-${Date.now().toString(36)}-${counter.current}` });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate aria-label="Build your own scenario" className="flex flex-col gap-4">
        <TextField name="title" label={FIELD_LABELS.title} value={title} onChange={setTitle} error={errors.title} />
        <TextField
          name="userGoal"
          label={FIELD_LABELS.userGoal}
          value={userGoal}
          onChange={setUserGoal}
          error={errors.userGoal}
          multiline
        />
        <TextField
          name="counterpartRole"
          label={FIELD_LABELS.counterpartRole}
          value={counterpartRole}
          onChange={setCounterpartRole}
          error={errors.counterpartRole}
        />
        <TextField
          name="counterpartTraits"
          label={FIELD_LABELS.counterpartTraits}
          value={traits}
          onChange={setTraits}
          error={errors.counterpartTraits}
          hint="Separate traits with commas, for example: impatient, polite, evasive."
        />
        <Slider label="Difficulty" value={difficulty} onChange={setDifficulty} />
        <TextField
          name="openingLine"
          label={FIELD_LABELS.openingLine}
          value={openingLine}
          onChange={setOpeningLine}
          error={errors.openingLine}
          multiline
        />
        <TextField
          name="hiddenBottomLine"
          label={FIELD_LABELS.hiddenBottomLine}
          value={hiddenBottomLine}
          onChange={setHiddenBottomLine}
          error={errors.hiddenBottomLine}
          multiline
        />
        <div className="flex gap-3">
          <Button type="submit" size="lg">
            Practise this
          </Button>
          {onCancel ? (
            <Button variant="ghost" size="lg" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
