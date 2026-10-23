import { Card } from "@/components/ui/Card";
import type { SessionAnalysis } from "@/contracts/types";

export interface ScoreGridProps {
  scores: SessionAnalysis["scores"];
}

const SCORE_LABELS: ReadonlyArray<readonly [keyof SessionAnalysis["scores"], string]> = [
  ["clarity", "Clarity"],
  ["confidence", "Confidence"],
  ["handlingPushback", "Handling pushback"],
  ["outcome", "Outcome"],
];

export function ScoreGrid({ scores }: ScoreGridProps) {
  return (
    <ul aria-label="Scores" className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {SCORE_LABELS.map(([key, label]) => (
        <li key={key}>
          <Card className="flex flex-col gap-1 p-4">
            <span className="text-sm text-ink-muted">{label}</span>
            <span className="text-2xl font-semibold text-accent">{scores[key]}/10</span>
          </Card>
        </li>
      ))}
    </ul>
  );
}
