import path from "node:path";
import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    // Match tsconfig's "@/*" -> "./src/*" so route handlers import cleanly in tests.
    alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src") },
  },
  test: {
    // tests/api is the black-box suite against a running server (test:api).
    exclude: [...configDefaults.exclude, "tests/api/**", "tests/battery/**", "e2e/**"],
    setupFiles: ["tests/setup.ts"],
    // Every worker opens its own pg pool against Neon's free tier; too many
    // parallel files exhaust its connection budget and time out connects.
    maxWorkers: 4,
    minWorkers: 1,
    // First embedding test downloads the ONNX model (~23 MB); DB tests cross
    // the ocean to Neon. Generous timeouts keep CI stable.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
