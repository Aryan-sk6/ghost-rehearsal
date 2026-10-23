import type { ReactNode } from "react";

export const DISCLAIMER_TEXT =
  "Ghost Rehearsal is a practice tool. It is not therapy, coaching, legal, financial or other professional advice.";

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line px-6 py-4">
        <span className="text-lg font-semibold tracking-tight text-ink">Ghost Rehearsal</span>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">{children}</main>
      <footer className="border-t border-line px-6 py-4 text-center text-xs text-ink-muted">
        {DISCLAIMER_TEXT}
      </footer>
    </div>
  );
}
