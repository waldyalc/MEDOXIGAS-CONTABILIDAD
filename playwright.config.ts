import { defineConfig, devices } from "@playwright/test";

// `E2E_BASE_URL` permite apuntar a preview de Vercel; por defecto el dev local.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "html" : "list",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  // En CI levanta la app en producción; en local reutiliza la que ya corre.
  webServer: {
    command: "pnpm start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
