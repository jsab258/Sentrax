import { expect, test, type Page } from '@playwright/test';

/** Explore mode (SPEC section 4): time controls, presets, event triggers, device product cards. */

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

test('explore mode has time controls, presets and triggers; an SOS trigger raises the alert', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('./?mode=sandbox&scene=hospital&quality=low');
  const panel = page.getByTestId('sandbox-panel');
  await expect(panel).toBeVisible();
  await page.getByTestId('time-pause').click();
  await expect(page.getByTestId('time-pause')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('time-4x').click();
  await expect(page.getByTestId('time-4x')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('preset-icu').click();
  await page.getByTestId('trigger-sos').click();
  // The trigger sends the nurse to room 105 (its outcome is covered by the trigger unit tests).
  await expect
    .poll(() =>
      page.evaluate(() => {
        const dbg = (
          window as unknown as {
            __sentrax: { activeSim: () => { agents: { agents: Map<string, { node: string }> } } };
          }
        ).__sentrax;
        return dbg.activeSim().agents.agents.get('nurse-3')?.node;
      }),
    )
    .toBe('r105-bed');
  await openDashboard(page);
  await expect(page.getByTestId('alerts')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a device product card shows the photo, description, role and product link', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?mode=sandbox&scene=hospital&device=cen-r104');
  const card = page.getByTestId('device-card');
  await expect(card).toHaveAttribute('data-model', 'NODIX CEN-1');
  await expect(card).toContainText('BiLink BLE Relay Anchor');
  await expect(card).toContainText('Room anchor');
  const link = page.getByTestId('device-product-link');
  await expect(link).toHaveAttribute('href', /sentrax\.com\/product\/nodix-cen-1/);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(card.locator('img')).toHaveJSProperty('complete', true);
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('reset starts the explore simulation afresh', async ({ page }) => {
  await page.goto('./?mode=sandbox&scene=warehouse');
  await page.getByTestId('trigger-cage').click();
  await page.getByTestId('time-reset').click();
  await expect(page.getByTestId('sandbox-panel')).toBeVisible();
});

test('dragging a person moves them in the simulation and follows their tag', async ({ page }) => {
  await page.goto('./?mode=sandbox&scene=hospital&quality=low');
  await expect(page.getByTestId('scene-stage')).toHaveAttribute('data-ready', 'true', { timeout: 90_000 });
  await page.getByTestId('time-pause').click();
  type Dbg = {
    screenOf: (kind: string, id: string) => { x: number; y: number } | null;
    activeSim: () => { agents: { agents: Map<string, { pos: { x: number; y: number } }> } };
  };
  const screenOf = () =>
    page.evaluate(() => (window as unknown as { __sentrax: Dbg }).__sentrax.screenOf('agent', 'porter'));
  const posOf = () =>
    page.evaluate(() => {
      const p = (window as unknown as { __sentrax: Dbg }).__sentrax
        .activeSim()
        .agents.agents.get('porter')?.pos;
      return p ? { x: p.x, y: p.y } : null;
    });
  await expect.poll(screenOf).not.toBeNull();
  const start = (await screenOf()) as { x: number; y: number };
  const before = (await posOf()) as { x: number; y: number };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 60, start.y + 10, { steps: 6 });
  await page.mouse.move(start.x + 120, start.y + 20, { steps: 6 });
  await page.mouse.up();
  const after = (await posOf()) as { x: number; y: number };
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(1);
  await expect(page.getByTestId('sandbox-panel')).toContainText('Porter');
});
