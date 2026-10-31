"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Scenario } from "@/contracts/types";
import type { PrepPlan } from "@/lib/analysis";

export interface PrepScreenProps {
  scenario: Scenario;
  /** The last plan for this scenario, so a retry or repeat starts filled in. */
  initial?: PrepPlan | null;
  onStart: (plan: PrepPlan) => void;
  onBack: () => void;
}

export const PREP_HEADING = "Take 30 seconds to plan";

const FIELD_CLASSES =
  "w-full rounded-card border border-line bg-raised px-4 py-2 text-ink focus-visible:outline-2 focus-visible:outline-accent";

/** Deliberately never renders scenario.hiddenBottomLine. */
export function PrepScreen({ scenario, initial = null, onStart, onBack }: PrepScreenProps) {
  const askId = useId();
  const walkId = useId();
  const [ask, setAsk] = useState(initial?.ask ?? "");
  const [walkAway, setWalkAway] = useState(initial?.walkAway ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStart({ ask: ask.trim(), walkAway: walkAway.trim() });
  }

  return (
    <section aria-labelledby="prep-heading" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-ink-muted">{scenario.title}</p>
        <h2 id="prep-heading" className="text-2xl font-semibold text-ink">
          {PREP_HEADING}
        </h2>
        <p className="text-ink-muted">{scenario.userGoal}</p>
      </header>
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor={askId} className="font-medium text-ink">
              What will you ask for?
            </label>
            <input
              id={askId}
              value={ask}
              onChange={(event) => setAsk(event.target.value)}
              placeholder="For example: a 10% raise"
              autoComplete="off"
              className={FIELD_CLASSES}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={walkId} className="font-medium text-ink">
              What&rsquo;s the least you&rsquo;d accept?
            </label>
            <input
              id={walkId}
              value={walkAway}
              onChange={(event) => setWalkAway(event.target.value)}
              placeholder="For example: 6%"
              autoComplete="off"
              className={FIELD_CLASSES}
            />
          </div>
          <p className="text-sm text-ink-muted">
            Both are optional. Include a number and the results will show whether you opened with it and whether you
            gave away more than you meant to.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg">
              Start the conversation
            </Button>
            <Button variant="ghost" size="lg" onClick={onBack}>
              Choose another
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
