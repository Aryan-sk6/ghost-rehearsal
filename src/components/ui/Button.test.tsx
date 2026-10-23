import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, type ButtonVariant } from "./Button";

describe("Button", () => {
  it("defaults to type button and the primary md styling", () => {
    render(<Button>Go</Button>);
    const button = screen.getByRole("button", { name: "Go" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-variant", "primary");
    expect(button).toHaveAttribute("data-size", "md");
  });

  it("forwards an explicit type", () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute("type", "submit");
  });

  it.each<ButtonVariant>(["primary", "secondary", "danger", "ghost"])(
    "renders the %s variant",
    (variant) => {
      render(<Button variant={variant}>Label</Button>);
      expect(screen.getByRole("button", { name: "Label" })).toHaveAttribute("data-variant", variant);
    },
  );

  it("renders the lg size", () => {
    render(<Button size="lg">Big</Button>);
    expect(screen.getByRole("button", { name: "Big" })).toHaveAttribute("data-size", "lg");
  });

  it("fires onClick when enabled", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Press</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Press" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Press
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Press" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
