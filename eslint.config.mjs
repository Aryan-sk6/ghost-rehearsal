import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "src/contracts/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "no-console": "error",
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "No persistence. Progress history in src/lib/history is the only exception." },
        { name: "sessionStorage", message: "No persistence. Progress history in src/lib/history is the only exception." },
        { name: "indexedDB", message: "No persistence. Progress history in src/lib/history is the only exception." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "document", property: "cookie", message: "No cookies." },
        { object: "window", property: "localStorage", message: "No persistence. Progress history in src/lib/history is the only exception." },
        { object: "window", property: "sessionStorage", message: "No persistence. Progress history in src/lib/history is the only exception." },
      ],
    },
  },
];

export default config;
