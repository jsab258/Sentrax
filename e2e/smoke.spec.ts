import { expect, test } from '@playwright/test';

test('app shell renders with the booking CTA', async ({ page }) => {
  await page.goto('./');
  const cta = page.getByRole('link', { name: /Book a meeting/ }).first();
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('target', '_blank');
  await expect(cta).toHaveAttribute('href', /outlook\.office365\.com/);
});

test('3D stage mounts a WebGL2 canvas', async ({ page }) => {
  await page.goto('./');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 30_000 });
});

test('fallback shows poster, text and CTA without WebGL2', async ({ page }) => {
  await page.goto('./?webgl=0');
  const fallback = page.getByTestId('webgl-fallback');
  await expect(fallback).toBeVisible();
  await expect(fallback.getByRole('heading')).toHaveText('This demo needs WebGL2');
  await expect(fallback.getByRole('link', { name: /Book a meeting/ })).toBeVisible();
});

test('page has no horizontal overflow', async ({ page }) => {
  await page.goto('./');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
