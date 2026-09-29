import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Frame, type Page } from '@playwright/test';
import { links } from '../src/content/links';
import { collectErrors, collectTracked } from './helpers';

/**
 * Homepage scroll story (SCROLL-SPEC.md): every beat forwards and backwards, the tap and the auto-find on
 * the /home-preview/ mock (desktop and phone projects), the calls to action, detection and the ?force
 * overrides, determinism, and the embed in a plain HTML host page.
 */

const BEATS = ['establish', 'tag', 'rooms', 'relay', 'find'] as const;
const SHOTS = join(import.meta.dirname, '..', 'docs', 'screenshots', 'scroll');

interface StoryHooks {
  state: () => { beatId: string; text: { mode: string }; find: number; cta: boolean };
  key: () => string;
  settled: () => boolean;
  mode: () => string;
  clip: () => string | null;
  target: () => number;
  ranges: () => Array<[number, number]>;
}
declare global {
  interface Window {
    __scrollStory?: StoryHooks;
  }
}

/** Scrolls the host page (or the standalone story page) to a progress through the story section. */
async function scrollTo(page: Page, progress: number, selector: string): Promise<void> {
  await page.evaluate(
    ([p, sel]) => {
      const el = document.querySelector(sel) as HTMLElement;
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + p * (el.offsetHeight - window.innerHeight));
    },
    [progress, selector] as const,
  );
}

/** Waits until the story shows the given progress and has stopped moving. */
async function settle(frame: Frame | Page, progress: number): Promise<void> {
  await expect
    .poll(
      () =>
        frame.evaluate((p) => {
          const s = window.__scrollStory;
          return !!s && Math.abs(s.target() - p) < 0.003 && s.settled();
        }, progress),
      { timeout: 60_000, intervals: [100, 250, 500] },
    )
    .toBe(true);
}

async function storyFrame(page: Page): Promise<Frame> {
  await expect(page.locator('.sentrax-scroll iframe')).toHaveCount(1, { timeout: 30_000 });
  const frame = page.frames().find((f) => f.url().includes('/scroll/'));
  if (!frame) throw new Error('story iframe not found');
  await expect(frame.locator('.ss')).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
  await expect.poll(() => frame.evaluate(() => !!window.__scrollStory), { timeout: 30_000 }).toBe(true);
  return frame;
}

const mid = (r: [number, number], at = 0.5) => r[0] + (r[1] - r[0]) * at;
/** desktop or mobile, from the Playwright project name (scroll-desktop, scroll-mobile). */
const viewport = (project: string) => project.replace(/^scroll-/, '');

test('home preview: every beat forwards and backwards, Find, both calls to action', async ({
  page,
}, info) => {
  test.setTimeout(600_000);
  const errors = collectErrors(page);
  const tracked = collectTracked(page);
  mkdirSync(SHOTS, { recursive: true });
  // The booking link opens an external page in a new tab; keep the test offline.
  await page
    .context()
    .route('https://outlook.office365.com/**', (r) => r.fulfill({ status: 200, body: 'ok' }));

  await page.goto('home-preview/?force=3d');
  await expect(page.getByRole('heading', { name: 'Smart Locating and Sensing Systems' })).toBeVisible();
  await expect(page.getByText('Mock', { exact: true })).toBeVisible();
  await scrollTo(page, 0, '.sentrax-scroll');
  const frame = await storyFrame(page);
  const ranges = await frame.evaluate(() => (window.__scrollStory as StoryHooks).ranges());
  expect(ranges).toHaveLength(BEATS.length);
  await expect(frame.locator('.ss-label')).toHaveText('Illustrative animation');

  // Forwards through every beat, a screenshot per beat.
  for (const [i, beat] of BEATS.entries()) {
    const r = ranges[i] as [number, number];
    // In the last beat, stop before the auto-find window to show the Find button.
    const p = beat === 'find' ? mid(r, 0.12) : mid(r, 0.6);
    await scrollTo(page, p, '.sentrax-scroll');
    await settle(frame, p);
    await expect(frame.locator('.ss')).toHaveAttribute('data-beat', beat);
    await expect(frame.locator('.ss')).toHaveAttribute('data-text', beat === 'find' ? 'try' : 'beat');
    await page.waitForTimeout(1200); // word-by-word reveal
    await page.screenshot({
      path: join(SHOTS, `${viewport(info.project.name)}-${i + 1}-${beat}.jpg`),
      quality: 82,
    });
  }

  // The tap: Find the pump, then the found state with both calls to action.
  const find = frame.getByRole('button', { name: 'Find the pump' });
  await expect(find).toBeVisible();
  if (info.project.use.hasTouch) await find.tap();
  else await find.click();
  // The find plays over 2.4 s of story time; software rendering can take seconds per frame.
  await expect(frame.locator('.ss')).toHaveAttribute('data-text', 'found', { timeout: 90_000 });
  await expect(frame.locator('.ss')).toHaveAttribute('data-cta', 'true', { timeout: 90_000 });
  await expect(frame.getByRole('heading', { name: 'Found. Room 104.' })).toBeVisible();
  await expect
    .poll(() => frame.evaluate(() => (window.__scrollStory as StoryHooks).settled()), { timeout: 60_000 })
    .toBe(true);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(SHOTS, `${viewport(info.project.name)}-6-found.jpg`), quality: 82 });

  const book = frame.getByRole('link', { name: /Book a meeting/ });
  const demo = frame.getByRole('link', { name: /Explore the full demo/ });
  await expect(book).toBeVisible();
  await expect(demo).toBeVisible();
  await expect(book).toHaveAttribute('href', links.bookMeeting);
  // Without VITE_DEMO_URL the secondary button opens this app's full demo (the site root).
  const demoHref = await demo.getAttribute('href');
  expect(new URL(demoHref ?? '').href).toBe(new URL('./', page.url().replace(/home-preview\/.*$/, '')).href);
  for (const a of [book, demo]) {
    await expect(a).toHaveAttribute('target', '_blank');
    await expect(a).toHaveAttribute('rel', /noopener/);
  }
  const popup = page.waitForEvent('popup');
  await book.click();
  await (await popup).close();

  // Backwards through every beat: the tap is undone when leaving the last beat.
  for (let i = BEATS.length - 2; i >= 0; i--) {
    const p = mid(ranges[i] as [number, number], 0.6);
    await scrollTo(page, p, '.sentrax-scroll');
    await settle(frame, p);
    await expect(frame.locator('.ss')).toHaveAttribute('data-beat', BEATS[i] as string);
    await expect(frame.locator('.ss')).toHaveAttribute('data-text', 'beat');
  }

  // Auto-find: scrolling past the last beat without tapping finds the pump by itself.
  await scrollTo(page, 1, '.sentrax-scroll');
  await settle(frame, 1);
  await expect(frame.locator('.ss')).toHaveAttribute('data-text', 'found');
  await expect(frame.locator('.ss')).toHaveAttribute('data-cta', 'true');

  const events = tracked.map((t) => t.event);
  expect(events).toContain('scroll_story_view');
  expect(events).toContain('find_tapped');
  expect(events).toContain('find_auto');
  expect(tracked).toContainEqual({
    event: 'cta_clicked',
    props: { cta: 'book_meeting', placement: 'scroll_story' },
  });
  for (const beat of BEATS) expect(tracked).toContainEqual({ event: 'scroll_beat', props: { beat } });
  expect(errors).toEqual([]);
});

test.describe('stage selection', () => {
  test.skip(({ isMobile }) => isMobile, 'detection runs the same on both viewports; desktop covers it');

  test('?force=3d, ?force=video and ?force=static each pick their stage', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    const failed: string[] = [];
    page.on('response', (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    });

    await page.goto('scroll/?force=3d');
    await expect(page.locator('.ss')).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
    await expect(page.locator('.ss')).toHaveAttribute('data-mode', '3d');
    await expect(page.locator('.ss-canvas')).toHaveCount(1);

    await page.goto('scroll/?force=video');
    await expect(page.locator('.ss')).toHaveAttribute('data-mode', 'video');
    await expect(page.locator('.ss')).toHaveAttribute('data-reason', 'forced');
    await expect(page.locator('.ss-canvas')).toHaveCount(0);
    const video = page.locator('.ss-media video.is-front');
    await expect(video).toHaveCount(1);
    await expect(page.locator('.ss-media')).toHaveAttribute('data-clip', 'establish');
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 30_000 })
      .toBeGreaterThanOrEqual(2);
    // The clip follows the scroll position.
    const ranges = await page.evaluate(() => (window.__scrollStory as StoryHooks).ranges());
    await scrollTo(page, mid(ranges[3] as [number, number]), '.ss-track');
    await expect(page.locator('.ss-media')).toHaveAttribute('data-clip', 'relay', { timeout: 30_000 });
    await expect(page.locator('.ss-copy.is-in .ss-headline')).toHaveAttribute(
      'aria-label',
      'No gateway in every room.',
    );

    await page.goto('scroll/?force=static');
    await expect(page.locator('.ss')).toHaveAttribute('data-mode', 'static');
    const img = page.locator('.ss-media img.is-front');
    await expect(img).toHaveCount(1);
    await expect
      .poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth), { timeout: 30_000 })
      .toBeGreaterThan(0);
    expect(await img.getAttribute('src')).toMatch(/scroll-media\/landscape\/establish\.webp$/);

    expect(failed).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('detection picks video without WebGL2, on low memory, and posters with reduced motion', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    // No WebGL2.
    const noGl = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await noGl.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        id: string,
        ...rest: unknown[]
      ) {
        if (id === 'webgl2') return null;
        return (get as (...a: unknown[]) => unknown).call(this, id, ...rest);
      } as typeof get;
    });
    const p1 = await noGl.newPage();
    const tracked = collectTracked(p1);
    await p1.goto('scroll/');
    await expect(p1.locator('.ss')).toHaveAttribute('data-mode', 'video');
    await expect(p1.locator('.ss')).toHaveAttribute('data-reason', 'no-webgl2');
    await expect
      .poll(() => tracked.find((t) => t.event === 'fallback_used')?.props)
      .toEqual({
        reason: 'no-webgl2',
        mode: 'video',
      });
    await noGl.close();

    // navigator.deviceMemory of 2 GB or less.
    const lowMem = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await lowMem.addInitScript(() => Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 }));
    const p2 = await lowMem.newPage();
    await p2.goto('scroll/');
    await expect(p2.locator('.ss')).toHaveAttribute('data-mode', 'video');
    await expect(p2.locator('.ss')).toHaveAttribute('data-reason', 'low-memory');
    await lowMem.close();

    // prefers-reduced-motion.
    const still = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
    });
    const p3 = await still.newPage();
    await p3.goto('scroll/');
    await expect(p3.locator('.ss')).toHaveAttribute('data-mode', 'static');
    await expect(p3.locator('.ss')).toHaveAttribute('data-reason', 'reduced-motion');
    await still.close();
  });

  test('the same scroll position renders the same timeline state forwards and backwards', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    // The state under test does not depend on the canvas size; a smaller one renders faster.
    await page.setViewportSize({ width: 960, height: 600 });
    await page.goto('scroll/?force=3d');
    await expect(page.locator('.ss')).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
    const positions = [0.08, 0.27, 0.46, 0.63, 0.78];
    const forwards: string[] = [];
    for (const p of positions) {
      await scrollTo(page, p, '.ss-track');
      await settle(page, p);
      forwards.push(await page.evaluate(() => (window.__scrollStory as StoryHooks).key()));
    }
    await scrollTo(page, 1, '.ss-track');
    await settle(page, 1);
    const backwards: string[] = [];
    for (const p of [...positions].reverse()) {
      await scrollTo(page, p, '.ss-track');
      await settle(page, p);
      backwards.unshift(await page.evaluate(() => (window.__scrollStory as StoryHooks).key()));
    }
    expect(new Set(forwards).size).toBe(positions.length);
    expect(backwards).toEqual(forwards);
  });
});

test.describe('embed', () => {
  test.skip(({ isMobile }) => isMobile, 'the loader behaves the same on both viewports; desktop covers it');

  test('plain HTML host page: nothing loads before the section is near, no layout shift, host untouched', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const errors = collectErrors(page);
    const story: string[] = [];
    page.on('request', (r) => {
      if (/\/scroll\/|\/story-assets\/|scroll-media|\/src\/scroll\//.test(r.url())) story.push(r.url());
    });
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as Array<
          PerformanceEntry & { value: number; hadRecentInput: boolean }
        >) {
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('embed-test/');
    const box = page.locator('.sentrax-scroll');
    await expect(box).toHaveAttribute('data-ss-mounted', '1');
    // The host page hears the story's events (EMBED.md, analytics on the host page).
    await page.evaluate(() => {
      const w = window as unknown as { __hostEvents: Array<{ type: string; payload?: { event?: string } }> };
      w.__hostEvents = [];
      document.querySelector('.sentrax-scroll')?.addEventListener('sentrax-scroll', (e) => {
        w.__hostEvents.push((e as CustomEvent<{ type: string; payload?: { event?: string } }>).detail);
      });
    });
    const below = await page.locator('#below').evaluate((e) => (e as HTMLElement).offsetTop);
    const vh = await page.evaluate(() => window.innerHeight);
    // The snippet reserves the full 600vh up front.
    expect(
      Math.abs((await box.evaluate((e) => (e as HTMLElement).offsetHeight)) - vh * 6),
    ).toBeLessThanOrEqual(2);

    // Scroll down in steps: no iframe and no story request while the section is more than a viewport away.
    let loadedAt: number | null = null;
    for (let y = 0; y < 20_000 && loadedAt === null; y += Math.round(vh / 4)) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      // Two animation frames: the loader's intersection callback for this position has run (a fixed
      // delay is not enough when the machine is busy).
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
      );
      const distance = await box.evaluate((e) => e.getBoundingClientRect().top - window.innerHeight);
      const count = await page.locator('.sentrax-scroll iframe').count();
      if (count) loadedAt = distance;
      else expect(story, `requests while the section is ${distance}px below the fold`).toEqual([]);
    }
    expect(loadedAt).not.toBeNull();
    // Loaded within about one viewport of the screen, not earlier.
    expect(loadedAt as number).toBeLessThanOrEqual(vh);
    expect(loadedAt as number).toBeGreaterThan(vh * 0.5);

    // Scrolling through the section drives the story.
    await scrollTo(page, 0, '.sentrax-scroll');
    const frame = await storyFrame(page);
    await expect(box).toHaveAttribute('data-ss-ready', '1');
    await scrollTo(page, 0.5, '.sentrax-scroll');
    await settle(frame, 0.5);
    await expect(frame.locator('.ss')).toHaveAttribute('data-beat', 'rooms');
    // The mouse wheel over the story scrolls the host page (the iframe itself never scrolls).
    const before = await page.evaluate(() => window.scrollY);
    const vw = await page.evaluate(() => window.innerWidth);
    await page.mouse.move(vw / 2, vh / 2);
    await page.mouse.wheel(0, 600);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 30_000 })
      .toBeGreaterThan(before + 300);

    const hostEvents = await page.evaluate(
      () =>
        (window as unknown as { __hostEvents: Array<{ type: string; payload?: { event?: string } }> })
          .__hostEvents,
    );
    expect(hostEvents.some((e) => e.type === 'ready')).toBe(true);
    expect(hostEvents.some((e) => e.type === 'track' && e.payload?.event === 'scroll_beat')).toBe(true);

    // No layout shift, host layout and styles as they were.
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBe(0);
    expect(await page.locator('#below').evaluate((e) => (e as HTMLElement).offsetTop)).toBe(below);
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Georgia');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      'rgb(250, 250, 250)',
    );
    expect(errors).toEqual([]);
  });
});
