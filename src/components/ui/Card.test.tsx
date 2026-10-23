import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("renders its children", () => {
    render(<Card>Inside the card</Card>);
    expect(screen.getByText("Inside the card")).toBeInTheDocument();
  });

  it("passes through extra props", () => {
    render(<Card aria-label="Scenario card">x</Card>);
    expect(screen.getByLabelText("Scenario card")).toBeInTheDocument();
  });
});
