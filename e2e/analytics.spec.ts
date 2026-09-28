import { expect, test } from '@playwright/test';
import { collectErrors, collectTracked } from './helpers';

/**
 * Analytics hooks (SPEC section 11): the pluggable track(event, props) interface with its console default
 * reports every SPEC event. No third-party scripts and no cookies.
 */
test('a visit reports every analytics event, sets no cookies and calls no third party', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  const tracked = collectTracked(page);
  const origin = new URL(baseURL ?? '').origin;
  const foreign: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) foreign.push(url);
  });
  // Keep the booking link from opening a tab (the app's click handler still runs first).
  await page.addInitScript(() =>
    window.addEventListener('click', (e) => {
      if ((e.target as Element | null)?.closest?.('a[target="_blank"]')) e.preventDefault();
    }),
  );

  await page.goto('./?scene=hospital&story=h5&quality=low');
  const panel = page.getByTestId('guided-panel');
  await expect(panel).toHaveAttribute('data-step', '1');
  await page.getByTestId('step-next').click();
  await expect(panel).toHaveAttribute('data-step', '2');
  await page.getByTestId('step-next').click();
  await expect(page.getByTestId('end-card')).toBeVisible();
  await page.getByTestId('end-card').getByRole('button', { name: 'Explore freely' }).click();
  await expect(page.getByTestId('sandbox-panel')).toBeVisible();
  await page.getByTestId('lens-select').selectOption('aoa');
  await page.getByTestId('scene-warehouse').click();
  await page.evaluate(() =>
    (
      window as unknown as { __sentrax: { useExperience: { setState: (p: object) => void } } }
    ).__sentrax.useExperience.setState({ inspectDevice: 'len2-20-20' }),
  );
  await expect(page.getByTestId('device-card')).toBeVisible();
  await page
    .locator('.topbar')
    .getByRole('link', { name: /Book a meeting/ })
    .click();

  const expected: Array<[string, Record<string, unknown>]> = [
    ['story_started', { story: 'h5' }],
    ['story_step', { story: 'h5', step: 1 }],
    ['scene_opened', { scene: 'hospital' }],
    ['story_step', { story: 'h5', step: 2 }],
    ['story_completed', { story: 'h5' }],
    ['sandbox_opened', { scene: 'hospital' }],
    ['lens_changed', { lens: 'aoa' }],
    ['scene_opened', { scene: 'warehouse' }],
    ['device_inspected', { model: 'ZENIX LEN-2', scene: 'warehouse' }],
    ['cta_clicked', { cta: 'book_meeting', placement: 'topbar' }],
  ];
  await expect.poll(() => tracked.length).toBeGreaterThanOrEqual(expected.length);
  expect(tracked.map((t) => [t.event, t.props])).toEqual(expected);
  // Every SPEC event was seen.
  expect(new Set(tracked.map((t) => t.event))).toEqual(
    new Set([
      'scene_opened',
      'story_started',
      'story_step',
      'story_completed',
      'sandbox_opened',
      'device_inspected',
      'lens_changed',
      'cta_clicked',
    ]),
  );
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => document.cookie)).toBe('');
  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});
