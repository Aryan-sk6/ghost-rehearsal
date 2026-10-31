import { Card } from "@/components/ui/Card";
import type { Mood, Turn } from "@/contracts/types";
import { buildGiveTimeline, outcomeLine, pauseLabel, type GiveTimeline, type UserStep } from "./reveal";

export interface BehindTheScenesProps {
  turns: readonly Turn[];
  giveHistory: readonly number[];
  moodHistory: readonly Mood[];
  hiddenBottomLine: string;
}

export const BEHIND_HEADING = "What they were thinking";
export const BOTTOM_LINE_LABEL = "What they were ready to concede";

const MOOD_LABEL: Record<Mood, string> = {
  warm: "Warm",
  open: "Open",
  neutral: "Neutral",
  guarded: "Guarded",
  impatient: "Impatient",
  irritated: "Irritated",
};

// Chart geometry, in SVG units. The SVG scales to the card width.
const W = 240;
const H = 120;
const PAD = { left: 24, right: 10, top: 14, bottom: 16 };

function GiveChart({ timeline }: { timeline: GiveTimeline }) {
  const { points, goal, start, final } = timeline;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const y = (give: number) => PAD.top + innerH * (1 - give / 100);
  const x = (i: number) =>
    points.length <= 1 ? PAD.left + innerW / 2 : PAD.left + (innerW * i) / (points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.give)}`).join(" ");
  const summary = `Chart of their willingness after each reply, from ${start} to ${final} out of 100. The goal line is at ${goal}.`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={summary}
      className="h-auto w-full max-w-md"
      preserveAspectRatio="xMidYMid meet"
    >
      {[0, 100].map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-line" />
          <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" className="fill-ink-muted text-[9px]">
            {v}
          </text>
        </g>
      ))}
      <line
        x1={PAD.left}
        x2={W - PAD.right}
        y1={y(goal)}
        y2={y(goal)}
        strokeDasharray="4 3"
        className="stroke-success"
      />
      <text x={PAD.left - 6} y={y(goal) + 3} textAnchor="end" className="fill-success text-[9px]">
        {goal}
      </text>
      <text x={W - PAD.right} y={y(goal) - 4} textAnchor="end" className="fill-success text-[9px]">
        Yes
      </text>
      {points.length > 1 ? (
        <path d={path} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-accent" />
      ) : null}
      {points.map((p, i) => (
        <g key={p.turnIndex}>
          <circle cx={x(i)} cy={y(p.give)} r={3.5} className="fill-accent stroke-surface" strokeWidth={1.5} />
          <text
            x={x(i)}
            y={y(p.give) - 7}
            textAnchor={points.length > 1 && i === points.length - 1 ? "end" : points.length > 1 && i === 0 ? "start" : "middle"}
            className="fill-ink text-[9px] tabular-nums"
          >
            {p.give}
          </text>
        </g>
      ))}
      <text x={PAD.left} y={H - 4} className="fill-ink-muted text-[9px]">
        Start
      </text>
      <text x={W - PAD.right} y={H - 4} textAnchor="end" className="fill-ink-muted text-[9px]">
        End
      </text>
    </svg>
  );
}

export function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-sm text-ink-muted">No reply</span>;
  if (delta === 0) return <span className="text-sm text-ink-muted">No change</span>;
  const up = delta > 0;
  return (
    <span className={`text-sm font-semibold tabular-nums ${up ? "text-success" : "text-danger"}`}>
      <span aria-hidden="true">{up ? "▲" : "▼"} </span>
      {up ? `Up ${delta}` : `Down ${Math.abs(delta)}`}
    </span>
  );
}

export function CheckChips({ checks, pause }: Pick<UserStep, "checks" | "pause">) {
  if (checks.length === 0 && pause === null) return null;
  return (
    <ul aria-label="What this turn did" className="flex flex-wrap gap-2">
      {pause !== null ? (
        <li
          className={`rounded-full border px-2.5 py-0.5 text-xs ${
            pause.thenGaveGround ? "border-warning/40 text-warning" : "border-line text-ink-muted"
          }`}
        >
          <span aria-hidden="true">{pause.thenGaveGround ? "! " : "… "}</span>
          {pauseLabel(pause)}
        </li>
      ) : null}
      {checks.map((check) => (
        <li
          key={check.kind}
          className={`rounded-full border px-2.5 py-0.5 text-xs ${
            check.good ? "border-success/40 text-success" : "border-warning/40 text-warning"
          }`}
        >
          <span aria-hidden="true">{check.good ? "✓ " : "! "}</span>
          {check.label}: &ldquo;{check.evidence}&rdquo;
        </li>
      ))}
    </ul>
  );
}

function StepRow({ step, tag }: { step: UserStep; tag: string | null }) {
  return (
    <li className="flex flex-col gap-1 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm text-ink-muted">
          Your turn {step.number}
          {tag !== null ? <span className="ml-2 rounded-full bg-raised px-2 py-0.5 text-xs text-ink">{tag}</span> : null}
        </span>
        <span className="flex flex-wrap items-baseline gap-x-3">
          <DeltaBadge delta={step.delta} />
          {step.moodAfter !== null ? (
            <span className="text-sm text-ink-muted">Then: {MOOD_LABEL[step.moodAfter]}</span>
          ) : null}
        </span>
      </div>
      <p className="text-ink">&ldquo;{step.text}&rdquo;</p>
      <CheckChips checks={step.checks} pause={step.pause} />
    </li>
  );
}

/** The after-the-fact reveal: their hidden willingness, mood and bottom line. */
export function BehindTheScenes({ turns, giveHistory, moodHistory, hiddenBottomLine }: BehindTheScenesProps) {
  const timeline = buildGiveTimeline(turns, giveHistory, moodHistory);
  const tagFor = (step: UserStep): string | null => {
    if (step.turnIndex === timeline.bestTurnIndex) return "Best move";
    if (step.turnIndex === timeline.worstTurnIndex) return "Cost you most";
    return null;
  };

  return (
    <section aria-labelledby="behind-heading" className="flex flex-col gap-3">
      <h3 id="behind-heading" className="text-lg font-semibold text-ink">
        {BEHIND_HEADING}
      </h3>
      <Card className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-ink">{outcomeLine(timeline)}</p>
          <p className="text-sm text-ink-muted">
            This score was hidden while you talked. It goes up for clear, specific, calm asks and down for hedging or
            pushing too hard. The tags under each line are simple word checks: naming a number and giving a reason
            help; hedging, apologising and giving ground hurt. Silences of 3 seconds or more are marked too.
          </p>
        </div>
        <GiveChart timeline={timeline} />
        {timeline.steps.length > 0 ? (
          <ol aria-label="How each of your turns moved them" className="flex flex-col gap-3">
            {timeline.steps.map((step) => (
              <StepRow key={step.turnIndex} step={step} tag={tagFor(step)} />
            ))}
          </ol>
        ) : null}
        <div className="rounded-card bg-raised p-4">
          <p className="text-sm font-semibold text-ink-muted">{BOTTOM_LINE_LABEL}</p>
          <p className="mt-1 text-ink">{hiddenBottomLine}</p>
        </div>
      </Card>
    </section>
  );
}
