import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert, type AlertTone } from "./Alert";

describe("Alert", () => {
  it("has role alert for the error tone", () => {
    render(<Alert tone="error">Something broke</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Something broke");
  });

  it.each<AlertTone>(["warning", "info"])("does not use role alert for %s", (tone) => {
    render(<Alert tone={tone}>Heads up</Alert>);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("data-tone", tone);
  });

  it("defaults to info", () => {
    render(<Alert>Note</Alert>);
    expect(screen.getByRole("status")).toHaveAttribute("data-tone", "info");
  });
});
