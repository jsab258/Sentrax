import { test } from '@playwright/test';

/**
 * Milestone screenshots. Run with `SCREENSHOTS=1 SCREENSHOT_MILESTONE=m1 npx playwright test e2e/screenshots.spec.ts`;
 * images land in docs/screenshots/<milestone>/. Skipped in the normal e2e run so CI does not rewrite them.
 */
const milestone = process.env.SCREENSHOT_MILESTONE ?? 'm1';
test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to capture milestone screenshots.');

interface Shot {
  name: string;
  url: string;
  waitFor?: string;
  fullPage?: boolean;
  desktopOnly?: boolean;
}

const shots: Record<string, Shot[]> = {
  m0: [
    { name: 'shell', url: './', waitFor: 'canvas' },
    { name: 'fallback', url: './?webgl=0', waitFor: '[data-testid="webgl-fallback"]' },
    { name: 'brand-sheet', url: './?dev=brand', waitFor: '[data-testid="brand-sheet"]', fullPage: true },
    { name: 'claims-overlay', url: './?claims', waitFor: '.claims-panel' },
  ],
  m1: [
    { name: 'shell', url: './', waitFor: 'canvas' },
    { name: 'brand-sheet', url: './?dev=brand', waitFor: '[data-testid="brand-sheet"]', fullPage: true },
    { name: 'claims-overlay', url: './?claims', waitFor: '.claims-panel' },
    {
      name: 'sim-hospital-par',
      url: './?dev=sim&scene=hospital&scenario=h3-out&at=25&t=95&speed=0&select=tag-vent-02',
      waitFor: '[data-testid="sim-debug"]',
    },
    {
      name: 'sim-hospital-sos',
      url: './?dev=sim&scene=hospital&scenario=h5-sos&at=25&t=90&speed=0&select=tag-sos-nurse-3',
      waitFor: '[data-testid="sim-debug"]',
      desktopOnly: true,
    },
    {
      name: 'sim-hospital-fridge',
      url: './?dev=sim&scene=hospital&scenario=h4-open&at=25&t=150&speed=0&select=tag-fridge-01',
      waitFor: '[data-testid="sim-debug"]',
      desktopOnly: true,
    },
    {
      name: 'sim-warehouse-w1',
      url: './?dev=sim&scene=warehouse&scenario=w1-w2&at=25&t=48&speed=0&select=tag-pallet-2291',
      waitFor: '[data-testid="sim-debug"]',
    },
    {
      name: 'sim-warehouse-evacuation',
      url: './?dev=sim&scene=warehouse&scenario=w4-evac&at=25&t=90&speed=0',
      waitFor: '[data-testid="sim-debug"]',
      desktopOnly: true,
    },
    {
      name: 'sim-test-bilink',
      url: './?dev=sim&scene=test-bilink&t=60&speed=0',
      waitFor: '[data-testid="sim-debug"]',
      desktopOnly: true,
    },
    {
      name: 'sim-test-aoa',
      url: './?dev=sim&scene=test-aoa&t=60&speed=0&select=tag-walker0',
      waitFor: '[data-testid="sim-debug"]',
      desktopOnly: true,
    },
  ],
};

for (const shot of shots[milestone] ?? []) {
  test(`screenshot ${shot.name}`, async ({ page }, info) => {
    test.skip(!!shot.desktopOnly && info.project.name !== 'desktop', 'desktop only');
    await page.goto(shot.url);
    if (shot.waitFor) await page.locator(shot.waitFor).first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `docs/screenshots/${milestone}/${shot.name}-${info.project.name}.png`,
      fullPage: shot.fullPage ?? false,
    });
  });
}
