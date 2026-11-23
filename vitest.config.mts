import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    // Los tests que escanean archivos (p. ej. selects-nativos) superan los
    // 5 s por defecto en Windows por el antivirus; les damos margen.
    testTimeout: 30000,
    include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    // El humo de Playwright vive en tests/e2e y tiene su propio runner.
    // El ticket 80 mm lanza Chromium y Poppler: corre con `pnpm test:pdf`.
    exclude: ["node_modules", "dist", ".next", "tests/e2e/**", "src/lib/pos/ticket-pdf.test.tsx"],
  },
});
