import { expect, test, type Page } from '@playwright/test';

/** Guided mode: narration, controls, deep links, end card, layers and lens (SPEC section 4). */

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

function query(page: Page): URLSearchParams {
  return new URL(page.url()).searchParams;
}

/** On narrow screens the dashboard is a bottom sheet that starts collapsed and covers the story when open. */
async function setDashboard(page: Page, open: boolean) {
  const handle = page.locator('.dashboard-handle');
  if (await handle.isVisible()) {
    if ((await handle.getAttribute('aria-expanded')) !== String(open)) await handle.click();
  }
}

const openDashboard = (page: Page) => setDashboard(page, true);
const closeDashboard = (page: Page) => setDashboard(page, false);

test('the default page opens the first hospital story and keeps the URL in sync', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  const panel = page.getByTestId('guided-panel');
  await expect(panel).toHaveAttribute('data-story', 'h1');
  await expect(panel).toHaveAttribute('data-step', '1');
  await expect(page.getByTestId('step-title')).toHaveText('Searching without RTLS');
  await expect(page.getByTestId('stopwatch')).toContainText('Without RTLS');
  await expect.poll(() => query(page).get('story')).toBe('h1');
  expect(query(page).get('step')).toBe('1');

  await page.getByTestId('step-next').click();
  await expect(panel).toHaveAttribute('data-step', '2');
  await expect.poll(() => query(page).get('step')).toBe('2');
  await expect(page.getByTestId('dashboard')).toBeVisible();
  await openDashboard(page);
  await expect(page.getByTestId('asset-search')).toHaveValue('pump');
  await expect(page.getByTestId('asset-list')).toContainText('Infusion pump P-07');
  await expect(page.getByTestId('asset-list')).not.toContainText('Crash cart');
  expect(errors).toEqual([]);
});

test('a deep link lands on the exact story step, and Back replays to the step before', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?story=h3&step=3');
  const panel = page.getByTestId('guided-panel');
  await expect(panel).toHaveAttribute('data-story', 'h3');
  await expect(panel).toHaveAttribute('data-step', '3');
  await openDashboard(page);
  await expect(page.getByTestId('alerts')).toContainText('ICU below PAR: ventilators 2 of 3');
  await expect(page.getByTestId('nearest')).toContainText('Ventilator');
  await closeDashboard(page);

  await page.getByTestId('step-back').click();
  await expect(panel).toHaveAttribute('data-step', '2');
  await expect.poll(() => query(page).get('step')).toBe('2');
  expect(errors).toEqual([]);
});

test('arrow keys step through a story', async ({ page }) => {
  await page.goto('./?story=h2');
  const panel = page.getByTestId('guided-panel');
  await expect(panel).toHaveAttribute('data-step', '1');
  await page.keyboard.press('ArrowRight');
  await expect(panel).toHaveAttribute('data-step', '2');
  await page.keyboard.press('ArrowRight');
  await expect(panel).toHaveAttribute('data-step', '3');
  await page.keyboard.press('ArrowLeft');
  await expect(panel).toHaveAttribute('data-step', '2');
});

test('the end card offers the booking CTA and switches to explore mode', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?story=h5');
  await page.getByTestId('skip').click();
  const end = page.getByTestId('end-card');
  await expect(end).toBeVisible();
  await expect(end).toContainText('One button press brings help to the right room.');
  const cta = end.getByRole('link', { name: /Book a meeting/ });
  await expect(cta).toHaveAttribute('target', '_blank');
  await expect(cta).toHaveAttribute('rel', /noopener/);

  await end.getByRole('button', { name: 'Explore freely' }).click();
  await expect(page.getByTestId('scene-stage')).toHaveAttribute('data-mode', 'sandbox');
  await expect(page.getByTestId('guided-panel')).toHaveCount(0);
  await expect.poll(() => query(page).get('mode')).toBe('sandbox');
  expect(query(page).get('story')).toBeNull();
  expect(errors).toEqual([]);
});

test('the story list opens another story', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('story-picker').click();
  await page.getByTestId('story-h4').click();
  await expect(page.getByTestId('guided-panel')).toHaveAttribute('data-story', 'h4');
  await expect.poll(() => query(page).get('story')).toBe('h4');
  await openDashboard(page);
  await expect(page.getByTestId('temp-chart')).toContainText('°C');
});

test('the H2 comparison shows infrastructure counts from the scene', async ({ page }) => {
  await page.goto('./?story=h2&step=6');
  const compare = page.getByTestId('compare');
  await expect(compare).toBeVisible();
  await expect(compare).not.toContainText('%');
  await page.getByTestId('compare-conventional').click();
  await expect(page.getByTestId('compare-conventional')).toHaveAttribute('aria-pressed', 'true');
  await expect(compare.getByTestId('count-Battery anchors')).toHaveText('0');
  await page.getByTestId('compare-bilink').click();
  await expect(compare.getByTestId('count-Gateways')).toHaveText('2');
});

test('layer toggles and the technology lens update the view and the URL', async ({ page }) => {
  await page.goto('./?story=h1');
  const radio = page.getByTestId('layer-radio');
  await expect(radio).toHaveAttribute('aria-pressed', 'false');
  await radio.click();
  await expect(radio).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('lens-select').selectOption('rssi');
  await expect(page.getByTestId('lens-note')).toContainText("can't tell rooms apart");
  await expect.poll(() => query(page).get('lens')).toBe('rssi');
  await page.getByTestId('lens-select').selectOption('aoa');
  await expect(page.getByTestId('lens-note')).toContainText('sub-meter');
});

test('a sandbox deep link restores layers and lens', async ({ page }) => {
  await page.goto('./?mode=sandbox&scene=hospital&layers=physical,data&lens=bilink');
  await expect(page.getByTestId('scene-stage')).toHaveAttribute('data-mode', 'sandbox');
  await expect(page.getByTestId('layer-data')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('layer-radio')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('layer-insight')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('lens-select')).toHaveValue('bilink');
  expect(query(page).get('layers')).toBe('physical,data');
});
