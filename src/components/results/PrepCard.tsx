import { Card } from "@/components/ui/Card";
import type { Turn } from "@/contracts/types";
import { checkPrep, type PrepPlan, type PrepTone } from "@/lib/analysis";

export interface PrepCardProps {
  plan: PrepPlan;
  turns: readonly Turn[];
}

export const PREP_CARD_HEADING = "Your plan against what you said";

const TONE: Record<PrepTone, { className: string; mark: string }> = {
  good: { className: "text-success", mark: "✓ " },
  warn: { className: "text-warning", mark: "! " },
  neutral: { className: "text-ink-muted", mark: "" },
};

function PlanLine({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card bg-raised p-4">
      <span className="text-sm font-semibold text-ink-muted">{label}</span>
      <span className="text-ink">{text === "" ? "Left blank" : text}</span>
    </div>
  );
}

export function PrepCard({ plan, turns }: PrepCardProps) {
  const findings = checkPrep(plan, turns);
  return (
    <section aria-labelledby="prep-card-heading">
      <Card className="flex flex-col gap-4">
        <h3 id="prep-card-heading" className="text-lg font-semibold text-ink">
          {PREP_CARD_HEADING}
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <PlanLine label="You planned to ask for" text={plan.ask} />
          <PlanLine label="Your walk-away" text={plan.walkAway} />
        </div>
        {findings.length > 0 ? (
          <ul aria-label="How it went against the plan" className="flex flex-col gap-2">
            {findings.map((f) => (
              <li key={f.text} className={TONE[f.tone].className}>
                <span aria-hidden="true">{TONE[f.tone].mark}</span>
                {f.text}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </section>
  );
}
