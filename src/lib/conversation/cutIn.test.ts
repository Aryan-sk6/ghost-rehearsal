import { describe, expect, it } from "vitest";
import { BUILTIN_SCENARIOS } from "@/scenarios/builtins";
import { CUT_IN_LINES, cutInReply } from "./cutIn";
import { addCounterpartTurn, addOpeningTurn, addUserTurn, createSession } from "./machine";

const SCENARIO = BUILTIN_SCENARIOS[0] as (typeof BUILTIN_SCENARIOS)[number];
const t = { startedAtMs: 0, endedAtMs: 1 };

describe("cutInReply", () => {
  it("is impatient, leaves give alone and uses a new line each time", () => {
    let session = addUserTurn(addOpeningTurn(createSession(SCENARIO, { id: "x", nowMs: 0 }), t), "Well, so...", t);
    const first = cutInReply(session);
    expect(first).toEqual({ reply: CUT_IN_LINES[0], mood: "impatient", give: 30 });
    session = addUserTurn(addCounterpartTurn(session, first, t), "Right, anyway...", t);
    expect(cutInReply(session).reply).toBe(CUT_IN_LINES[1]);
  });
});
