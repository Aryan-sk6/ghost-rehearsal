import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MIC_DENIED_COPY, VOICE_UNSUPPORTED_COPY } from "@/components/errors/errorCopy";
import { LlmError } from "@/contracts/errors";
import { FakeLlmClient, FakeSpeechInput, FakeSpeechOutput, type FakeLlmStep } from "@/contracts/fakes";
import type { SpeechBundle } from "@/contracts/speech";
import { BUILTIN_SCENARIOS } from "@/scenarios/builtins";
import type { RehearsalDeps } from "./deps";
import { RehearsalApp } from "./RehearsalApp";

const SALARY = BUILTIN_SCENARIOS.find((s) => s.id === "salary-raise");
if (!SALARY) throw new Error("salary-raise scenario missing");

const KEY = "sk-ant-test-key";

function reply(text: string, give: number, mood = "open"): string {
  return JSON.stringify({ reply: text, mood, give });
}

const ANALYSIS_JSON = JSON.stringify({
  scores: { clarity: 7, confidence: 6, handlingPushback: 5, outcome: 4 },
  summary: "You held your ground early, then softened.",
  lostGround: [1, 3, 5].map((turnIndex) => ({
    turnIndex,
    userSaid: "ignored, replaced by the real text",
    whyItHurt: `Why turn ${turnIndex} hurt.`,
    strongerLine: `Stronger line ${turnIndex}.`,
  })),
});

interface Harness {
  deps: RehearsalDeps;
  llm: FakeLlmClient;
  input: FakeSpeechInput;
  output: FakeSpeechOutput;
  createLlm: ReturnType<typeof vi.fn>;
}

function harness(steps: readonly FakeLlmStep[], recognition = true): Harness {
  const llm = new FakeLlmClient(steps);
  const input = new FakeSpeechInput("push-to-talk");
  const output = new FakeSpeechOutput();
  let clock = 0;
  let ids = 0;
  const bundle: SpeechBundle = { input, output, support: { recognition, synthesis: true } };
  const createLlm = vi.fn((apiKey: string) => {
    void apiKey;
    return llm;
  });
  const deps: RehearsalDeps = {
    createLlm,
    createSpeech: () => bundle,
    now: () => (clock += 100),
    newId: () => `session-${(ids += 1)}`,
  };
  return { deps, llm, input, output, createLlm };
}

async function enterKeyAndPick(key = KEY) {
  await userEvent.type(screen.getByLabelText("Anthropic API key"), key);
  await userEvent.click(screen.getByRole("button", { name: "Start rehearsing" }));
  await userEvent.click(screen.getByRole("button", { name: `Practise this: ${SALARY?.title}` }));
  await userEvent.click(screen.getByRole("button", { name: "Start the conversation" }));
  await waitFor(() => expect(screen.getByText("Your turn")).toBeInTheDocument());
}

async function say(input: FakeSpeechInput, text: string, expectedReply: string) {
  act(() => {
    input.emitUtterance({ text, startedAtMs: 1000, endedAtMs: 2000 });
  });
  expect(await screen.findByText(expectedReply)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("Your turn")).toBeInTheDocument());
}

describe("RehearsalApp", () => {
  it("runs the full flow: key, pick, three turns, end, results, retry from here", async () => {
    const h = harness([
      reply("Budgets are tight this year.", 40),
      reply("I hear you, but it is hard.", 45),
      reply("Let me think about that.", 55),
      ANALYSIS_JSON,
    ]);
    render(<RehearsalApp deps={h.deps} />);

    await enterKeyAndPick();
    expect(h.output.spoken).toEqual([SALARY?.openingLine]);
    expect(screen.getByText(SALARY?.openingLine ?? "")).toBeInTheDocument();
    expect(screen.getByText("Turn 1 of 12")).toBeInTheDocument();

    await say(h.input, "I would like a ten percent raise.", "Budgets are tight this year.");
    expect(h.createLlm).toHaveBeenCalledTimes(1);
    expect(h.createLlm).toHaveBeenCalledWith(KEY);
    await say(h.input, "My results justify it.", "I hear you, but it is hard.");
    await say(h.input, "Can we agree a number today?", "Let me think about that.");
    expect(h.output.spoken).toHaveLength(4);
    expect(screen.getByText("They seem open")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "End conversation" }));

    expect(await screen.findByText("You ended the conversation.")).toBeInTheDocument();
    expect(await screen.findByText("You held your ground early, then softened.")).toBeInTheDocument();
    expect(screen.getByText("7/10")).toBeInTheDocument();
    expect(screen.getByText("Words per minute")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Retry from here" })).toHaveLength(3);
    const lost = within(screen.getByRole("region", { name: "Where you lost ground" }));
    expect(lost.getByText("Your turn 1")).toBeInTheDocument();
    expect(lost.getByText("I would like a ten percent raise.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "What they were thinking" })).toBeInTheDocument();
    expect(h.llm.calls.map((c) => c.purpose)).toEqual([
      "counterpart",
      "counterpart",
      "counterpart",
      "analysis",
    ]);

    // Retry from the second moment (turn index 3): the opening is not replayed.
    await userEvent.click(screen.getAllByRole("button", { name: "Retry from here" })[1] as HTMLElement);
    expect(await screen.findByRole("heading", { name: SALARY?.title ?? "" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Your turn")).toBeInTheDocument());
    expect(screen.getByText(SALARY?.openingLine ?? "")).toBeInTheDocument();
    expect(screen.getByText("I would like a ten percent raise.")).toBeInTheDocument();
    expect(screen.getByText("Budgets are tight this year.")).toBeInTheDocument();
    expect(screen.queryByText("My results justify it.")).not.toBeInTheDocument();
    expect(screen.queryByText("I hear you, but it is hard.")).not.toBeInTheDocument();
    expect(screen.getByText("Turn 2 of 12")).toBeInTheDocument();
    expect(h.output.spoken).toHaveLength(4);
  });

  it("compares a retried turn with the original after the redo ends", async () => {
    const h = harness([
      reply("Budgets are tight this year.", 40),
      reply("I hear you, but it is hard.", 45),
      reply("Let me think about that.", 55),
      ANALYSIS_JSON,
      reply("That is a fair case.", 52),
    ]);
    render(<RehearsalApp deps={h.deps} />);
    await enterKeyAndPick();
    await say(h.input, "I would like a ten percent raise.", "Budgets are tight this year.");
    await say(h.input, "My results justify it.", "I hear you, but it is hard.");
    await say(h.input, "Can we agree a number today?", "Let me think about that.");
    await userEvent.click(screen.getByRole("button", { name: "End conversation" }));
    expect(await screen.findByText("You held your ground early, then softened.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Your retry/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Retry from here" })[1] as HTMLElement);
    await waitFor(() => expect(screen.getByText("Your turn")).toBeInTheDocument());
    await say(h.input, "I'd like 10% because I led the launch.", "That is a fair case.");
    await userEvent.click(screen.getByRole("button", { name: "End conversation" }));

    const card = within(await screen.findByRole("region", { name: "Your retry of turn 2" }));
    expect(card.getByText("Your new line moved them 7 points more than before.")).toBeInTheDocument();
    expect(card.getByText("“My results justify it.”")).toBeInTheDocument();
    expect(card.getByText("“I'd like 10% because I led the launch.”")).toBeInTheDocument();
    expect(card.getByText("Started: named a number")).toBeInTheDocument();
    expect(card.getByText("Started: gave a reason")).toBeInTheDocument();
    expect(card.getByText("They ended at 52 out of 100 this time, 55 before.")).toBeInTheDocument();

    // A new scenario forgets the retry.
    await userEvent.click(screen.getByRole("button", { name: "Practise another" }));
    expect(screen.queryByRole("region", { name: /Your retry/ })).not.toBeInTheDocument();
  });

  it("checks the prep plan against what was said, and keeps it for a repeat", async () => {
    const h = harness([
      reply("Budgets are tight this year.", 40),
      reply("Hmm, maybe.", 35),
      reply("I can do that.", 50),
    ]);
    render(<RehearsalApp deps={h.deps} />);
    await userEvent.type(screen.getByLabelText("Anthropic API key"), KEY);
    await userEvent.click(screen.getByRole("button", { name: "Start rehearsing" }));
    await userEvent.click(screen.getByRole("button", { name: `Practise this: ${SALARY?.title}` }));

    expect(screen.getByRole("heading", { name: "Take 30 seconds to plan" })).toBeInTheDocument();
    expect(h.output.spoken).toEqual([]);
    expect(document.body.textContent).not.toContain(SALARY?.hiddenBottomLine);
    await userEvent.type(screen.getByLabelText("What will you ask for?"), "A 10% raise");
    await userEvent.type(screen.getByLabelText("What’s the least you’d accept?"), "6%");
    await userEvent.click(screen.getByRole("button", { name: "Start the conversation" }));
    await waitFor(() => expect(screen.getByText("Your turn")).toBeInTheDocument());

    await say(h.input, "Could I get 8%?", "Budgets are tight this year.");
    await say(h.input, "What about 5%?", "Hmm, maybe.");
    await userEvent.click(screen.getByRole("button", { name: "End conversation" }));

    const card = within(await screen.findByRole("region", { name: "Your plan against what you said" }));
    expect(card.getByText("A 10% raise")).toBeInTheDocument();
    expect(card.getByText("You planned 10% but opened with 8%, a weaker ask than planned.")).toBeInTheDocument();
    expect(
      card.getByText("In your turn 2 you offered 5%, past the 6% you said you'd walk away at."),
    ).toBeInTheDocument();
    expect(h.llm.calls.map((c) => c.purpose)).toEqual(["counterpart", "counterpart"]);

    // Practising the same scenario again starts with the plan filled in.
    await userEvent.click(screen.getByRole("button", { name: "Practise another" }));
    await userEvent.click(screen.getByRole("button", { name: `Practise this: ${SALARY?.title}` }));
    expect(screen.getByLabelText("What will you ask for?")).toHaveValue("A 10% raise");

    // "Choose another" goes back without starting anything.
    await userEvent.click(screen.getByRole("button", { name: "Choose another" }));
    expect(screen.getByRole("heading", { name: "Choose a conversation to rehearse" })).toBeInTheDocument();
    expect(h.output.spoken).toHaveLength(3);
  });

  it("shows no plan card when prep was left blank", async () => {
    const h = harness([reply("Budgets are tight this year.", 40)]);
    render(<RehearsalApp deps={h.deps} />);
    await enterKeyAndPick();
    await say(h.input, "I would like a raise.", "Budgets are tight this year.");
    await userEvent.click(screen.getByRole("button", { name: "End conversation" }));
    expect(await screen.findByText("You ended the conversation.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your plan against what you said" })).not.toBeInTheDocument();
  });

  it("never shows the hidden bottom line before results", async () => {
    const h = harness([reply("Budgets are tight this year.", 40)]);
    const { container } = render(<RehearsalApp deps={h.deps} />);
    await enterKeyAndPick();
    await say(h.input, "I would like a raise.", "Budgets are tight this year.");
    expect(container.textContent).not.toContain(SALARY?.hiddenBottomLine);
  });

  it("shows the too-short message and skips the analysis call after one turn", async () => {
    const h = harness([reply("Budgets are tight this year.", 40)]);
    render(<RehearsalApp deps={h.deps} />);
    await enterKeyAndPick();
    await say(h.input, "I would like a raise.", "Budgets are tight this year.");
    await userEvent.click(screen.getByRole("button", { name: "End conversation" }));
    expect(
      await screen.findByText("Have at least 3 exchanges to get feedback on where you lost ground."),
    ).toBeInTheDocument();
    expect(screen.getByText("Words per minute")).toBeInTheDocument();
    expect(h.llm.calls).toHaveLength(1);
  });

  it("returns to the key screen on a rejected key, keeps the session, and resumes with a new key", async () => {
    const h = harness([new LlmError("invalid_key", "bad"), reply("Budgets are tight this year.", 40)]);
    render(<RehearsalApp deps={h.deps} />);
    await enterKeyAndPick();

    act(() => {
      h.input.emitUtterance({ text: "I would like a raise.", startedAtMs: 1000, endedAtMs: 2000 });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Anthropic rejected that API key. Check it and enter it again.",
    );
    expect(screen.getByLabelText("Anthropic API key")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Anthropic API key"), "sk-ant-second-key");
    await userEvent.click(screen.getByRole("button", { name: "Start rehearsing" }));

    expect(await screen.findByText("Budgets are tight this year.")).toBeInTheDocument();
    expect(screen.getByText("I would like a raise.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(h.createLlm).toHaveBeenLastCalledWith("sk-ant-second-key");
    expect(h.output.spoken).toEqual([SALARY?.openingLine, "Budgets are tight this year."]);
  });

  it("shows other LLM errors with Try again, keeping the session unchanged", async () => {
    const h = harness([new LlmError("overloaded", "busy"), reply("Budgets are tight this year.", 40)]);
    render(<RehearsalApp deps={h.deps} />);
    await enterKeyAndPick();

    act(() => {
      h.input.emitUtterance({ text: "I would like a raise.", startedAtMs: 1000, endedAtMs: 2000 });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Anthropic is busy right now. Try again in a moment.",
    );
    expect(screen.getByText("I would like a raise.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Budgets are tight this year.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByText("I would like a raise.")).toHaveLength(1);
  });

  it("switches to typed input with the mic-denied notice, and typed replies work", async () => {
    const h = harness([reply("Budgets are tight this year.", 40)]);
    render(<RehearsalApp deps={h.deps} />);
    await enterKeyAndPick();

    await userEvent.click(screen.getByRole("button", { name: "Tap to speak" }));
    expect(h.input.startCalls).toBe(1);
    act(() => {
      h.input.emitError({ kind: "not-allowed", message: "denied" });
      h.input.emitEnd("error");
    });

    expect(await screen.findByText(MIC_DENIED_COPY)).toBeInTheDocument();
    const box = screen.getByLabelText("Your reply");
    await userEvent.type(box, "I would like a raise.");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Budgets are tight this year.")).toBeInTheDocument();
    expect(screen.getByText("I would like a raise.")).toBeInTheDocument();
  });

  it("uses typed input and the unsupported copy when voice recognition is missing", async () => {
    const h = harness([], false);
    render(<RehearsalApp deps={h.deps} />);
    await enterKeyAndPick();
    expect(screen.getByText(VOICE_UNSUPPORTED_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText("Your reply")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tap to speak" })).not.toBeInTheDocument();
  });

  it("pressing the mic cancels the counterpart's playback", async () => {
    const llm = new FakeLlmClient([reply("Budgets are tight this year.", 40)]);
    const input = new FakeSpeechInput();
    const output = new FakeSpeechOutput({ autoFinish: false });
    const deps: RehearsalDeps = {
      createLlm: () => llm,
      createSpeech: () => ({ input, output, support: { recognition: true, synthesis: true } }),
      now: () => 0,
      newId: () => "s1",
    };
    render(<RehearsalApp deps={deps} />);
    await userEvent.type(screen.getByLabelText("Anthropic API key"), KEY);
    await userEvent.click(screen.getByRole("button", { name: "Start rehearsing" }));
    await userEvent.click(screen.getByRole("button", { name: `Practise this: ${SALARY?.title}` }));
    await userEvent.click(screen.getByRole("button", { name: "Start the conversation" }));

    // The opening line is still being spoken; pressing the mic cuts it off.
    await waitFor(() => expect(output.isSpeaking()).toBe(true));
    await userEvent.click(screen.getByRole("button", { name: "Tap to speak" }));
    expect(output.cancelCalls).toBe(1);
    expect(input.startCalls).toBe(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "Tap when done" })).toBeInTheDocument());
  });

  it("barge-in cancels playback when the user starts speaking", async () => {
    const llm = new FakeLlmClient([reply("Budgets are tight this year.", 40)]);
    const input = new FakeSpeechInput();
    const output = new FakeSpeechOutput({ autoFinish: false });
    const deps: RehearsalDeps = {
      createLlm: () => llm,
      createSpeech: () => ({ input, output, support: { recognition: true, synthesis: true } }),
      now: () => 0,
      newId: () => "s1",
    };
    render(<RehearsalApp deps={deps} />);
    await userEvent.type(screen.getByLabelText("Anthropic API key"), KEY);
    await userEvent.click(screen.getByRole("button", { name: "Start rehearsing" }));
    await userEvent.click(screen.getByRole("button", { name: `Practise this: ${SALARY?.title}` }));
    await userEvent.click(screen.getByRole("button", { name: "Start the conversation" }));
    await waitFor(() => expect(output.isSpeaking()).toBe(true));
    act(() => input.emitSpeechStart());
    expect(output.cancelCalls).toBe(1);
    await waitFor(() => expect(screen.getByText("Your turn")).toBeInTheDocument());
  });
});
