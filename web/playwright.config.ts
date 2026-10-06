import { defineConfig } from '@playwright/test'

// Uses the Chrome already installed on the machine, so no browser download is needed.
// "snapshot" reads the static JSON from `make snapshot` (R1 screens). "live" drives the real API on a fresh world (R2 fix flow, which changes data).
export default defineConfig({
  testDir: 'e2e',
  projects: [
    { name: 'snapshot', testIgnore: /fix\.spec/, use: { baseURL: 'http://localhost:5173', channel: 'chrome' } },
    { name: 'live', testMatch: /fix\.spec/, use: { baseURL: 'http://localhost:5174', channel: 'chrome' } },
  ],
  webServer: [
    { command: 'npm run dev -- --port 5173', url: 'http://localhost:5173', reuseExistingServer: true },
    { command: 'cd .. && make run-api', url: 'http://localhost:8000/health', reuseExistingServer: false, timeout: 120_000 },
    { command: 'VITE_MODE=live npm run dev -- --port 5174', url: 'http://localhost:5174', reuseExistingServer: false },
  ],
})
