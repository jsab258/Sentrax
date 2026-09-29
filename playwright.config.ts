import { defineConfig, devices } from '@playwright/test';

const port = 5173;
/** Run against another server (a production build, the online preview) instead of the dev server. */
const external = process.env.E2E_BASE_URL;
const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } };
const mobile = { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } };
const SCROLL_STORY = /scroll\.spec\.ts/;

export default defineConfig({
  testDir: './e2e',
  // Above the 90 s scene-ready waits many specs declare (software WebGL on a slow CI runner): a lower
  // limit ended tests before their own waits did (DECISIONS.md 142).
  timeout: 150_000,
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
    { name: 'desktop', use: desktop, testIgnore: SCROLL_STORY },
    { name: 'mobile', use: mobile, testIgnore: SCROLL_STORY },
    // The scroll story's specs render heavy software-WebGL frames for minutes. They run after the demo's
    // projects, so the demo's timing-sensitive tests keep the machine they had before the story existed.
    { name: 'scroll-desktop', use: desktop, testMatch: SCROLL_STORY, dependencies: ['desktop', 'mobile'] },
    { name: 'scroll-mobile', use: mobile, testMatch: SCROLL_STORY, dependencies: ['desktop', 'mobile'] },
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
