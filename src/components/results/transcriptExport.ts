import type {
  EndReason,
  Scenario,
  SessionAnalysis,
  SessionMetrics,
  Turn,
  TranscriptExport,
} from "@/contracts/types";

export interface TranscriptExportInput {
  scenario: Scenario;
  turns: readonly Turn[];
  endReason: EndReason | null;
  metrics: SessionMetrics;
  analysis: SessionAnalysis | null;
}

export function buildTranscriptExport(input: TranscriptExportInput, exportedAt: Date): TranscriptExport {
  return {
    version: 1,
    exportedAt: exportedAt.toISOString(),
    scenario: input.scenario,
    turns: input.turns.map((turn) => ({ ...turn })),
    endReason: input.endReason,
    metrics: input.metrics,
    analysis: input.analysis,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** ghost-rehearsal-{scenarioId}-{yyyyMMdd-HHmm}.json, in local time. */
export function transcriptFilename(scenarioId: string, at: Date): string {
  const date = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}`;
  const time = `${pad(at.getHours())}${pad(at.getMinutes())}`;
  return `ghost-rehearsal-${scenarioId}-${date}-${time}.json`;
}

/** Browser only: call from an event handler, never during render. */
export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
