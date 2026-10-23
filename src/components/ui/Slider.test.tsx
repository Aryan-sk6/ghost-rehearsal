import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Slider } from "./Slider";

describe("Slider", () => {
  it("is a labelled range input from 1 to 5 showing its value", () => {
    render(<Slider label="Difficulty" value={3} onChange={() => {}} />);
    const slider = screen.getByLabelText("Difficulty");
    expect(slider).toHaveAttribute("type", "range");
    expect(slider).toHaveAttribute("min", "1");
    expect(slider).toHaveAttribute("max", "5");
    expect(slider).toHaveValue("3");
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("reports the new value as a number", () => {
    const onChange = vi.fn();
    render(<Slider label="Difficulty" value={3} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Difficulty"), { target: { value: "5" } });
    expect(onChange).toHaveBeenCalledWith(5);
  });
});
