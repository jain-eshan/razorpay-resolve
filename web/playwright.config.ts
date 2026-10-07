import { defineConfig } from '@playwright/test'

// Uses the Chrome already installed on the machine, so no browser download is needed.
// "snapshot" reads the static JSON from `make snapshot` (read-only screens). "talk" and "live" drive the real API on a fresh world (conversations, then the fix flow), which changes data.
export default defineConfig({
  testDir: 'e2e',
  // CI runners are slower than a laptop and the long walkthroughs (Hero A, Hero B) take about 7 s locally. 60 s keeps them from failing on a busy runner.
  timeout: 60_000,
  // CI runners have 2 CPUs and one worker left one of them idle. Two workers cut the wall time; the live projects still run one after the other (talk, then live).
  workers: process.env.CI ? 2 : undefined,
  projects: [
    { name: 'snapshot', testIgnore: /(fix|talk)\.spec/, use: { baseURL: 'http://localhost:5173', channel: 'chrome' } },
    // Both live projects share one fresh world, so they run one after the other: customers talk to the agent while the incident is open, then it is fixed.
    { name: 'talk', testMatch: /talk\.spec/, use: { baseURL: 'http://localhost:5174', channel: 'chrome' } },
    { name: 'live', testMatch: /fix\.spec/, dependencies: ['talk'], use: { baseURL: 'http://localhost:5174', channel: 'chrome' } },
  ],
  webServer: [
    // CI serves a production build: it is about twice as fast as the dev server, which matters on a slow runner (Hero A takes 4 s built, 6 s on the dev server, 5 times that on CI).
    // Locally the dev server is reused if it is already up. Port 5173 is shared with other worktrees, so check that it is serving this folder before trusting a local run.
    { command: process.env.CI ? 'npm run build && npm run preview -- --port 5173 --strictPort' : 'npm run dev -- --port 5173', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI, timeout: 120_000 },
    { command: 'cd .. && make run-api', url: 'http://localhost:8000/health', reuseExistingServer: false, timeout: 120_000 },
    { command: 'VITE_MODE=live npm run dev -- --port 5174', url: 'http://localhost:5174', reuseExistingServer: false },
  ],
})
