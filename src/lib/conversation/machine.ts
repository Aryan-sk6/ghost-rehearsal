import { GOAL_GIVE, MAX_USER_TURNS, START_GIVE } from "@/contracts/constants";
import { IllegalTransitionError, RehearsalError, type TransitionAction } from "@/contracts/errors";
import type {
  AddCounterpartTurn,
  AddOpeningTurn,
  AddUserTurn,
  CountUserTurns,
  CreateSession,
  CurrentGive,
  EndSession,
} from "@/contracts/modules";
import type { EndReason, Mood, Session } from "@/contracts/types";
import { applyGive } from "./give";

function requireStatus(session: Session, status: Session["status"], action: TransitionAction): void {
  if (session.status !== status) throw new IllegalTransitionError(session.status, action);
}

function currentMood(session: Session): Mood {
  return session.moodHistory[session.moodHistory.length - 1] ?? "neutral";
}

export const createSession: CreateSession = (scenario, opts) => ({
  id: opts.id,
  scenario,
  status: "counterpart_opening",
  turns: [],
  giveHistory: [],
  moodHistory: [],
  endReason: null,
  startedAtMs: opts.nowMs,
  endedAtMs: null,
});

export const currentGive: CurrentGive = (session) =>
  session.giveHistory[session.giveHistory.length - 1] ?? START_GIVE;

export const countUserTurns: CountUserTurns = (session) =>
  session.turns.filter((turn) => turn.speaker === "user").length;

export const addOpeningTurn: AddOpeningTurn = (session, timing) => {
  requireStatus(session, "counterpart_opening", "addOpeningTurn");
  return {
    ...session,
    status: "awaiting_user",
    turns: [
      ...session.turns,
      {
        speaker: "counterpart",
        text: session.scenario.openingLine,
        startedAtMs: timing.startedAtMs,
        endedAtMs: timing.endedAtMs,
      },
    ],
    giveHistory: [...session.giveHistory, START_GIVE],
    moodHistory: [...session.moodHistory, "neutral"],
  };
};

export const addUserTurn: AddUserTurn = (session, text, timing) => {
  requireStatus(session, "awaiting_user", "addUserTurn");
  const trimmed = text.trim();
  if (trimmed === "") throw new RehearsalError("empty_user_turn", "The user turn has no text");
  return {
    ...session,
    status: "awaiting_counterpart",
    turns: [
      ...session.turns,
      { speaker: "user", text: trimmed, startedAtMs: timing.startedAtMs, endedAtMs: timing.endedAtMs },
    ],
    giveHistory: [...session.giveHistory, currentGive(session)],
    moodHistory: [...session.moodHistory, currentMood(session)],
  };
};

export const addCounterpartTurn: AddCounterpartTurn = (session, reply, timing) => {
  requireStatus(session, "awaiting_counterpart", "addCounterpartTurn");
  const give = applyGive(currentGive(session), reply.give, session.scenario.difficulty);
  const turns = [
    ...session.turns,
    {
      speaker: "counterpart" as const,
      text: reply.reply,
      startedAtMs: timing.startedAtMs,
      endedAtMs: timing.endedAtMs,
    },
  ];
  const next: Session = {
    ...session,
    status: "awaiting_user",
    turns,
    giveHistory: [...session.giveHistory, give],
    moodHistory: [...session.moodHistory, reply.mood],
  };

  let endReason: EndReason | null = null;
  if (give >= GOAL_GIVE) endReason = "goal_reached";
  else if (give <= 0) endReason = "give_zero";
  else if (countUserTurns(next) >= MAX_USER_TURNS) endReason = "turn_cap";

  if (endReason === null) return next;
  return { ...next, status: "ended", endReason, endedAtMs: timing.endedAtMs };
};

export const endSession: EndSession = (session, nowMs) => {
  if (session.status === "ended") throw new IllegalTransitionError(session.status, "endSession");
  return { ...session, status: "ended", endReason: "user_ended", endedAtMs: nowMs };
};
