import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    // Nunca gravar vídeo/screenshot por padrão: o app mostra dado financeiro (ADR-0009 §3).
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // The empty-state spec wipes the one shared `development-user` database
      // this whole suite reads (there is no per-test user, ADR-0008 — see
      // `e2e/helpers/raw-db.ts` `wipeInstanceData`), so it cannot share a
      // worker pool with everything else: `fullyParallel` would let another
      // file's request land on a page mid-wipe. Excluding it here and running
      // it as its own dependent project (below) is what keeps the exclusion.
      testIgnore: /empty-state\.spec\.ts$/,
    },
    {
      name: 'empty-state',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /empty-state\.spec\.ts$/,
      // Playwright runs a project's `dependencies` to completion before any
      // of the project's own tests start — the built-in way to serialise
      // against a whole other project, not just the tests in this file
      // (`test.describe.serial` only orders tests within ONE file).
      dependencies: ['chromium'],
    },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
