import { defineConfig } from '@playwright/test'

// Uses the Chrome already installed on the machine, so no browser download is needed.
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5173', channel: 'chrome' },
  webServer: { command: 'npm run dev -- --port 5173', url: 'http://localhost:5173', reuseExistingServer: true },
})
