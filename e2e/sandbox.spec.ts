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
  // Waits up to 60 s for the nurse to arrive in simulation time, on top of loading and a camera flight.
  test.setTimeout(150_000);
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
    .poll(
      () =>
        page.evaluate(() => {
          const dbg = (
            window as unknown as {
              __sentrax: { activeSim: () => { agents: { agents: Map<string, { node: string }> } } };
            }
          ).__sentrax;
          return dbg.activeSim().agents.agents.get('nurse-3')?.node;
        }),
      // The nurse walks there in simulation time; software rendering slows the clock down.
      { timeout: 60_000 },
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
  // Software rendering: each pointer move waits for a frame, which takes long on a busy runner.
  test.setTimeout(150_000);
  await page.goto('./?mode=sandbox&scene=hospital&quality=low');
  await expect(page.getByTestId('scene-stage')).toHaveAttribute('data-ready', 'true', { timeout: 90_000 });
  await page.getByTestId('time-pause').click();
  type Pt = { x: number; y: number };
  type Dbg = {
    screenOf: (kind: string, id: string) => Pt | null;
    activeSim: () => { agents: { agents: Map<string, { pos: Pt }> } };
  };
  const people = [
    ['porter', 'Porter'],
    ['biomed', 'BioMed technician'],
    ['nurse-1', 'Nurse'],
    ['nurse-2', 'Nurse'],
    ['nurse-3', 'Nurse'],
  ] as const;
  const screenOf = (id: string) =>
    page.evaluate((a) => (window as unknown as { __sentrax: Dbg }).__sentrax.screenOf('agent', a), id);
  const posOf = (id: string) =>
    page.evaluate((a) => {
      const p = (window as unknown as { __sentrax: Dbg }).__sentrax.activeSim().agents.agents.get(a)?.pos;
      return p ? { x: p.x, y: p.y } : null;
    }, id);
  const onCanvas = (p: Pt) =>
    page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', p);

  // Wait until the camera has settled (initial framing, panel insets): people stay put on screen.
  let last: Pt | null = null;
  await expect
    .poll(
      async () => {
        const now = await screenOf('porter');
        const still = !!now && !!last && Math.hypot(now.x - last.x, now.y - last.y) < 1;
        last = now;
        return still;
      },
      { timeout: 60_000, intervals: [500] },
    )
    .toBe(true);

  // Someone the visitor can see and grab (on a phone the explore panel covers the lower part).
  const vw = page.viewportSize()?.width ?? 0;
  let pick: { id: string; label: string; start: Pt; end: Pt } | null = null;
  for (const [id, label] of people) {
    const start = await screenOf(id);
    if (!start || !(await onCanvas(start))) continue;
    const dir = start.x > vw / 2 ? -1 : 1;
    const end = { x: start.x + dir * 80, y: start.y - 30 };
    if (await onCanvas(end)) {
      pick = { id, label, start, end };
      break;
    }
  }
  expect(pick).not.toBeNull();
  if (!pick) return;
  const { start, end } = pick;
  const before = (await posOf(pick.id)) as Pt;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 3 });
  await page.mouse.move(end.x, end.y, { steps: 3 });
  await page.mouse.up();
  const after = (await posOf(pick.id)) as Pt;
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(1);
  await expect(page.getByTestId('sandbox-panel')).toContainText(pick.label);
});
