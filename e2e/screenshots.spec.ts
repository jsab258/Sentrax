import { test } from '@playwright/test';

/**
 * Milestone screenshots. Run with `SCREENSHOTS=1 SCREENSHOT_MILESTONE=m1 npx playwright test e2e/screenshots.spec.ts`;
 * images land in docs/screenshots/<milestone>/. Skipped in the normal e2e run so CI does not rewrite them.
 */
const milestone = process.env.SCREENSHOT_MILESTONE ?? 'm1';
test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to capture milestone screenshots.');

interface Shot {
  name: string;
  url: string;
  waitFor?: string;
  fullPage?: boolean;
  desktopOnly?: boolean;
  /** Extra wait after `waitFor`, for the 3D scene to settle (software rendering is slow). */
  settleMs?: number;
  /** Cut camera flights (prefers-reduced-motion), so the shot shows where the camera lands. */
  reduced?: boolean;
  /** Click this selector before the settle wait. */
  click?: string;
}

const ready = '[data-testid="scene-stage"][data-ready="true"]';

const shots: Record<string, Shot[]> = {
  m0: [
    { name: 'shell', url: './', waitFor: 'canvas' },
    { name: 'fallback', url: './?webgl=0', waitFor: '[data-testid="webgl-fallback"]' },
    { name: 'brand-sheet', url: './?dev=brand', waitFor: '[data-testid="brand-sheet"]', fullPage: true },
    { name: 'claims-overlay', url: './?claims', waitFor: '.claims-panel' },
  ],
  m1: [
    { name: 'shell', url: './', waitFor: 'canvas' },
    { name: 'brand-sheet', url: './?dev=brand', waitFor: '[data-testid="brand-sheet"]', fullPage: true },
    { name: 'claims-overlay', url: './?claims', waitFor: '.claims-panel' },
    {
      name: 'sim-hospital-par',
      url: './?dev=sim&scene=hospital&scenario=h3-out&at=25&t=95&speed=0&select=tag-vent-02',
      waitFor: '[data-testid="sim-debug"]',
    },
    {
      name: 'sim-hospital-sos',
      url: './?dev=sim&scene=hospital&scenario=h5-sos&at=25&t=90&speed=0&select=tag-sos-nurse-3',
      waitFor: '[data-testid="sim-debug"]',
      desktopOnly: true,
    },
    {
      name: 'sim-hospital-fridge',
      url: './?dev=sim&scene=hospital&scenario=h4-open&at=25&t=150&speed=0&select=tag-fridge-01',
      waitFor: '[data-testid="sim-debug"]',
      desktopOnly: true,
    },
    {
      name: 'sim-warehouse-w1',
      url: './?dev=sim&scene=warehouse&scenario=w1-w2&at=25&t=48&speed=0&select=tag-pallet-2291',
      waitFor: '[data-testid="sim-debug"]',
    },
    {
      name: 'sim-warehouse-evacuation',
      url: './?dev=sim&scene=warehouse&scenario=w4-evac&at=25&t=90&speed=0',
      waitFor: '[data-testid="sim-debug"]',
      desktopOnly: true,
    },
    {
      name: 'sim-test-bilink',
      url: './?dev=sim&scene=test-bilink&t=60&speed=0',
      waitFor: '[data-testid="sim-debug"]',
      desktopOnly: true,
    },
    {
      name: 'sim-test-aoa',
      url: './?dev=sim&scene=test-aoa&t=60&speed=0&select=tag-walker0',
      waitFor: '[data-testid="sim-debug"]',
      desktopOnly: true,
    },
  ],
  m2: [
    { name: 'hospital-high', url: './?quality=high&stats=1', waitFor: ready, settleMs: 6000 },
    {
      name: 'hospital-medium',
      url: './?quality=medium&stats=1',
      waitFor: ready,
      settleMs: 6000,
      desktopOnly: true,
    },
    { name: 'hospital-low', url: './?quality=low&stats=1', waitFor: ready, settleMs: 4000 },
    {
      name: 'closeup-patient-room-high',
      url: './?quality=high&cam=13,5.5,-12.5,17,0.8,-18',
      waitFor: ready,
      settleMs: 6000,
      desktopOnly: true,
    },
    {
      name: 'closeup-icu-high',
      url: './?quality=high&cam=4,6,3,5,0.8,-4',
      waitFor: ready,
      settleMs: 6000,
      desktopOnly: true,
    },
    {
      name: 'closeup-station-high',
      url: './?quality=high&cam=24,6.5,-17,30,0.8,-8',
      waitFor: ready,
      settleMs: 6000,
      desktopOnly: true,
    },
    {
      name: 'closeup-patient-room-low',
      url: './?quality=low&cam=13,5.5,-12.5,17,0.8,-18',
      waitFor: ready,
      settleMs: 4000,
      desktopOnly: true,
    },
    {
      name: 'device-handover-high',
      url: './?quality=high&cam=3.2,4.2,-1.2,4.6,2.6,-4.2',
      waitFor: ready,
      settleMs: 6000,
      desktopOnly: true,
    },
    {
      name: 'swatch-sheet',
      url: './?quality=high&swatches=1',
      waitFor: ready,
      settleMs: 5000,
      desktopOnly: true,
    },
    {
      name: 'swatch-strip',
      url: './?quality=high&swatches=strip&cam=14.2,24,4,14.2,0,-11.5',
      waitFor: ready,
      settleMs: 6000,
      desktopOnly: true,
    },
  ],
};

const story = (name: string, query: string): Shot => ({
  name,
  url: `./?${query}&quality=high`,
  waitFor: ready,
  settleMs: 8000,
  reduced: true,
});

shots.m3 = [
  story('h1-step1-search', 'story=h1&step=1'),
  story('h1-step2-dashboard', 'story=h1&step=2'),
  story('h1-step3-why', 'story=h1&step=3'),
  story('h2-step3-filter', 'story=h2&step=3'),
  story('h2-step6-compare', 'story=h2&step=6'),
  story('h3-step2-below-par', 'story=h3&step=2'),
  story('h4-step2-door-open', 'story=h4&step=2'),
  story('h5-step2-routed', 'story=h5&step=2'),
  { ...story('h5-end-card', 'story=h5&step=2'), click: '[data-testid="skip"]' },
  story('sandbox', 'mode=sandbox&scene=hospital'),
  {
    ...story(
      'overlay-depth-before',
      'mode=sandbox&layers=physical,radio&lens=rssi&select=tag-crashcart-01&cam=34,7,-2,24,1,-13&dimming=0',
    ),
    desktopOnly: true,
  },
  {
    ...story(
      'overlay-depth-after',
      'mode=sandbox&layers=physical,radio&lens=rssi&select=tag-crashcart-01&cam=34,7,-2,24,1,-13',
    ),
    desktopOnly: true,
  },
];

shots.m4 = [
  story('warehouse-overview', 'mode=sandbox&scene=warehouse&layers=physical'),
  story('w1-step1-search', 'scene=warehouse&story=w1&step=1'),
  story('w1-step2-slot', 'scene=warehouse&story=w1&step=2'),
  {
    ...story('w1-step2-slot-close', 'scene=warehouse&story=w1&step=2&cam=49,10,-32,53.2,6,-39.8'),
    desktopOnly: true,
  },
  story('w2-step1-checkout', 'scene=warehouse&story=w2&step=1'),
  story('w2-step2-yard', 'scene=warehouse&story=w2&step=2'),
  {
    ...story('docks-and-yard', 'mode=sandbox&scene=warehouse&layers=physical&cam=46,24,22,20,0,8'),
    desktopOnly: true,
  },
  story('w3-step2-bottleneck', 'scene=warehouse&story=w3&step=2'),
  story('w4-step1-cage', 'scene=warehouse&story=w4&step=1'),
  story('w4-step4-located', 'scene=warehouse&story=w4&step=4'),
  story('w5-step2-excursion', 'scene=warehouse&story=w5&step=2'),
];

shots.m6 = [
  story('teaser-hospital', 'mode=teaser'),
  story('teaser-warehouse', 'mode=teaser&scene=warehouse'),
  { ...story('credits', 'scene=hospital&story=h1'), click: '[data-testid="credits-open"]', settleMs: 3000 },
  story('warehouse-device-card', 'mode=sandbox&scene=warehouse&device=len2-20-20'),
];

for (const shot of shots[milestone] ?? []) {
  test(`screenshot ${shot.name}`, async ({ page }, info) => {
    test.skip(!!shot.desktopOnly && info.project.name !== 'desktop', 'desktop only');
    if (shot.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(shot.url);
    test.setTimeout(180_000);
    if (shot.waitFor) await page.locator(shot.waitFor).first().waitFor({ timeout: 120_000 });
    if (shot.click) await page.locator(shot.click).first().click();
    await page.waitForTimeout(shot.settleMs ?? 1500);
    await page.screenshot({
      path: `docs/screenshots/${milestone}/${shot.name}-${info.project.name}.png`,
      fullPage: shot.fullPage ?? false,
    });
  });
}
