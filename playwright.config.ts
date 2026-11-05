import { defineConfig, devices } from "@playwright/test";

// End-to-end tests for the Reader. Starts the web app and the API (demo mode unless .env has a key).
// It runs on its own ports (5199 web, 8799 API), so a dev server you have open is never reused:
// that one has your real keys. Set PW_CHROMIUM_PATH to use an already-installed Chromium instead of `npx playwright install chromium`.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5199",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5199",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // Offline: no dictionary or web fetches, and Claude runs in demo mode, so tests are fast and repeatable.
    env: { WEB_PORT: "5199", PORT: "8799", ANTHROPIC_API_KEY: "", READING_DESK_OFFLINE: "1", VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", REQUIRE_SIGN_IN: "" },
  },
});
