import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

vi.stubGlobal(
  "fetch",
  vi.fn(() => {
    throw new Error("Real network calls are not allowed in tests");
  }),
);
