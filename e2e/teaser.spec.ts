import { expect, test } from '@playwright/test';
import { collectErrors, finishStep, simTime } from './helpers';

/**
 * Teaser mode (SPEC section 4): short H1 and W1 in a loop, minimal UI with two buttons, no scroll
 * hijacking, no sound.
 */

test('teaser shows minimal UI, two calls to action and never captures scrolling', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?mode=teaser&quality=low');
  const stage = page.getByTestId('scene-stage');
  await expect(stage).toHaveAttribute('data-mode', 'teaser');
  await expect(stage).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
  // Minimal UI: no header, scene bar, layer toolbar, story panel or dashboard.
  await expect(page.locator('.topbar')).toHaveCount(0);
  await expect(page.locator('.stage-top')).toHaveCount(0);
  await expect(page.getByTestId('guided-panel')).toHaveCount(0);
  await expect(page.getByTestId('dashboard')).toHaveCount(0);
  await expect(page.getByText('Simulated data')).toBeVisible();
  await expect(page.getByTestId('teaser-caption')).toHaveAttribute('data-story', 'h1-teaser');
  await expect(page.getByTestId('teaser-caption')).toContainText('Searching without RTLS');
  // No audio anywhere.
  await expect(page.locator('audio, video')).toHaveCount(0);

  const explore = page.getByTestId('explore-demo');
  await expect(explore).toHaveText(/Explore the interactive demo/);
  await expect(explore).toHaveAttribute('target', '_blank');
  const href = (await explore.getAttribute('href')) ?? '';
  expect(href).toContain('scene=hospital');
  expect(href).not.toContain('mode=teaser');
  const book = page.getByRole('link', { name: /Book a meeting/ });
  await expect(book).toHaveAttribute('target', '_blank');
  await expect(book).toHaveAttribute('href', /outlook\.office365\.com/);

  // Wheel and touch go to the page, not the camera.
  const canvas = page.locator('.scene-canvas canvas');
  const prevented = await canvas.evaluate((el) => {
    const ev = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(prevented).toBe(false);
  expect(await canvas.evaluate((el) => getComputedStyle(el).touchAction)).not.toBe('none');

  // Both buttons fit side by side inside the frame, down to 360 px.
  const vw = page.viewportSize()?.width ?? 0;
  const a = await explore.boundingBox();
  const b = await book.boundingBox();
  expect(a && b).toBeTruthy();
  if (a && b) {
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vw);
    expect(Math.abs(a.y - b.y)).toBeLessThan(4);
  }
  expect(errors).toEqual([]);
});

test('teaser loops H1 then W1 then H1, and the pause control stops it', async ({ page }, testInfo) => {
  // One viewport is enough for the loop logic; software rendering makes each scene switch slow.
  test.skip(testInfo.project.name === 'mobile', 'loop covered on desktop');
  test.setTimeout(300_000);
  const errors = collectErrors(page);
  await page.goto('./?mode=teaser&quality=low');
  const stage = page.getByTestId('scene-stage');
  const caption = page.getByTestId('teaser-caption');
  await expect(stage).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });

  // Pause: the simulation clock stops; play resumes it.
  const pause = page.getByTestId('teaser-pause');
  await expect(pause).toHaveAccessibleName('Pause the animation');
  await pause.click();
  await expect(pause).toHaveAccessibleName('Play the animation');
  const t0 = await simTime(page);
  await page.waitForTimeout(1500);
  expect(await simTime(page)).toBe(t0);
  await pause.click();
  await expect.poll(() => simTime(page), { timeout: 20_000 }).toBeGreaterThan(t0);

  // Each step moves on by itself once its simulation part is done (finished instantly here).
  const expectStep = async (story: string, step: number) => {
    await expect(caption).toHaveAttribute('data-story', story, { timeout: 90_000 });
    await expect(caption).toHaveAttribute('data-step', String(step), { timeout: 90_000 });
  };
  for (const [story, steps] of [
    ['h1-teaser', 3],
    ['w1-teaser', 3],
  ] as const) {
    for (let s = 1; s <= steps; s++) {
      await expectStep(story, s);
      await finishStep(page);
    }
  }
  await expectStep('h1-teaser', 1);
  await expect(stage).toHaveAttribute('data-scene', 'hospital');
  await expect(page.getByTestId('end-card')).toHaveCount(0);
  expect(errors).toEqual([]);
});
