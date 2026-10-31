"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BUILTIN_SCENARIOS } from "@/scenarios/builtins";
import type { Scenario } from "@/contracts/types";
import type { ScenarioSummary } from "@/lib/history";
import { CustomScenarioBuilder } from "./CustomScenarioBuilder";
import { ProgressList } from "./ProgressList";
import { ScenarioCard } from "./ScenarioCard";

export interface ScenarioPickerProps {
  onPick: (scenario: Scenario) => void;
  scenarios?: readonly Scenario[];
  /** Earlier rehearsals, one row per scenario. */
  progress?: readonly ScenarioSummary[];
  onClearProgress?: () => void;
}

export function ScenarioPicker({
  onPick,
  scenarios = BUILTIN_SCENARIOS,
  progress = [],
  onClearProgress = () => {},
}: ScenarioPickerProps) {
  const [building, setBuilding] = useState(false);

  return (
    <section aria-labelledby="picker-heading" className="flex flex-col gap-6">
      <h2 id="picker-heading" className="text-2xl font-semibold text-ink">
        Choose a conversation to rehearse
      </h2>
      <ProgressList summaries={progress} onClear={onClearProgress} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {scenarios.map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} onPick={onPick} />
        ))}
        {building ? (
          <div className="md:col-span-2">
            <CustomScenarioBuilder onPick={onPick} onCancel={() => setBuilding(false)} />
          </div>
        ) : (
          <Card className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-ink">Build your own</h3>
            <p className="text-sm text-ink-muted">
              Describe the conversation you are dreading and who is on the other side.
            </p>
            <Button variant="secondary" className="mt-auto self-start" onClick={() => setBuilding(true)}>
              Build your own
            </Button>
          </Card>
        )}
      </div>
    </section>
  );
}
