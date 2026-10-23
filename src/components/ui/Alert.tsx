import type { HTMLAttributes } from "react";

export type AlertTone = "error" | "warning" | "info";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
}

const TONE_CLASSES: Record<AlertTone, string> = {
  error: "border-danger text-danger",
  warning: "border-warning text-warning",
  info: "border-accent text-ink",
};

export function Alert({ tone = "info", className, ...rest }: AlertProps) {
  const classes = [
    "rounded-card border bg-surface px-4 py-3 text-sm",
    TONE_CLASSES[tone],
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      data-tone={tone}
      className={classes}
      {...rest}
    />
  );
}
