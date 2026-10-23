import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiKeyForm } from "./ApiKeyForm";

const START = { name: "Start rehearsing" };

describe("ApiKeyForm", () => {
  it("renders a password input, the button and the helper text", () => {
    render(<ApiKeyForm onSubmit={() => {}} />);
    expect(screen.getByLabelText("Anthropic API key")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", START)).toBeInTheDocument();
    expect(
      screen.getByText("Kept in memory for this tab only. Never stored or logged."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a message and does not submit when empty", async () => {
    const onSubmit = vi.fn();
    render(<ApiKeyForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", START));
    expect(screen.getByRole("alert")).toHaveTextContent("Paste your API key to continue.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("treats whitespace-only input as empty", async () => {
    const onSubmit = vi.fn();
    render(<ApiKeyForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Anthropic API key"), "   ");
    await userEvent.click(screen.getByRole("button", START));
    expect(screen.getByRole("alert")).toHaveTextContent("Paste your API key to continue.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a value without the sk-ant- prefix", async () => {
    const onSubmit = vi.fn();
    render(<ApiKeyForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Anthropic API key"), "sk-other-123");
    await userEvent.click(screen.getByRole("button", START));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "That doesn't look like an Anthropic key (it should start with sk-ant-).",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the trimmed key and clears the message", async () => {
    const onSubmit = vi.fn();
    render(<ApiKeyForm onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Anthropic API key");
    await userEvent.click(screen.getByRole("button", START));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.type(input, "  sk-ant-abc123  ");
    await userEvent.click(screen.getByRole("button", START));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("sk-ant-abc123");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("submits with Enter", async () => {
    const onSubmit = vi.fn();
    render(<ApiKeyForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Anthropic API key"), "sk-ant-xyz{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("sk-ant-xyz");
  });

  it("shows the rejected alert when rejected", () => {
    render(<ApiKeyForm onSubmit={() => {}} rejected />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Anthropic rejected that API key. Check it and enter it again.",
    );
  });
});
