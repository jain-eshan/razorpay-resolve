import { defineConfig } from '@playwright/test'

// Uses the Chrome already installed on the machine, so no browser download is needed.
// "snapshot" reads the static JSON from `make snapshot` (read-only screens). "talk" and "live" drive the real API on a fresh world (conversations, then the fix flow), which changes data.
export default defineConfig({
  testDir: 'e2e',
  projects: [
    { name: 'snapshot', testIgnore: /(fix|talk)\.spec/, use: { baseURL: 'http://localhost:5173', channel: 'chrome' } },
    // Both live projects share one fresh world, so they run one after the other: customers talk to the agent while the incident is open, then it is fixed.
    { name: 'talk', testMatch: /talk\.spec/, use: { baseURL: 'http://localhost:5174', channel: 'chrome' } },
    { name: 'live', testMatch: /fix\.spec/, dependencies: ['talk'], use: { baseURL: 'http://localhost:5174', channel: 'chrome' } },
  ],
  webServer: [
    { command: 'npm run dev -- --port 5173', url: 'http://localhost:5173', reuseExistingServer: true },
    { command: 'cd .. && make run-api', url: 'http://localhost:8000/health', reuseExistingServer: false, timeout: 120_000 },
    { command: 'VITE_MODE=live npm run dev -- --port 5174', url: 'http://localhost:5174', reuseExistingServer: false },
  ],
})
