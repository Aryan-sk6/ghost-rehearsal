import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("shows the wordmark in the header", () => {
    render(<AppShell>content</AppShell>);
    expect(screen.getByRole("banner")).toHaveTextContent("Ghost Rehearsal");
  });

  it("renders children in the main area", () => {
    render(<AppShell>page body</AppShell>);
    expect(screen.getByRole("main")).toHaveTextContent("page body");
  });

  it("always shows the exact disclaimer in the footer", () => {
    render(<AppShell>anything</AppShell>);
    expect(screen.getByRole("contentinfo").textContent).toBe(
      "Ghost Rehearsal is a practice tool. It is not therapy, coaching, legal, financial or other professional advice.",
    );
  });
});
