import { describe, expect, it } from "vitest";
import { RehearsalError } from "@/contracts/errors";
import type { CounterpartReply, Session, Turn } from "@/contracts/types";
import {
  addCounterpartTurn,
  addOpeningTurn,
  addUserTurn,
  createSession,
  currentGive,
  endSession,
} from "@/lib/conversation";
import { replayFrom } from "./replay";

const scenario = {
  id: "s",
  title: "t",
  userGoal: "g",
  counterpartRole: "boss",
  counterpartTraits: ["firm"],
  difficulty: 1,
  openingLine: "Hi",
  hiddenBottomLine: "secret",
};

const turn = (speaker: Turn["speaker"], text: string, startedAtMs: number, endedAtMs: number): Turn => ({
  speaker,
  text,
  startedAtMs,
  endedAtMs,
});

/** Hand-built: counterpart, user, counterpart, user. Ended by the user. */
const fixture: Session = {
  id: "fx",
  scenario,
  status: "ended",
  turns: [
    turn("counterpart", "Hi", 0, 1000),
    turn("user", "One", 1500, 2500),
    turn("counterpart", "Two", 3000, 4000),
    turn("user", "Three", 4500, 5500),
  ],
  giveHistory: [30, 30, 45, 45],
  moodHistory: ["neutral", "neutral", "open", "open"],
  endReason: "user_ended",
  startedAtMs: 0,
  endedAtMs: 6000,
};

describe("replayFrom", () => {
  it("restores the state just before the chosen user turn", () => {
    expect(replayFrom(fixture, 3)).toEqual({
      id: "fx",
      scenario,
      status: "awaiting_user",
      turns: fixture.turns.slice(0, 3),
      giveHistory: [30, 30, 45],
      moodHistory: ["neutral", "neutral", "open"],
      endReason: null,
      startedAtMs: 0,
      endedAtMs: null,
    });
  });

  it("replays from the first user turn", () => {
    const replayed = replayFrom(fixture, 1);
    expect(replayed.turns).toEqual([fixture.turns[0]]);
    expect(replayed.giveHistory).toEqual([30]);
    expect(replayed.moodHistory).toEqual(["neutral"]);
    expect(replayed.status).toBe("awaiting_user");
  });

  it("does not mutate its input", () => {
    const copy = structuredClone(fixture);
    const replayed = replayFrom(fixture, 1);
    expect(fixture).toEqual(copy);
    expect(replayed.turns).not.toBe(fixture.turns);
  });

  it("rejects a counterpart turn, including the opening turn", () => {
    for (const index of [0, 2]) {
      try {
        replayFrom(fixture, index);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(RehearsalError);
        expect((error as RehearsalError).code).toBe("not_a_user_turn");
      }
    }
  });

  it("rejects indexes outside the transcript", () => {
    for (const index of [-1, 4, 99, 1.5, Number.NaN]) {
      try {
        replayFrom(fixture, index);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(RehearsalError);
        expect((error as RehearsalError).code).toBe("turn_index_out_of_range");
      }
    }
  });

  it("rejects every index of an empty transcript", () => {
    const empty: Session = {
      ...fixture,
      status: "counterpart_opening",
      turns: [],
      giveHistory: [],
      moodHistory: [],
      endReason: null,
      endedAtMs: null,
    };
    expect(() => replayFrom(empty, 0)).toThrow(RehearsalError);
    try {
      replayFrom(empty, 0);
    } catch (error) {
      expect((error as RehearsalError).code).toBe("turn_index_out_of_range");
    }
  });
});

describe("replayFrom with the conversation engine", () => {
  const replies: CounterpartReply[] = [
    { reply: "Maybe.", mood: "guarded", give: 40 },
    { reply: "Go on.", mood: "open", give: 55 },
    { reply: "Hmm, fair.", mood: "open", give: 65 },
    { reply: "Deal.", mood: "warm", give: 80 },
  ];

  function play() {
    const snapshots: Session[] = [];
    let session = addOpeningTurn(createSession(scenario, { id: "e", nowMs: 0 }), {
      startedAtMs: 0,
      endedAtMs: 1000,
    });
    let t = 1000;
    replies.forEach((reply, n) => {
      if (n === 1 || n === 3) snapshots.push(structuredClone(session));
      session = addUserTurn(session, `user line ${n + 1}`, { startedAtMs: t + 500, endedAtMs: t + 1500 });
      session = addCounterpartTurn(session, reply, { startedAtMs: t + 2000, endedAtMs: t + 3000 });
      t += 3000;
    });
    return { session, snapshots };
  }

  it("restores each snapshot exactly, including currentGive", () => {
    const { session, snapshots } = play();
    expect(session.status).toBe("ended");
    expect(session.endReason).toBe("goal_reached");
    expect(snapshots).toHaveLength(2);

    const indexes = [3, 7];
    indexes.forEach((index, n) => {
      const replayed = replayFrom(session, index);
      expect(replayed).toEqual(snapshots[n]);
      expect(currentGive(replayed)).toBe(currentGive(snapshots[n] as Session));
    });
    expect(currentGive(replayFrom(session, 3))).toBe(40);
    expect(currentGive(replayFrom(session, 7))).toBe(65);
  });

  it("lets the conversation continue from a replayed session", () => {
    const { session } = play();
    const replayed = replayFrom(session, 3);
    const next = addUserTurn(replayed, "a different line", { startedAtMs: 9000, endedAtMs: 9500 });
    expect(next.status).toBe("awaiting_counterpart");
    expect(next.turns).toHaveLength(4);
    expect(next.turns[3]?.text).toBe("a different line");
    expect(next.giveHistory).toEqual([30, 30, 40, 40]);
    expect(endSession(next, 10000).endReason).toBe("user_ended");
  });
});
