import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './src/tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
  },
  webServer: {
    command: 'DISABLE_TANSTACK_DEVTOOLS=1 pnpm reps -- --port 4173 --host 127.0.0.1',
    port: 4173,
    timeout: 120_000,
    reuseExistingServer: false,
  },
})
