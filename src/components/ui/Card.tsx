import type { HTMLAttributes } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...rest }: CardProps) {
  const classes = ["rounded-card border border-line bg-surface p-6", className]
    .filter(Boolean)
    .join(" ");
  return <div className={classes} {...rest} />;
}
