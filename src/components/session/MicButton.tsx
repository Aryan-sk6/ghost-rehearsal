import type { SpeechMode } from "@/contracts/speech";
import type { SessionPhase } from "./SessionScreen";

export interface MicButtonProps {
  phase: SessionPhase;
  mode: SpeechMode;
  onClick: () => void;
}

export function micLabel(phase: SessionPhase, mode: SpeechMode): string {
  if (phase !== "listening") return "Tap to speak";
  return mode === "push-to-talk" ? "Tap when done" : "Tap to stop";
}

export function MicButton({ phase, mode, onClick }: MicButtonProps) {
  const listening = phase === "listening";
  const classes = [
    "flex size-24 items-center justify-center rounded-full p-3 text-center text-sm font-medium",
    "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    "disabled:cursor-not-allowed disabled:opacity-50",
    listening ? "bg-danger text-canvas" : "bg-accent text-canvas hover:bg-accent-strong",
  ].join(" ");
  return (
    <button
      type="button"
      aria-pressed={listening}
      disabled={phase === "thinking"}
      onClick={onClick}
      className={classes}
    >
      {micLabel(phase, mode)}
    </button>
  );
}
