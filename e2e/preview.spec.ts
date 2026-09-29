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

/** Scrolls the host page to a progress through the story section. */
async function scrollStory(page: Page, progress: number): Promise<void> {
  await page.evaluate((p) => {
    const el = document.querySelector('.sentrax-scroll') as HTMLElement;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + p * (el.offsetHeight - window.innerHeight));
  }, progress);
}

test('preview: the homepage mock loads and scrolls through the story without errors', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = collectErrors(page);
  const req = watchRequests(page);
  await page.goto('./home-preview/');
  await expect(page.getByRole('heading', { name: 'Smart Locating and Sensing Systems' })).toBeVisible();
  await scrollStory(page, 0);
  await expect(page.locator('.sentrax-scroll iframe')).toHaveCount(1, { timeout: 30_000 });
  const frame = page.frames().find((f) => f.url().includes('/scroll/'));
  if (!frame) throw new Error('story iframe not found');
  await expect(frame.locator('.ss')).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
  const beats: string[] = [];
  for (const p of [0.1, 0.3, 0.5, 0.65, 1]) {
    await scrollStory(page, p);
    await expect
      .poll(
        () =>
          frame.evaluate(() =>
            (window as unknown as { __scrollStory: { settled: () => boolean } }).__scrollStory.settled(),
          ),
        {
          timeout: 60_000,
        },
      )
      .toBe(true);
    beats.push((await frame.locator('.ss').getAttribute('data-beat')) ?? '');
  }
  expect(beats).toEqual(['establish', 'tag', 'rooms', 'relay', 'find']);
  await expect(frame.locator('.ss')).toHaveAttribute('data-text', 'found');
  await expect(frame.getByRole('link', { name: /Book a meeting/ })).toBeVisible();
  await page.locator('.hp-footer').scrollIntoViewIfNeeded();
  await expect(page.locator('.hp-footer')).toBeVisible();
  expect(req.failed).toEqual([]);
  expect(errors).toEqual([]);
});

/**
 * Scroll story payload per look, measured from the bytes a production build actually transfers (only
 * against a build or the live preview: the dev server serves unbundled modules). Budgets from
 * SCROLL-SPEC.md section 8.
 */
test('preview: scroll story 3D payload per look within budget, desktop and phone', async ({ browser }) => {
  test.skip(!process.env.E2E_BASE_URL, 'needs a production build (E2E_BASE_URL)');
  test.setTimeout(300_000);
  const budgetMB = { a: { desktop: 6, phone: 3 }, b: { desktop: 6, phone: 3 }, c: { desktop: 9, phone: 4 } };
  for (const look of ['a', 'b', 'c'] as const) {
    for (const device of ['desktop', 'phone'] as const) {
      const context = await browser.newContext(
        device === 'phone'
          ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
          : { viewport: { width: 1440, height: 900 } },
      );
      const page = await context.newPage();
      const responses: Array<Promise<number>> = [];
      page.on('requestfinished', (r) =>
        responses.push(r.sizes().then((s) => s.responseBodySize + s.responseHeadersSize)),
      );
      await page.goto(`./scroll/?force=3d&look=${look}`);
      await expect(page.locator('.ss')).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
      await page.waitForLoadState('networkidle');
      const bytes = (await Promise.all(responses)).reduce((s, b) => s + b, 0);
      const mb = bytes / 1024 / 1024;
      console.log(
        `scroll story look ${look} ${device}: ${mb.toFixed(2)} MB in ${responses.length} requests (budget ${budgetMB[look][device]} MB)`,
      );
      expect(mb).toBeLessThanOrEqual(budgetMB[look][device]);
      await context.close();
    }
  }
});
