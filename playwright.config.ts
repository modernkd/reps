import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
  },
  webServer: {
    command:
      "pnpm build && pnpm exec vite preview --port 4173 --host 127.0.0.1",
    port: 4173,
    timeout: 240_000,
    reuseExistingServer: false,
  },
});
