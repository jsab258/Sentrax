import { expect, test, type Page } from '@playwright/test';

/** 3D stage checks. Headless runs use SwiftShader (software WebGL), so frame rates here mean nothing. */

interface Stats {
  fps: number;
  calls: number;
  triangles: number;
  frames: number;
}

async function statsAfterFrames(page: Page, frames: number): Promise<Stats> {
  await page.waitForFunction(
    (n) => ((window as { __sentraxStats?: Stats }).__sentraxStats?.frames ?? 0) >= n,
    frames,
    {
      timeout: 90_000,
    },
  );
  return page.evaluate(() => (window as unknown as { __sentraxStats: Stats }).__sentraxStats);
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('hospital renders on the high tier within the draw call budget', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?quality=high&stats=1');
  await expect(page.getByTestId('scene-stage')).toHaveAttribute('data-ready', 'true', { timeout: 90_000 });
  await expect(page.getByTestId('scene-canvas')).toHaveAttribute('data-tier', 'high');
  await expect(page.getByTestId('scene-loader')).toHaveCount(0);
  const stats = await statsAfterFrames(page, 4);
  // SPEC section 11: under 300 draw calls on high (shadow and post-processing passes included).
  expect(stats.calls).toBeGreaterThan(50);
  expect(stats.calls).toBeLessThan(300);
  expect(errors).toEqual([]);
});

test('the quality menu switches tiers and the low tier draws less', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?quality=high&stats=1');
  await expect(page.getByTestId('scene-stage')).toHaveAttribute('data-ready', 'true', { timeout: 90_000 });
  const high = await statsAfterFrames(page, 4);
  await page.getByTestId('quality-select').selectOption('low');
  await expect(page.getByTestId('scene-canvas')).toHaveAttribute('data-tier', 'low');
  const low = await statsAfterFrames(page, high.frames + 8);
  expect(low.calls).toBeLessThan(high.calls);
  expect(errors).toEqual([]);
});
