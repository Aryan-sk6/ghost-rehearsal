import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BUILTIN_SCENARIOS } from "@/scenarios/builtins";
import { ScenarioPicker } from "./ScenarioPicker";

describe("ScenarioPicker", () => {
  it("renders one card per built-in scenario plus the builder card", () => {
    render(<ScenarioPicker onPick={() => {}} />);
    expect(screen.getAllByRole("button", { name: /^Practise this:/ })).toHaveLength(5);
    for (const scenario of BUILTIN_SCENARIOS) {
      expect(screen.getByRole("heading", { name: scenario.title })).toBeInTheDocument();
      expect(screen.getByText(scenario.counterpartRole)).toBeInTheDocument();
      expect(screen.getByText(scenario.userGoal)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Difficulty 3/5")).toHaveLength(2);
    expect(screen.getAllByText("Difficulty 2/5")).toHaveLength(2);
    expect(screen.getByText("Difficulty 4/5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build your own" })).toBeInTheDocument();
  });

  it("never renders any hiddenBottomLine", () => {
    const { container } = render(<ScenarioPicker onPick={() => {}} />);
    for (const scenario of BUILTIN_SCENARIOS) {
      expect(container.textContent).not.toContain(scenario.hiddenBottomLine);
    }
  });

  it("uses a responsive one/two column grid", () => {
    const { container } = render(<ScenarioPicker onPick={() => {}} />);
    const grid = container.querySelector(".grid");
    expect(grid).toHaveClass("grid-cols-1", "md:grid-cols-2");
  });

  it("calls onPick with the right scenario", async () => {
    const onPick = vi.fn();
    render(<ScenarioPicker onPick={onPick} />);
    const card = screen.getByRole("heading", { name: "Pitch for seed funding" }).closest("div");
    expect(card).not.toBeNull();
    await userEvent.click(within(card as HTMLElement).getByRole("button", { name: /Practise this/ }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(BUILTIN_SCENARIOS.find((s) => s.id === "seed-pitch"));
  });

  it("opens the builder from the Build your own card and can cancel", async () => {
    render(<ScenarioPicker onPick={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Build your own" }));
    expect(screen.getByRole("form", { name: "Build your own scenario" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build your own" })).toBeInTheDocument();
  });
});
