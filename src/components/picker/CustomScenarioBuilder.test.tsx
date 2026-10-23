import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScenarioSchema } from "@/contracts/types";
import { CustomScenarioBuilder } from "./CustomScenarioBuilder";

const SUBMIT = { name: "Practise this" };

async function fillValid() {
  await userEvent.type(screen.getByLabelText("Title"), "  Ask for flexible hours ");
  await userEvent.type(screen.getByLabelText("Your goal"), "Work from home two days a week");
  await userEvent.type(screen.getByLabelText("Who they are"), "My team lead");
  await userEvent.type(screen.getByLabelText("How they behave"), " impatient ,  polite, ,evasive ");
  await userEvent.type(screen.getByLabelText("Their opening line"), "You have five minutes.");
  await userEvent.type(screen.getByLabelText("What they'd concede at most"), "One day a week");
}

describe("CustomScenarioBuilder", () => {
  it("has every labelled field and defaults difficulty to 3", () => {
    render(<CustomScenarioBuilder onPick={() => {}} />);
    for (const label of [
      "Title",
      "Your goal",
      "Who they are",
      "How they behave",
      "Their opening line",
      "What they'd concede at most",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Difficulty")).toHaveValue("3");
  });

  it("shows an inline error for each empty required field and does not submit", async () => {
    const onPick = vi.fn();
    render(<CustomScenarioBuilder onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", SUBMIT));
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByText("Title is required.")).toBeInTheDocument();
    expect(screen.getByText("Your goal is required.")).toBeInTheDocument();
    expect(screen.getByText("Who they are is required.")).toBeInTheDocument();
    expect(screen.getByText("Add at least one trait, separated by commas.")).toBeInTheDocument();
    expect(screen.getByText("Their opening line is required.")).toBeInTheDocument();
    expect(screen.getByText("What they'd concede at most is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("treats whitespace-only fields as empty", async () => {
    const onPick = vi.fn();
    render(<CustomScenarioBuilder onPick={onPick} />);
    await userEvent.type(screen.getByLabelText("Title"), "   ");
    await userEvent.type(screen.getByLabelText("How they behave"), " , , ");
    await userEvent.click(screen.getByRole("button", SUBMIT));
    expect(screen.getByText("Title is required.")).toBeInTheDocument();
    expect(screen.getByText("Add at least one trait, separated by commas.")).toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("shows a length error for an over-long title", async () => {
    render(<CustomScenarioBuilder onPick={() => {}} />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "x".repeat(81) } });
    await userEvent.click(screen.getByRole("button", SUBMIT));
    expect(screen.getByText("Title is too long (max 80).")).toBeInTheDocument();
  });

  it("submits a valid, trimmed scenario with a custom- id", async () => {
    const onPick = vi.fn();
    render(<CustomScenarioBuilder onPick={onPick} />);
    await fillValid();
    fireEvent.change(screen.getByLabelText("Difficulty"), { target: { value: "4" } });
    await userEvent.click(screen.getByRole("button", SUBMIT));
    expect(onPick).toHaveBeenCalledTimes(1);
    const scenario = onPick.mock.calls[0]?.[0];
    expect(ScenarioSchema.safeParse(scenario).success).toBe(true);
    expect(scenario.id).toMatch(/^custom-/);
    expect(scenario).toMatchObject({
      title: "Ask for flexible hours",
      counterpartTraits: ["impatient", "polite", "evasive"],
      difficulty: 4,
      hiddenBottomLine: "One day a week",
    });
  });

  it("clears errors after a valid submit and submits with Enter", async () => {
    const onPick = vi.fn();
    render(<CustomScenarioBuilder onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", SUBMIT));
    expect(screen.getByText("Title is required.")).toBeInTheDocument();
    await fillValid();
    await userEvent.type(screen.getByLabelText("Title"), "{Enter}");
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Title is required.")).not.toBeInTheDocument();
  });
});
