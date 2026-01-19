import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/ui",
  timeout: 120000,
  expect: { timeout: 15000 },
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/bracket-test.html",
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
