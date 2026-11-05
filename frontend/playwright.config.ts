import { defineConfig } from "@playwright/test";

// PLAYWRIGHT_BASE_URL runs the suites against an already running build (docker compose on :8088, behind nginx and its CSP);
// otherwise Playwright starts the dev server on the project's own port.
const external = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "tests",
  use: { baseURL: external ?? "http://localhost:5180" },
  webServer: external ? undefined : { command: "npm run dev", url: "http://localhost:5180", reuseExistingServer: false },
});
