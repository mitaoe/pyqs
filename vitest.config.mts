import { fileURLToPath } from "node:url"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "e2e/**"],
    environment: "node",
  },
})
