import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests only. E2E specs live in ./e2e and are run by Playwright.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: { junit: "./test-results/unit-junit.xml" },
  },
});
