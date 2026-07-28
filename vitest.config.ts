import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Mirrors the "@/*" path alias from tsconfig.json so tests can import values
// (not just types) from aliased modules.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
})
