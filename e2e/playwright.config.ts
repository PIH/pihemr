import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import type { PihemrWorkerOptions } from './src/site';
import { siteFromEnv } from './src/site-from-env';

dotenv.config({ path: path.resolve(__dirname, '.env') });

// For running the specs from pihemr itself, against the server in .env (see README.md, "Running the specs from pihemr"). The config repos (zl-emr,
// pihsl-emr) have their own configs and do not use this one.

// A slow server (a local one under load needs more than 30 s for some form saves and visit-page loads) needs longer timeouts: E2E_TIMEOUT_FACTOR
// multiplies the test, expect and action timeouts.
const factor = Number(process.env.E2E_TIMEOUT_FACTOR ?? 1);

export default defineConfig<{}, PihemrWorkerOptions>({
  testDir: './src/specs',
  timeout: 30 * 1000 * factor,
  expect: {
    timeout: 15 * 1000 * factor,
  },
  fullyParallel: true,
  // One worker by default: the specs create and void their own patients on a shared server. E2E_WORKERS=3 runs specs in parallel
  // (each test has its own patient), if the server can take it.
  workers: Number(process.env.E2E_WORKERS ?? 1),
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['html', { open: 'never' }]],
  globalSetup: require.resolve('./global-setup'),
  use: {
    // Read when a worker first needs the site, so a missing setting fails the test with a message, and listing the tests needs no .env.
    siteConfig: { getSite: () => siteFromEnv() },
    // Trailing slash is required so that relative page.goto() paths keep the "/openmrs" prefix. Only read when a test runs.
    baseURL: `${(process.env.E2E_BASE_URL ?? '').replace(/\/+$/, '')}/`,
    actionTimeout: 15 * 1000 * factor,
    storageState: path.resolve(__dirname, 'storageState.json'),
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
