import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MIC_DENIED_COPY, describeLlmError } from "@/components/errors/errorCopy";
import { SessionScreen, type SessionScreenProps } from "./SessionScreen";

function setup(overrides: Partial<SessionScreenProps> = {}) {
  const props: SessionScreenProps = {
    title: "Ask for a raise",
    counterpartRole: "Your manager",
    turns: [
      { speaker: "counterpart", text: "Thanks for making time." },
      { speaker: "user", text: "I would like to discuss my pay." },
    ],
    mood: "guarded",
    userTurnCount: 1,
    phase: "your-turn",
    inputKind: "voice",
    mode: "push-to-talk",
    onToggleMic: vi.fn(),
    onModeChange: vi.fn(),
    onSendTyped: vi.fn(),
    onEnd: vi.fn(),
    onRetry: vi.fn(),
    onNewKey: vi.fn(),
    ...overrides,
  };
  const view = render(<SessionScreen {...props} />);
  return { props, ...view };
}

describe("SessionScreen", () => {
  it("shows the header, mood chip, transcript and headphones hint", async () => {
    const { props } = setup();
    expect(screen.getByRole("heading", { name: "Ask for a raise" })).toBeInTheDocument();
    expect(screen.getByText("Your manager")).toBeInTheDocument();
    expect(screen.getByText("Turn 2 of 12")).toBeInTheDocument();
    expect(screen.getByText("They seem guarded")).toBeInTheDocument();
    expect(screen.getByText(/Thanks for making time\./)).toBeInTheDocument();
    expect(screen.getByText(/I would like to discuss my pay\./)).toBeInTheDocument();
    expect(screen.getByText("Use headphones so the mic doesn't hear them.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your turn");
    await userEvent.click(screen.getByRole("button", { name: "End conversation" }));
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });

  it("styles counterpart bubbles left and user bubbles right", () => {
    setup();
    expect(screen.getByText(/Thanks for making time\./).closest("li")).toHaveClass("bg-raised", "mr-auto");
    expect(screen.getByText(/I would like to discuss/).closest("li")).toHaveClass(
      "bg-accent-strong/30",
      "ml-auto",
    );
  });

  it("listening: shows interim text as a pending bubble and the stop label", async () => {
    const { props } = setup({ phase: "listening", interimText: "I was thinking that" });
    expect(screen.getByRole("status")).toHaveTextContent("Listening…");
    const pending = screen.getByText("I was thinking that");
    expect(pending.closest("li")).toHaveClass("italic", "text-ink-muted");
    const mic = screen.getByRole("button", { name: "Tap when done" });
    expect(mic).toHaveAttribute("aria-pressed", "true");
    expect(mic).toBeEnabled();
    await userEvent.click(mic);
    expect(props.onToggleMic).toHaveBeenCalledTimes(1);
  });

  it("idle: mic reads Tap to speak and is not pressed", () => {
    setup({ phase: "idle" });
    const mic = screen.getByRole("button", { name: "Tap to speak" });
    expect(mic).toHaveAttribute("aria-pressed", "false");
    expect(mic).toHaveClass("size-24", "rounded-full");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("thinking: disables the mic", async () => {
    const { props } = setup({ phase: "thinking", userTurnCount: 2 });
    expect(screen.getByRole("status")).toHaveTextContent("They're thinking…");
    expect(screen.getByText("Turn 2 of 12")).toBeInTheDocument();
    const mic = screen.getByRole("button", { name: "Tap to speak" });
    expect(mic).toBeDisabled();
    await userEvent.click(mic);
    expect(props.onToggleMic).not.toHaveBeenCalled();
  });

  it("speaking: shows the status and keeps the mic available for barge-in", () => {
    setup({ phase: "speaking" });
    expect(screen.getByRole("status")).toHaveTextContent("They're speaking…");
    expect(screen.getByRole("button", { name: "Tap to speak" })).toBeEnabled();
  });

  it("continuous listening reads Tap to stop", () => {
    setup({ phase: "listening", mode: "continuous" });
    expect(screen.getByRole("button", { name: "Tap to stop" })).toBeInTheDocument();
  });

  it("toggles between push to talk and continuous", async () => {
    const { props } = setup();
    expect(screen.getByRole("button", { name: "Push to talk" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Continuous" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Continuous" }));
    expect(props.onModeChange).toHaveBeenCalledWith("continuous");
  });

  it("caps the turn counter at 12", () => {
    setup({ userTurnCount: 12, phase: "your-turn" });
    expect(screen.getByText("Turn 12 of 12")).toBeInTheDocument();
  });

  describe("typed fallback", () => {
    it("shows the textarea instead of the voice controls", () => {
      setup({ inputKind: "typed" });
      expect(screen.getByLabelText("Your reply")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Tap to speak" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Push to talk" })).not.toBeInTheDocument();
    });

    it("disables Send when empty, enables it with text, and sends trimmed text", async () => {
      const { props } = setup({ inputKind: "typed" });
      const send = screen.getByRole("button", { name: "Send" });
      expect(send).toBeDisabled();
      await userEvent.type(screen.getByLabelText("Your reply"), "  Hello there ");
      expect(send).toBeEnabled();
      await userEvent.click(send);
      expect(props.onSendTyped).toHaveBeenCalledWith("Hello there");
      expect(screen.getByLabelText("Your reply")).toHaveValue("");
    });

    it("keeps Send disabled for whitespace-only text", async () => {
      setup({ inputKind: "typed" });
      await userEvent.type(screen.getByLabelText("Your reply"), "   ");
      expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    });

    it("Enter sends and Shift+Enter makes a newline", async () => {
      const { props } = setup({ inputKind: "typed" });
      const box = screen.getByLabelText("Your reply");
      await userEvent.type(box, "line one{Shift>}{Enter}{/Shift}line two");
      expect(props.onSendTyped).not.toHaveBeenCalled();
      expect(box).toHaveValue("line one\nline two");
      await userEvent.type(box, "{Enter}");
      expect(props.onSendTyped).toHaveBeenCalledWith("line one\nline two");
    });

    it.each(["thinking", "speaking", "listening", "idle"] as const)(
      "does not send while the phase is %s",
      async (phase) => {
        const { props } = setup({ inputKind: "typed", phase });
        await userEvent.type(screen.getByLabelText("Your reply"), "hi{Enter}");
        expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
        expect(props.onSendTyped).not.toHaveBeenCalled();
      },
    );
  });

  describe("notices and errors", () => {
    it("shows the mic-denied notice with the typed fallback", () => {
      setup({ inputKind: "typed", notice: MIC_DENIED_COPY });
      expect(screen.getByText(MIC_DENIED_COPY)).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Your reply")).toBeInTheDocument();
    });

    it("shows an LLM error with a working Try again button", async () => {
      const { props } = setup({ error: describeLlmError("overloaded") });
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Anthropic is busy right now. Try again in a moment.",
      );
      await userEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(props.onRetry).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: "Enter a new key" })).not.toBeInTheDocument();
    });

    it("offers Enter a new key for key errors", async () => {
      const { props } = setup({ error: describeLlmError("invalid_key") });
      await userEvent.click(screen.getByRole("button", { name: "Enter a new key" }));
      expect(props.onNewKey).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    });

    it("shows only the error when both an error and a notice are set", () => {
      setup({ error: describeLlmError("network"), notice: MIC_DENIED_COPY });
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.queryByText(MIC_DENIED_COPY)).not.toBeInTheDocument();
    });
  });

  it("never renders the word give anywhere", () => {
    const { container } = setup({
      phase: "listening",
      interimText: "hello",
      notice: MIC_DENIED_COPY,
    });
    expect(container.textContent ?? "").not.toMatch(/give/i);
    for (const el of container.querySelectorAll("*")) {
      for (const attr of el.getAttributeNames()) {
        expect(`${attr}=${el.getAttribute(attr)}`).not.toMatch(/give/i);
      }
    }
  });
});
