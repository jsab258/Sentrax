// Extracts brand colors, fonts and the header logo from sentrax.com (SPEC section 10):
// 1. Elementor global kit: every --e-global-color-* and --e-global-typography-* custom property.
// 2. Computed styles of body, headings, links, buttons, header and footer on the homepage.
// 3. The header logo file, downloaded as served.
// Output: reference/brand/extracted.json, reference/brand/logo.*, reference/brand/homepage.png (reference only).
// Usage: npm run brand:extract
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const out = join(import.meta.dirname, '..', 'reference', 'brand');
const URL_HOME = 'https://sentrax.com/';

async function main() {
  await mkdir(out, { recursive: true });
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch(proxy ? { proxy } : {});
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(URL_HOME, { waitUntil: 'networkidle', timeout: 90_000 });

  const data = await page.evaluate(() => {
    const kitClass = [...document.body.classList].find((c) => /^elementor-kit-\d+$/.test(c)) ?? null;
    const globals = {};
    const kitRules = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of rules) {
        if (!(rule instanceof CSSStyleRule)) continue;
        const isKit = kitClass && rule.selectorText.includes(`.${kitClass}`);
        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style[i];
          if (prop.startsWith('--e-global-')) globals[prop] = rule.style.getPropertyValue(prop).trim();
        }
        if (isKit) kitRules.push({ selector: rule.selectorText, css: rule.style.cssText, sheet: sheet.href });
      }
    }
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        selector: sel,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        textTransform: cs.textTransform,
        borderRadius: cs.borderRadius,
        borderColor: cs.borderColor,
      };
    };
    const computed = [
      'body',
      'h1',
      'h2',
      'h3',
      'p',
      'a',
      '.elementor-button',
      'header',
      '.elementor-location-header',
      'footer',
      '.elementor-location-footer',
      'nav a',
    ]
      .map(pick)
      .filter(Boolean);
    const logoEl =
      document.querySelector('.elementor-location-header .elementor-widget-theme-site-logo img') ||
      document.querySelector('.elementor-location-header img') ||
      document.querySelector('header .custom-logo') ||
      document.querySelector('header img');
    const logo = logoEl
      ? {
          src: logoEl.currentSrc || logoEl.src,
          srcset: logoEl.getAttribute('srcset'),
          alt: logoEl.alt,
          width: logoEl.naturalWidth,
          height: logoEl.naturalHeight,
        }
      : null;
    const fonts = [...document.fonts].map((f) => ({
      family: f.family,
      weight: f.weight,
      style: f.style,
      status: f.status,
    }));
    const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href);
    const themeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
    return { kitClass, globals, kitRules, computed, logo, fonts, stylesheets, themeColor };
  });

  // Raw kit CSS for the record.
  const kitId = data.kitClass?.replace('elementor-kit-', '');
  const kitSheet = data.stylesheets.find((h) => kitId && h.includes(`/elementor/css/post-${kitId}.css`));
  if (kitSheet) {
    const res = await context.request.get(kitSheet);
    if (res.ok()) await writeFile(join(out, `elementor-kit-${kitId}.css`), await res.text());
  }

  if (data.logo?.src) {
    const res = await context.request.get(data.logo.src);
    if (res.ok()) {
      const ext = extname(new URL(data.logo.src).pathname) || '.img';
      await writeFile(join(out, `logo${ext}`), await res.body());
      data.logo.file = `logo${ext}`;
    }
  }

  await page.screenshot({ path: join(out, 'homepage.png') });
  await writeFile(
    join(out, 'extracted.json'),
    JSON.stringify(
      { source: URL_HOME, extractedAt: new Date().toISOString(), kitSheet: kitSheet ?? null, ...data },
      null,
      2,
    ) + '\n',
  );
  await browser.close();

  console.log(`kit: ${data.kitClass} (${kitSheet ?? 'kit sheet not found'})`);
  console.log('global colors:');
  for (const [k, v] of Object.entries(data.globals)) if (k.includes('color')) console.log(`  ${k}: ${v}`);
  console.log('global typography:');
  for (const [k, v] of Object.entries(data.globals))
    if (k.includes('typography') && k.endsWith('font-family')) console.log(`  ${k}: ${v}`);
  console.log(`logo: ${data.logo?.src ?? 'not found'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
