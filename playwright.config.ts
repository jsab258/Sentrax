import { defineConfig, devices } from '@playwright/test';

const port = 5173;
/** Run against another server (a production build, the online preview) instead of the dev server. */
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: external ?? `http://127.0.0.1:${port}/`,
    trace: 'retain-on-failure',
    launchOptions: {
      // Software WebGL so headless runs (CI, containers) can render the 3D stage.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } } },
  ],
  webServer: external
    ? undefined
    : {
        command: `npx vite --port ${port} --strictPort --host 127.0.0.1`,
        url: `http://127.0.0.1:${port}/`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
