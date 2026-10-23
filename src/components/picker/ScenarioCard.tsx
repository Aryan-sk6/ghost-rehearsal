import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Scenario } from "@/contracts/types";

export interface ScenarioCardProps {
  scenario: Scenario;
  onPick: (scenario: Scenario) => void;
}

/** Deliberately never renders scenario.hiddenBottomLine. */
export function ScenarioCard({ scenario, onPick }: ScenarioCardProps) {
  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-ink">{scenario.title}</h3>
      <p className="text-sm text-ink-muted">{scenario.counterpartRole}</p>
      <p className="text-sm text-ink">{scenario.userGoal}</p>
      <p className="text-xs text-ink-muted">Difficulty {scenario.difficulty}/5</p>
      <Button
        className="mt-auto self-start"
        aria-label={`Practise this: ${scenario.title}`}
        onClick={() => onPick(scenario)}
      >
        Practise this
      </Button>
    </Card>
  );
}
