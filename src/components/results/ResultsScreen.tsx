"use client";

import type { SessionError } from "@/components/session/SessionScreen";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type {
  EndReason,
  Scenario,
  SessionAnalysis,
  SessionMetrics,
  Turn,
} from "@/contracts/types";
import { LostGroundList } from "./LostGroundList";
import { MetricsPanel } from "./MetricsPanel";
import { ScoreGrid } from "./ScoreGrid";
import { buildTranscriptExport, downloadJson, transcriptFilename } from "./transcriptExport";

export type AnalysisState =
  | { status: "loading" }
  | { status: "ready"; analysis: SessionAnalysis }
  | { status: "error"; error: SessionError }
  | { status: "too-short" };

export interface ResultsScreenProps {
  scenario: Scenario;
  turns: readonly Turn[];
  endReason: EndReason;
  metrics: SessionMetrics;
  analysis: AnalysisState;
  onRetryFrom: (turnIndex: number) => void;
  onRetryAnalysis: () => void;
  onNewKey: () => void;
  onRestart: () => void;
  /** Injectable clock for the export filename; defaults to the current time. */
  now?: () => Date;
}

export const END_REASON_COPY: Record<EndReason, string> = {
  goal_reached: "They came round. You reached your goal.",
  give_zero: "They shut the conversation down.",
  turn_cap: "You hit the 12-turn limit.",
  user_ended: "You ended the conversation.",
};

export const TOO_SHORT_COPY =
  "Have at least 3 exchanges to get feedback on where you lost ground.";

export function ResultsScreen({
  scenario,
  turns,
  endReason,
  metrics,
  analysis,
  onRetryFrom,
  onRetryAnalysis,
  onNewKey,
  onRestart,
  now = () => new Date(),
}: ResultsScreenProps) {
  function handleDownload() {
    const at = now();
    const payload = buildTranscriptExport(
      {
        scenario,
        turns,
        endReason,
        metrics,
        analysis: analysis.status === "ready" ? analysis.analysis : null,
      },
      at,
    );
    downloadJson(transcriptFilename(scenario.id, at), payload);
  }

  return (
    <section aria-label="Results" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-ink">{scenario.title}</h2>
        <p className="text-ink-muted">{END_REASON_COPY[endReason]}</p>
      </header>

      {analysis.status === "loading" ? (
        <p role="status" className="text-ink-muted">
          Writing your feedback…
        </p>
      ) : null}

      {analysis.status === "error" ? (
        <Alert tone="error" className="flex flex-wrap items-center justify-between gap-3">
          <span>{analysis.error.message}</span>
          {analysis.error.action === "new-key" ? (
            <Button variant="secondary" onClick={onNewKey}>
              Enter a new key
            </Button>
          ) : (
            <Button variant="secondary" onClick={onRetryAnalysis}>
              Try again
            </Button>
          )}
        </Alert>
      ) : null}

      {analysis.status === "too-short" ? <Alert tone="info">{TOO_SHORT_COPY}</Alert> : null}

      {analysis.status === "ready" ? (
        <>
          <p className="text-ink">{analysis.analysis.summary}</p>
          <ScoreGrid scores={analysis.analysis.scores} />
        </>
      ) : null}

      <MetricsPanel metrics={metrics} />

      {analysis.status === "ready" ? (
        <LostGroundList
          moments={analysis.analysis.lostGround}
          turns={turns}
          onRetryFrom={onRetryFrom}
        />
      ) : null}

      <p className="text-ink">What they would have conceded: {scenario.hiddenBottomLine}</p>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" size="lg" onClick={handleDownload}>
          Download transcript (JSON)
        </Button>
        <Button size="lg" onClick={onRestart}>
          Practise another
        </Button>
      </div>
    </section>
  );
}
