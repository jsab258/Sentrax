import { test } from '@playwright/test';

/**
 * Milestone screenshots. Run with `npm run screenshots`; images land in docs/screenshots/<milestone>/.
 * Skipped in the normal e2e run so CI does not rewrite committed images.
 */
const milestone = process.env.SCREENSHOT_MILESTONE ?? 'm0';
test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to capture milestone screenshots.');

const shots: Array<{ name: string; url: string; waitFor?: string; fullPage?: boolean }> = [
  { name: 'shell', url: './', waitFor: 'canvas' },
  { name: 'fallback', url: './?webgl=0', waitFor: '[data-testid="webgl-fallback"]' },
  { name: 'brand-sheet', url: './?dev=brand', waitFor: '[data-testid="brand-sheet"]', fullPage: true },
  { name: 'claims-overlay', url: './?claims', waitFor: '.claims-panel' },
];

for (const shot of shots) {
  test(`screenshot ${shot.name}`, async ({ page }, info) => {
    await page.goto(shot.url);
    if (shot.waitFor) await page.locator(shot.waitFor).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `docs/screenshots/${milestone}/${shot.name}-${info.project.name}.png`,
      fullPage: shot.fullPage ?? false,
    });
  });
}
