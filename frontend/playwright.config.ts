import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests that drive the real app in a real browser against a real
 * backend — see e2e/full-trip.spec.ts and e2e/budget-loop.spec.ts. Unlike the pytest
 * and Vitest suites, this needs both `npm run dev` (frontend) and a running backend
 * (`uvicorn app.main:app`, with Postgres up) already up before you run it — start
 * them the same way you would to use the app by hand, then `npm run test:e2e`.
 *
 * Runs daily in CI (.github/workflows/e2e-daily.yml), which starts both servers
 * itself with ANTHROPIC_API_KEY unset — assertions here are written against
 * structure/behavior, not exact agent wording, so they pass whether the agent layer
 * is live or on its deterministic simulated fallback (see backend/app/agent_service.py).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
