import { expect, test } from '@playwright/test';
import { collectErrors } from './helpers';

/** Credits panel (SPEC section 10): every recorded asset with author and license, in a modal dialog. */
test('credits dialog lists the assets and libraries, and closes with Escape', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?scene=hospital&quality=low');
  const open = page.getByTestId('credits-open');
  await expect(open).toBeVisible();
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Credits' });
  await expect(dialog).toBeVisible();
  for (const text of [
    'Terrazzo Tiles',
    'Empty Warehouse 01',
    'Poppins',
    'three.js',
    'Basis Universal transcoder',
    'Sentrax product photos',
  ])
    await expect(dialog).toContainText(text);
  await expect(dialog).toContainText('CC0');
  await expect(dialog).toContainText('SIL OFL 1.1');
  // Every source link opens in a new tab.
  const links = dialog.locator('a');
  expect(await links.count()).toBeGreaterThanOrEqual(20);
  for (const target of await links.evaluateAll((els) => els.map((e) => e.getAttribute('target'))))
    expect(target).toBe('_blank');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
  // The close button works too.
  await open.click();
  await page.getByTestId('credits-close').click();
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});

test('credits are reachable in explore mode and hidden in the teaser', async ({ page }) => {
  await page.goto('./?mode=sandbox&scene=warehouse&quality=low');
  await expect(page.getByTestId('credits-open')).toBeVisible();
  await page.goto('./?mode=teaser&quality=low');
  await expect(page.getByTestId('teaser')).toBeVisible();
  await expect(page.getByTestId('credits-open')).toHaveCount(0);
});
