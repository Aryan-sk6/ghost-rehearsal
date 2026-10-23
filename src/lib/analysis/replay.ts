import { RehearsalError } from "@/contracts/errors";
import type { ReplayFrom } from "@/contracts/modules";

/** Returns the session as it was just before user turn `turnIndex`. */
export const replayFrom: ReplayFrom = (session, turnIndex) => {
  const turn = Number.isInteger(turnIndex) ? session.turns[turnIndex] : undefined;
  if (turnIndex < 0 || turn === undefined) {
    throw new RehearsalError(
      "turn_index_out_of_range",
      `Turn ${turnIndex} is outside the ${session.turns.length} turns of this session`,
    );
  }
  if (turn.speaker !== "user") {
    throw new RehearsalError("not_a_user_turn", `Turn ${turnIndex} is not a user turn`);
  }
  return {
    ...session,
    status: "awaiting_user",
    turns: session.turns.slice(0, turnIndex),
    giveHistory: session.giveHistory.slice(0, turnIndex),
    moodHistory: session.moodHistory.slice(0, turnIndex),
    endReason: null,
    endedAtMs: null,
  };
};
