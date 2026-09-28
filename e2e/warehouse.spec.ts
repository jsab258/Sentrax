import { expect, test, type Page } from '@playwright/test';

/** Warehouse scene: scene switch, W stories' dashboard panels, deep links. */

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function openDashboard(page: Page) {
  const handle = page.locator('.dashboard-handle');
  if ((await handle.isVisible()) && (await handle.getAttribute('aria-expanded')) !== 'true')
    await handle.click();
}

const query = (page: Page) => new URL(page.url()).searchParams;

test('the scene switch opens the warehouse and its first story', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await expect(page.getByTestId('guided-panel')).toHaveAttribute('data-story', 'h1');
  await page.getByTestId('scene-warehouse').click();
  await expect(page.getByTestId('scene-stage')).toHaveAttribute('data-scene', 'warehouse');
  await expect(page.getByTestId('guided-panel')).toHaveAttribute('data-story', 'w1');
  await expect.poll(() => query(page).get('scene')).toBe('warehouse');
  expect(query(page).get('story')).toBe('w1');
  await expect(page.getByTestId('scene-stage')).toHaveAttribute('data-ready', 'true', { timeout: 90_000 });
  expect(errors).toEqual([]);
});

test('W1: the dashboard finds PL-2291 at its rack slot', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?scene=warehouse&story=w1&step=2');
  await openDashboard(page);
  await expect(page.getByTestId('asset-search')).toHaveValue('PL-2291');
  await expect(page.getByTestId('asset-where-tag-pallet-2291')).toContainText('Aisle C, bay 14, level 4');
  expect(errors).toEqual([]);
});

test('W3: work in progress per station and the bottleneck alert', async ({ page }) => {
  await page.goto('./?scene=warehouse&story=w3&step=3');
  await openDashboard(page);
  await expect(page.getByTestId('stations')).toBeVisible();
  await expect(page.getByTestId('station-station-2')).toContainText('1 WIP');
  await expect(page.getByTestId('alerts')).toContainText('dwell limit exceeded');
});

test('W4: the muster count shows who is still missing', async ({ page }) => {
  await page.goto('./?scene=warehouse&story=w4&step=4');
  await openDashboard(page);
  await expect(page.getByTestId('muster-count')).toContainText('8 of 9');
  await expect(page.getByTestId('muster-missing')).toContainText('Assembly worker');
});

test('explore mode opens in the warehouse', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?mode=sandbox&scene=warehouse');
  await expect(page.getByTestId('scene-stage')).toHaveAttribute('data-mode', 'sandbox');
  await expect(page.getByTestId('scene-stage')).toHaveAttribute('data-ready', 'true', { timeout: 90_000 });
  await openDashboard(page);
  await expect(page.getByTestId('stations')).toBeVisible();
  expect(errors).toEqual([]);
});
