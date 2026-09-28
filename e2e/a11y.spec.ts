import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { collectErrors } from './helpers';

/**
 * Accessibility (SPEC section 11): keyboard navigation in guided mode, visible focus states, sufficient
 * contrast, reduced motion, narration as text. axe checks the UI (WCAG 2.1 A and AA rules); the WebGL
 * canvas itself is excluded.
 */
async function axe(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('.scene-canvas')
    .analyze();
  // The scan really ran over the UI (contrast, names, roles and so on).
  expect(result.passes.length).toBeGreaterThan(10);
  return result.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.slice(0, 4).map((n) => n.target.join(' ')),
  }));
}

for (const [name, query] of [
  ['guided story with the dashboard', './?scene=hospital&story=h1&step=2&quality=low'],
  ['explore mode', './?mode=sandbox&scene=warehouse&quality=low'],
  ['teaser', './?mode=teaser&quality=low'],
] as const) {
  test(`no WCAG A or AA violations: ${name}`, async ({ page }) => {
    // axe shares the main thread with software-rendered WebGL (the warehouse especially).
    test.setTimeout(180_000);
    await page.goto(query);
    await expect(page.getByTestId('scene-stage')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
    expect(await axe(page)).toEqual([]);
  });
}

test('no WCAG A or AA violations: end card and credits dialog', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('./?scene=warehouse&story=w3&step=3&quality=low');
  await page.getByTestId('step-next').click();
  await expect(page.getByTestId('end-card')).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.getByTestId('credits-open').click();
  await expect(page.getByRole('dialog', { name: 'Credits' })).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test('guided mode works from the keyboard with visible focus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'keyboard flow checked on desktop');
  const errors = collectErrors(page);
  await page.goto('./?scene=hospital&story=h2&quality=low');
  const panel = page.getByTestId('guided-panel');
  await expect(panel).toHaveAttribute('data-step', '1');
  // Narration is available as text.
  await expect(page.getByTestId('step-title')).not.toBeEmpty();
  await expect(panel.locator('.guided-card p').first()).not.toBeEmpty();

  // Tab reaches Next; its focus ring is visible; Enter activates it.
  const next = page.getByTestId('step-next');
  for (let i = 0; i < 60 && !(await next.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await expect(next).toBeFocused();
  const outline = await next.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
  });
  expect(outline.style).not.toBe('none');
  expect(outline.width).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Enter');
  await expect(panel).toHaveAttribute('data-step', '2');

  // Arrow keys step through the story (focus on the page, not in a form field).
  await page.locator('body').focus();
  await page.keyboard.press('ArrowRight');
  await expect(panel).toHaveAttribute('data-step', '3');
  await page.keyboard.press('ArrowLeft');
  await expect(panel).toHaveAttribute('data-step', '2');

  // The story list opens and a story can be chosen from the keyboard.
  await page.getByTestId('story-picker').focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('story-h3').focus();
  await page.keyboard.press('Enter');
  await expect(panel).toHaveAttribute('data-story', 'h3');
  expect(errors).toEqual([]);
});

test('reduced motion: the stage runs in reduced-motion mode and CSS animations stop', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('./?scene=hospital&story=h1&quality=low');
  const stage = page.getByTestId('scene-stage');
  await expect(stage).toHaveAttribute('data-motion', 'reduced');
  const duration = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.transition = 'opacity 2s';
    document.body.append(el);
    const d = getComputedStyle(el).transitionDuration;
    el.remove();
    return d;
  });
  expect(parseFloat(duration)).toBeLessThan(0.01);
  await context.close();
});

test('full motion by default', async ({ page }) => {
  await page.goto('./?scene=hospital&story=h1&quality=low');
  await expect(page.getByTestId('scene-stage')).toHaveAttribute('data-motion', 'full');
});
