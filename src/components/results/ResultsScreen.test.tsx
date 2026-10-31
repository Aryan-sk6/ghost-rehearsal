import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { describeLlmError } from "@/components/errors/errorCopy";
import type { EndReason } from "@/contracts/types";
import { ANALYSIS, GIVE_HISTORY, METRICS, MOOD_HISTORY, SCENARIO, TURNS } from "./fixtures";
import { ResultsScreen, type AnalysisState, type ResultsScreenProps } from "./ResultsScreen";

const NOW = new Date(2026, 9, 23, 14, 30);

function setup(analysis: AnalysisState, overrides: Partial<ResultsScreenProps> = {}) {
  const props: ResultsScreenProps = {
    scenario: SCENARIO,
    turns: TURNS,
    giveHistory: GIVE_HISTORY,
    moodHistory: MOOD_HISTORY,
    endReason: "user_ended",
    metrics: METRICS,
    analysis,
    onRetryFrom: vi.fn(),
    onRetryAnalysis: vi.fn(),
    onNewKey: vi.fn(),
    onRestart: vi.fn(),
    now: () => NOW,
    ...overrides,
  };
  render(<ResultsScreen {...props} />);
  return props;
}

const READY: AnalysisState = { status: "ready", analysis: ANALYSIS };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ResultsScreen", () => {
  it.each<[EndReason, string]>([
    ["goal_reached", "They came round. You reached your goal."],
    ["give_zero", "They shut the conversation down."],
    ["turn_cap", "You hit the 12-turn limit."],
    ["user_ended", "You ended the conversation."],
  ])("shows the %s end reason line", (endReason, copy) => {
    setup(READY, { endReason });
    expect(screen.getByText(copy)).toBeInTheDocument();
  });

  it("ready: shows the summary, four scores and the bottom line", () => {
    setup(READY);
    expect(screen.getByText("You stayed polite but gave way too early.")).toBeInTheDocument();
    const scores = within(screen.getByRole("list", { name: "Scores" }));
    for (const [label, value] of [
      ["Clarity", "7/10"],
      ["Confidence", "4/10"],
      ["Handling pushback", "5/10"],
      ["Outcome", "3/10"],
    ] as const) {
      expect(scores.getByText(label)).toBeInTheDocument();
      expect(scores.getByText(value)).toBeInTheDocument();
    }
    expect(screen.getByText("What they were ready to concede")).toBeInTheDocument();
    expect(screen.getByText(SCENARIO.hiddenBottomLine)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the metrics with the typing note", () => {
    setup(READY);
    const metric = (label: string) => screen.getByText(label).nextElementSibling;
    expect(metric("Words per minute")).toHaveTextContent("142.5");
    expect(metric("Talk ratio")).toHaveTextContent("46%");
    expect(metric("Filler words")).toHaveTextContent("2");
    expect(metric("Hedges")).toHaveTextContent("3");
    expect(metric("Longest pause")).toHaveTextContent("2.3s");
    expect(metric("Conceded first")).toHaveTextContent("1");
    expect(screen.getByText("Pace and pauses are rough when you type.")).toBeInTheDocument();
  });

  it("lists three moments with 1-based user turn numbers and quotes", () => {
    setup(READY);
    const lost = within(screen.getByRole("region", { name: "Where you lost ground" }));
    expect(lost.getAllByText(/^Your turn \d$/).map((el) => el.textContent)).toEqual([
      "Your turn 1",
      "Your turn 2",
      "Your turn 3",
    ]);
    expect(screen.getByText("I think maybe I deserve a raise.")).toBeInTheDocument();
    expect(screen.getByText("Hedging weakened your ask.")).toBeInTheDocument();
    expect(screen.getAllByText(/Why it hurt/)).toHaveLength(3);
    expect(screen.getByText("Try instead: Let's set a date this week to decide.")).toBeInTheDocument();
  });

  it("Retry from here fires with each moment's turnIndex", async () => {
    const props = setup(READY);
    const buttons = screen.getAllByRole("button", { name: "Retry from here" });
    expect(buttons).toHaveLength(3);
    await userEvent.click(buttons[2] as HTMLElement);
    await userEvent.click(buttons[0] as HTMLElement);
    expect(props.onRetryFrom).toHaveBeenNthCalledWith(1, 5);
    expect(props.onRetryFrom).toHaveBeenNthCalledWith(2, 1);
    expect(buttons[0]).toHaveAccessibleDescription("Your turn 1");
  });

  it("loading: shows the status and no scores or moments", () => {
    setup({ status: "loading" });
    expect(screen.getByRole("status")).toHaveTextContent("Writing your feedback…");
    expect(screen.queryByRole("list", { name: "Scores" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry from here" })).not.toBeInTheDocument();
    expect(screen.getByText("Words per minute")).toBeInTheDocument();
  });

  it("error: shows one alert with a working Try again", async () => {
    const props = setup({ status: "error", error: describeLlmError("overloaded") });
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Anthropic is busy right now.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(props.onRetryAnalysis).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("list", { name: "Scores" })).not.toBeInTheDocument();
  });

  it("error with a key problem offers Enter a new key", async () => {
    const props = setup({ status: "error", error: describeLlmError("invalid_key") });
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enter a new key" }));
    expect(props.onNewKey).toHaveBeenCalledTimes(1);
  });

  it("too short: shows the message, keeps metrics, hides moments", () => {
    setup({ status: "too-short" });
    expect(
      screen.getByText("Have at least 3 exchanges to get feedback on where you lost ground."),
    ).toBeInTheDocument();
    expect(screen.getByText("Words per minute")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry from here" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Scores" })).not.toBeInTheDocument();
  });

  it("Practise another calls onRestart", async () => {
    const props = setup(READY);
    await userEvent.click(screen.getByRole("button", { name: "Practise another" }));
    expect(props.onRestart).toHaveBeenCalledTimes(1);
  });

  it("downloads the transcript through a Blob and object URL", async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(`${this.download}|${this.href}`);
    });

    setup(READY);
    await userEvent.click(screen.getByRole("button", { name: "Download transcript (JSON)" }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe("application/json");
    expect(downloads).toEqual(["ghost-rehearsal-salary-raise-20261023-1430.json|blob:fake"]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    vi.unstubAllGlobals();
  });
});

describe("ResultsScreen reveal", () => {
  it("shows how willing they were, each turn's effect and the best and worst moves", () => {
    setup(READY);
    const section = within(screen.getByRole("region", { name: "What they were thinking" }));
    expect(
      section.getByText(
        "Their willingness ended at 20 out of 100, down 10 from 30. They needed 80 to say yes.",
      ),
    ).toBeInTheDocument();
    expect(section.getByRole("img", { name: /from 30 to 20 out of 100/ })).toBeInTheDocument();
    const rows = Array.from(
      section.getByRole("list", { name: "How each of your turns moved them" }).children,
    ) as HTMLElement[];
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Down 5");
    expect(rows[0]).toHaveTextContent("Then: Guarded");
    expect(rows[1]).toHaveTextContent("Cost you most");
    expect(rows[1]).toHaveTextContent("Down 10");
    expect(rows[2]).toHaveTextContent("Best move");
    expect(rows[2]).toHaveTextContent("Up 5");
    expect(within(rows[0]!).getByRole("list", { name: "What this turn did" })).toHaveTextContent(
      "Hedged: “I think maybe”",
    );
    expect(rows[1]).toHaveTextContent("Gave ground: “Fair enough”");
    expect(within(rows[2]!).queryByRole("list", { name: "What this turn did" })).not.toBeInTheDocument();
    expect(section.getByText(SCENARIO.hiddenBottomLine)).toBeInTheDocument();
  });
});

describe("ResultsScreen pauses", () => {
  it("tags a long pause after pushback that ended in giving ground", () => {
    // Turn 3 ("Fair enough, never mind.") now starts 6.2s after their reply ended.
    const turns = TURNS.map((t, i) => (i === 3 ? { ...t, startedAtMs: 4800 + 6200 } : t));
    setup(READY, { turns });
    const rows = Array.from(
      screen.getByRole("list", { name: "How each of your turns moved them" }).children,
    ) as HTMLElement[];
    expect(rows[1]).toHaveTextContent("Paused 6.2s after pushback, then gave ground");
    expect(rows[0]).not.toHaveTextContent("Paused");
  });
});
