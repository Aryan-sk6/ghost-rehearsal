"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ScenarioSummary } from "@/lib/history";

export interface ProgressListProps {
  summaries: readonly ScenarioSummary[];
  onClear: () => void;
}

export const PROGRESS_HEADING = "Your progress";

/** Final scores for recent attempts as small bars, oldest on the left. Decorative: the text says the same. */
function Bars({ values, goal }: { values: readonly number[]; goal: number }) {
  return (
    <div aria-hidden="true" className="flex h-10 shrink-0 items-end gap-1">
      {values.map((v, i) => (
        <span key={i} className="flex h-full w-2.5 items-end rounded-sm bg-raised">
          <span
            className={`w-full rounded-sm ${v >= goal ? "bg-success" : "bg-accent"}`}
            style={{ height: `${Math.max(6, v)}%` }}
          />
        </span>
      ))}
    </div>
  );
}

export function ProgressList({ summaries, onClear }: ProgressListProps) {
  const [confirming, setConfirming] = useState(false);
  if (summaries.length === 0) return null;

  return (
    <section aria-labelledby="progress-list-heading">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 id="progress-list-heading" className="text-lg font-semibold text-ink">
            {PROGRESS_HEADING}
          </h3>
          <p className="text-sm text-ink-muted">
            Where they ended up out of 100 each time. They say yes at {summaries[0]?.goal ?? 80}. Saved in this
            browser only, without what you said.
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {summaries.map((s) => (
            <li
              key={s.scenarioId}
              className="flex items-center justify-between gap-4 border-t border-line pt-3 first:border-t-0 first:pt-0"
            >
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-ink">{s.scenarioTitle}</span>
                <span className="text-sm text-ink-muted">
                  {s.attempts} {s.attempts === 1 ? "attempt" : "attempts"} · latest {s.latest} · best {s.best}
                </span>
              </div>
              <Bars values={s.recent} goal={s.goal} />
            </li>
          ))}
        </ul>
        {confirming ? (
          <div role="group" aria-label="Confirm clearing progress" className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-ink">Delete all saved progress? This can&rsquo;t be undone.</span>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                onClear();
              }}
            >
              Delete progress
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <Button variant="ghost" className="self-start" onClick={() => setConfirming(true)}>
            Clear progress
          </Button>
        )}
      </Card>
    </section>
  );
}
