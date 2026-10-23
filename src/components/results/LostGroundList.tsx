import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { LostGroundMoment, Turn } from "@/contracts/types";

export interface LostGroundListProps {
  moments: readonly LostGroundMoment[];
  turns: readonly Pick<Turn, "speaker">[];
  onRetryFrom: (turnIndex: number) => void;
}

/** 1-based number of the user turn at `turnIndex`. */
function userTurnNumber(turns: readonly Pick<Turn, "speaker">[], turnIndex: number): number {
  let count = 0;
  for (let i = 0; i <= turnIndex && i < turns.length; i += 1) {
    if (turns[i]?.speaker === "user") count += 1;
  }
  return Math.max(count, 1);
}

interface MomentProps {
  moment: LostGroundMoment;
  turnNumber: number;
  onRetryFrom: (turnIndex: number) => void;
}

function Moment({ moment, turnNumber, onRetryFrom }: MomentProps) {
  const headingId = useId();
  return (
    <li>
      <Card className="flex flex-col gap-3">
        <h4 id={headingId} className="text-sm font-semibold text-accent">
          Your turn {turnNumber}
        </h4>
        <blockquote className="border-l-2 border-line pl-3 text-ink italic">
          {moment.userSaid}
        </blockquote>
        <p className="text-sm text-ink">
          <span className="font-semibold">Why it hurt</span> {moment.whyItHurt}
        </p>
        <p className="text-sm text-success">Try instead: {moment.strongerLine}</p>
        <Button
          variant="secondary"
          className="self-start"
          aria-describedby={headingId}
          onClick={() => onRetryFrom(moment.turnIndex)}
        >
          Retry from here
        </Button>
      </Card>
    </li>
  );
}

export function LostGroundList({ moments, turns, onRetryFrom }: LostGroundListProps) {
  return (
    <section aria-labelledby="lost-ground-heading" className="flex flex-col gap-3">
      <h3 id="lost-ground-heading" className="text-lg font-semibold text-ink">
        Where you lost ground
      </h3>
      <ul className="flex flex-col gap-4">
        {moments.map((moment) => (
          <Moment
            key={moment.turnIndex}
            moment={moment}
            turnNumber={userTurnNumber(turns, moment.turnIndex)}
            onRetryFrom={onRetryFrom}
          />
        ))}
      </ul>
    </section>
  );
}
