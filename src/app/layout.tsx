import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ghost Rehearsal",
  description: "Practise a hard conversation against a voice AI, then get feedback.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-canvas text-ink font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
