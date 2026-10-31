import { Card } from "@/components/ui/Card";
import type { Mood, Turn } from "@/contracts/types";
import { CheckChips, DeltaBadge } from "./BehindTheScenes";
import { compareRetry, retryVerdict, type RetrySnapshot, type UserStep } from "./reveal";

export interface RetryComparisonCardProps {
  retry: RetrySnapshot;
  turns: readonly Turn[];
  giveHistory: readonly number[];
  moodHistory: readonly Mood[];
}

function Attempt({ label, step }: { label: string; step: UserStep }) {
  return (
    <div className="flex flex-col gap-2 rounded-card bg-raised p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-ink-muted">{label}</span>
        <DeltaBadge delta={step.delta} />
      </div>
      <p className="text-ink">&ldquo;{step.text}&rdquo;</p>
      <CheckChips checks={step.checks} pause={step.pause} />
    </div>
  );
}

/** Side-by-side view of a retried turn against the original attempt. */
export function RetryComparisonCard({ retry, turns, giveHistory, moodHistory }: RetryComparisonCardProps) {
  const comparison = compareRetry(retry, turns, giveHistory, moodHistory);
  if (comparison === null) return null;
  const { before, after, gained, dropped, finalBefore, finalAfter } = comparison;
  const better = comparison.deltaChange !== null && comparison.deltaChange > 0;

  return (
    <section aria-labelledby="retry-heading">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 id="retry-heading" className="text-lg font-semibold text-ink">
            Your retry of turn {before.number}
          </h3>
          <p className={better ? "font-medium text-success" : "text-ink"}>{retryVerdict(comparison)}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Attempt label="Before" step={before} />
          {after !== null ? <Attempt label="This time" step={after} /> : null}
        </div>
        {gained.length > 0 || dropped.length > 0 ? (
          <ul aria-label="What changed" className="flex flex-col gap-1 text-sm">
            {gained.map((c) => (
              <li key={`gained-${c.kind}`} className={c.good ? "text-success" : "text-warning"}>
                {c.good ? "Started: " : "New habit: "}
                {c.label.toLowerCase()}
              </li>
            ))}
            {dropped.map((c) => (
              <li key={`dropped-${c.kind}`} className={c.good ? "text-warning" : "text-success"}>
                {c.good ? "Lost: " : "Stopped: "}
                {c.label.toLowerCase()}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-sm text-ink-muted">
          They ended at {finalAfter} out of 100 this time, {finalBefore} before.
        </p>
      </Card>
    </section>
  );
}
