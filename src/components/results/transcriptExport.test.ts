import { describe, expect, it } from "vitest";
import { TranscriptExportSchema } from "@/contracts/types";
import { ANALYSIS, METRICS, SCENARIO, TURNS } from "./fixtures";
import { buildTranscriptExport, transcriptFilename } from "./transcriptExport";

const AT = new Date(2026, 9, 23, 9, 5, 30);

describe("transcriptFilename", () => {
  it("formats scenario id and local time as yyyyMMdd-HHmm", () => {
    expect(transcriptFilename("salary-raise", AT)).toBe("ghost-rehearsal-salary-raise-20261023-0905.json");
  });
});

describe("buildTranscriptExport", () => {
  it("passes TranscriptExportSchema with analysis", () => {
    const payload = buildTranscriptExport(
      { scenario: SCENARIO, turns: TURNS, endReason: "user_ended", metrics: METRICS, analysis: ANALYSIS },
      AT,
    );
    expect(TranscriptExportSchema.safeParse(payload).success).toBe(true);
    expect(payload.version).toBe(1);
    expect(payload.exportedAt).toBe(AT.toISOString());
    expect(payload.turns).toEqual(TURNS);
  });

  it("passes TranscriptExportSchema with null analysis and end reason", () => {
    const payload = buildTranscriptExport(
      { scenario: SCENARIO, turns: TURNS, endReason: null, metrics: METRICS, analysis: null },
      AT,
    );
    expect(TranscriptExportSchema.safeParse(payload).success).toBe(true);
    expect(payload.analysis).toBeNull();
  });
});
