import { defineConfig } from "vitest/config";

// Carril lento del contrato de ticket (MSG-22): genera PDFs reales con
// Chromium y los mide con Poppler. Vive aparte de `pnpm test` para que el
// suite rápido no instale navegador ni herramientas PDF.
// Requiere Chromium Playwright y poppler-utils; ver skill `ticket-80mm`.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    testTimeout: 120000,
    include: ["src/lib/pos/ticket-pdf.test.tsx"],
  },
});
