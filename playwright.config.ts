import { defineConfig, devices } from "@playwright/test";
import webpush from "web-push";

// Production build against the throwaway database from scripts/with-test-db.sh (ADR 0013).
const PORT = Number(process.env.E2E_PORT ?? 3987);
const BASE = `http://localhost:${PORT}`;
const vapid = webpush.generateVAPIDKeys();

export const ADMIN = { email: "admin@e2e.test", password: "e2e-password" };

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE, trace: "retain-on-failure" },
  projects: [
    {
      name: "laptop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } },
      testIgnore: /phone\.spec/,
    },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /phone\.spec/ },
  ],
  webServer: {
    command: "bun run build && bun server.ts",
    url: `${BASE}/healthz`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      NODE_ENV: "production",
      PORT: String(PORT),
      PUBLIC_URL: BASE,
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e",
      AUTH_RATE_LIMIT: "false",
      ADMIN_EMAIL: ADMIN.email,
      ADMIN_PASSWORD: ADMIN.password,
      ADMIN_NAME: "E2E Admin",
      VAPID_PUBLIC_KEY: vapid.publicKey,
      VAPID_PRIVATE_KEY: vapid.privateKey,
    },
  },
});
