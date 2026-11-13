import path from "node:path";
import { defineConfig } from "vitest/config";

// Kept apart from vite.config.ts so the app build never type-checks against vitest's bundled vite.
// Unit tests only; the Playwright specs in e2e/ run with `npm run test:e2e`.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  test: { include: ["src/**/*.test.ts"] },
});
