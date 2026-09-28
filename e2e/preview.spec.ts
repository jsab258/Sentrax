import { expect, test, type Page } from '@playwright/test';
import { collectErrors } from './helpers';

/**
 * Online preview check (also run by the Pages workflow against the deployed URL, E2E_BASE_URL): both
 * scenes, one story per scene and the teaser load with their textures, HDRI and Basis transcoder, with no
 * console errors and no failed requests.
 */
function watchRequests(page: Page) {
  const loaded: string[] = [];
  const failed: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    else loaded.push(r.url());
  });
  page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText ?? 'failed'} ${r.url()}`));
  return { loaded, failed };
}

test.skip(({ isMobile }) => isMobile, 'desktop check');

for (const [name, query, scene] of [
  ['hospital story H1', './?scene=hospital&story=h1&quality=high', 'hospital'],
  ['warehouse story W1', './?scene=warehouse&story=w1&quality=high', 'warehouse'],
  ['teaser', './?mode=teaser', 'hospital'],
] as const) {
  test(`preview: ${name} loads with textures, HDRI and transcoder`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    const req = watchRequests(page);
    await page.goto(query);
    const stage = page.getByTestId('scene-stage');
    await expect(stage).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
    await expect(stage).toHaveAttribute('data-scene', scene);
    // Deep links resolve under the base path.
    await expect(page.getByText('Simulated data').first()).toBeVisible();
    if (name !== 'teaser')
      await expect(page.getByTestId('guided-panel')).toHaveAttribute(
        'data-story',
        query.includes('h1') ? 'h1' : 'w1',
      );
    else await expect(page.getByTestId('teaser-caption')).toBeVisible();
    expect(req.loaded.some((u) => u.includes('/assets/textures/'))).toBe(true);
    expect(req.loaded.some((u) => u.includes('/assets/hdri/'))).toBe(true);
    expect(req.loaded.some((u) => /basis_transcoder[^/]*\.(js|wasm)/.test(u))).toBe(true);
    expect(req.failed).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('preview: ?quality=high&stats=1 and ?quality=low&stats=1 show the stats HUD on their tier', async ({
  page,
}) => {
  test.setTimeout(180_000);
  for (const tier of ['high', 'low'] as const) {
    await page.goto(`./?quality=${tier}&stats=1`);
    await expect(page.getByTestId('scene-stage')).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
    await expect(page.getByTestId('scene-canvas')).toHaveAttribute('data-tier', tier);
    await expect(page.getByTestId('stats-hud')).toContainText(tier);
  }
});
