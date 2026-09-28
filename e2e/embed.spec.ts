import { expect, test, type Frame, type Page } from '@playwright/test';

/**
 * Iframe readiness (SPEC section 11): the demo posts ready, cta_click, story_complete and content_height
 * to the embedding page, and CTAs open in a new tab instead of navigating the top-level window.
 */
interface Message {
  source: string;
  type: string;
  payload?: Record<string, unknown>;
}

async function host(page: Page, baseURL: string, query: string): Promise<Frame> {
  const src = new URL(query, baseURL).toString();
  await page.setContent(`<!doctype html>
    <html><body style="margin:0">
      <script>
        window.__msgs = [];
        window.addEventListener('message', (e) => window.__msgs.push(e.data));
      </script>
      <iframe id="demo" src="${src}" style="width:100%;height:760px;border:0"></iframe>
    </body></html>`);
  const handle = await page.waitForSelector('#demo');
  const frame = await handle.contentFrame();
  if (!frame) throw new Error('no frame');
  await frame.waitForLoadState();
  // Keep CTA clicks from opening new tabs during the test (the app's own handlers still run first).
  await frame.evaluate(() => window.addEventListener('click', (e) => e.preventDefault()));
  return frame;
}

const messages = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __msgs: Message[] }).__msgs.filter((m) => m?.source === 'sentrax-3d-demo'),
  );

test('teaser in an iframe posts ready, content_height and cta_click', async ({ page, baseURL }) => {
  const frame = await host(page, baseURL ?? '', './?mode=teaser&quality=low');
  await expect
    .poll(async () => (await messages(page)).find((m) => m.type === 'ready')?.payload, { timeout: 60_000 })
    .toMatchObject({ webgl: true, scene: 'hospital', mode: 'teaser' });
  await expect
    .poll(async () =>
      Number((await messages(page)).find((m) => m.type === 'content_height')?.payload?.height),
    )
    .toBeGreaterThan(300);
  await frame.getByTestId('explore-demo').click();
  await frame.getByRole('link', { name: /Book a meeting/ }).click();
  await expect
    .poll(async () => (await messages(page)).filter((m) => m.type === 'cta_click').map((m) => m.payload))
    .toEqual([
      { cta: 'explore_demo', placement: 'teaser' },
      { cta: 'book_meeting', placement: 'teaser' },
    ]);
  // Exactly one ready message.
  expect((await messages(page)).filter((m) => m.type === 'ready')).toHaveLength(1);
  // The host page never navigated.
  expect(page.url()).toBe('about:blank');
});

test('a guided story in an iframe posts story_complete at its end card', async ({ page, baseURL }) => {
  const frame = await host(page, baseURL ?? '', './?scene=hospital&story=h5&step=2&quality=low');
  await expect(frame.getByTestId('guided-panel')).toHaveAttribute('data-step', '2', { timeout: 60_000 });
  await frame.getByTestId('step-next').click();
  await expect(frame.getByTestId('end-card')).toBeVisible();
  await expect
    .poll(async () => (await messages(page)).filter((m) => m.type === 'story_complete').map((m) => m.payload))
    .toEqual([{ story: 'h5' }]);
  await frame
    .getByTestId('end-card')
    .getByRole('link', { name: /Book a meeting/ })
    .click();
  await expect
    .poll(async () => (await messages(page)).filter((m) => m.type === 'cta_click').map((m) => m.payload))
    .toEqual([{ cta: 'book_meeting', placement: 'end_card_h5' }]);
});
