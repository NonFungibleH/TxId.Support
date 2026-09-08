import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

/**
 * apps/web had no tests at all until 2026-09-08, and the gap cost something
 * real: the LayerZero card silently vanished from /chains because a line-range
 * edit removed it alongside its neighbour, and nothing anywhere noticed. The
 * page renders its cross-chain section behind `crossChain.length > 0`, so the
 * section simply stopped existing rather than breaking.
 */
export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, ".") } },
})
