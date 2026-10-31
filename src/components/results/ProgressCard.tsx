import { Card } from "@/components/ui/Card";
import { habitChanges, type HistoryEntry, type ScenarioProgress } from "@/lib/history";

export interface ProgressCardProps {
  entry: HistoryEntry;
  progress: ScenarioProgress;
}

export const PROGRESS_CARD_HEADING = "Compared with last time";
export const SAVED_LOCALLY_NOTE = "Saved in this browser only. Scores and counts are kept, never what you said.";

function changeText(now: number, before: number): string {
  if (now === before) return `the same as last time (${before})`;
  return `${now > before ? "up" : "down"} ${Math.abs(now - before)} from last time (${before})`;
}

function turnsText(count: number, turns: number): string {
  return `${count} of ${turns} turn${turns === 1 ? "" : "s"}`;
}

export function ProgressCard({ entry, progress }: ProgressCardProps) {
  const { previous, bestBefore, attempts } = progress;
  const changes = previous === null ? [] : habitChanges(entry, previous);
  const newBest = bestBefore !== null && entry.finalGive > bestBefore.finalGive;

  return (
    <section aria-labelledby="progress-heading">
      <Card className="flex flex-col gap-3">
        <h3 id="progress-heading" className="text-lg font-semibold text-ink">
          {PROGRESS_CARD_HEADING}
        </h3>
        {previous === null ? (
          <p className="text-ink">
            This is your first saved attempt at this scenario. Next time you&rsquo;ll see how you compare.
          </p>
        ) : (
          <>
            <p className="text-ink">
              Attempt {attempts}. They ended at {entry.finalGive} out of 100,{" "}
              {changeText(entry.finalGive, previous.finalGive)}.
            </p>
            {bestBefore !== null ? (
              <p className={newBest ? "font-medium text-success" : "text-ink-muted"}>
                {newBest ? "Your best result yet." : `Your best so far is ${bestBefore.finalGive}.`}
              </p>
            ) : null}
            {changes.length > 0 ? (
              <ul aria-label="Habits since last time" className="flex flex-col gap-1 text-sm">
                {changes.map((c) => (
                  <li key={c.kind} className={c.better ? "text-success" : "text-warning"}>
                    <span aria-hidden="true">{c.better ? "✓ " : "! "}</span>
                    {c.label} in {turnsText(c.now, c.nowTurns)}, last time {turnsText(c.before, c.beforeTurns)}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
        <p className="text-xs text-ink-muted">{SAVED_LOCALLY_NOTE}</p>
      </Card>
    </section>
  );
}
