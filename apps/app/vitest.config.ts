import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

/**
 * WHY THIS FILE EXISTS. Without the `@/` alias, vitest could only load modules
 * that import nothing from the app: the four original test files all test pure
 * helpers, and that was not a choice about what was worth testing so much as
 * the only thing the runner could resolve. Anything reaching a route handler, a
 * server action or the database failed at import.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/__tests__/**/*.test.ts", "app/**/__tests__/**/*.test.ts"],
  },
})
