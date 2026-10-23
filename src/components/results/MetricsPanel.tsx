import { Card } from "@/components/ui/Card";
import type { SessionMetrics } from "@/contracts/types";

export interface MetricsPanelProps {
  metrics: SessionMetrics;
}

export const TYPED_METRICS_NOTE = "Pace and pauses are rough when you type.";

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  const rows: ReadonlyArray<readonly [string, string]> = [
    ["Words per minute", String(metrics.wordsPerMinute)],
    ["Talk ratio", `${Math.round(metrics.talkRatio * 100)}%`],
    ["Filler words", String(metrics.fillerCount)],
    ["Hedges", String(metrics.hedgeCount)],
    ["Longest pause", `${(metrics.longestPauseMs / 1000).toFixed(1)}s`],
    ["Conceded first", String(metrics.concededFirstCount)],
  ];
  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-ink">How you came across</h3>
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="text-lg font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-ink-muted">{TYPED_METRICS_NOTE}</p>
    </Card>
  );
}
