import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.stubGlobal(
  "fetch",
  vi.fn(() => {
    throw new Error("Real network calls are not allowed in tests");
  }),
);
