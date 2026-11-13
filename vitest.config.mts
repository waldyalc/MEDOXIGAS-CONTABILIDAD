import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    // El humo de Playwright vive en tests/e2e y tiene su propio runner.
    exclude: ["node_modules", "dist", ".next", "tests/e2e/**"],
  },
});
