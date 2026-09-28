import { expect, test } from '@playwright/test';
import { storyCopy } from '../src/content/stories';
import { collectErrors } from './helpers';

/**
 * Every guided story plays end to end in the browser: each step renders its narration, Next moves on
 * (finishing the step's simulation first), and the end card appears with its takeaway and the booking
 * CTA. No console errors along the way.
 */
const stories = [
  { id: 'h1', scene: 'hospital', steps: 3 },
  { id: 'h2', scene: 'hospital', steps: 6 },
  { id: 'h3', scene: 'hospital', steps: 3 },
  { id: 'h4', scene: 'hospital', steps: 3 },
  { id: 'h5', scene: 'hospital', steps: 2 },
  { id: 'w1', scene: 'warehouse', steps: 3 },
  { id: 'w2', scene: 'warehouse', steps: 2 },
  { id: 'w3', scene: 'warehouse', steps: 3 },
  { id: 'w4', scene: 'warehouse', steps: 4 },
  { id: 'w5', scene: 'warehouse', steps: 3 },
];

for (const s of stories) {
  test(`story ${s.id.toUpperCase()} plays end to end`, async ({ page }) => {
    // Software rendering on a shared runner; a deep warehouse story needs a few minutes.
    test.setTimeout(240_000);
    const errors = collectErrors(page);
    const copy = storyCopy[s.id];
    if (!copy) throw new Error(`no copy for ${s.id}`);
    const titles = Object.values(copy.steps).map((c) => c.title);
    await page.goto(`./?scene=${s.scene}&story=${s.id}&quality=low`);
    const panel = page.getByTestId('guided-panel');
    await expect(panel).toHaveAttribute('data-story', s.id);
    for (let step = 1; step <= s.steps; step++) {
      await expect(panel).toHaveAttribute('data-step', String(step));
      // Each step shows its own narration, in story order.
      await expect(page.getByTestId('step-title')).toHaveText(titles[step - 1] ?? '');
      await page.getByTestId('step-next').click();
    }
    const end = page.getByTestId('end-card');
    await expect(end).toBeVisible({ timeout: 30_000 });
    await expect(end).toContainText(copy.takeaway);
    await expect(end.getByRole('link', { name: /Book a meeting/ })).toHaveAttribute('target', '_blank');
    expect(errors).toEqual([]);
  });
}
