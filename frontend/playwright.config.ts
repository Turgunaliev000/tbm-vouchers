import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.APP_URL ?? "http://localhost:8080",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  reporter: "list",
});
