// Downloads modelling references from sentrax.com (SPEC sections 2 and 9):
// - product photos and linked PDFs (datasheets, guides) per device into reference/devices/<model>/
// - spec lines that mention dimensions, weight, IP rating, battery or mounting into meta.json
// - plain text of the ground-truth pages into reference/pages/ for wording checks
//
// Usage: npm run refs:fetch
// In a proxied environment Node's fetch needs NODE_USE_ENV_PROXY=1 (Node 22.21 or newer).
// Product photos are used only as modelling reference and on product cards (SPEC section 9).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const UA = 'Mozilla/5.0 (sentrax-3d-demo reference fetcher)';

const DEVICES = [
  ['NODIX CEN-1', 'https://sentrax.com/product/nodix-cen-1/'],
  ['ZENIX LEN-1', 'https://sentrax.com/product/zenix-len-1/'],
  ['ZENIX LEN-2', 'https://sentrax.com/product/zenix-len-2/'],
  ['ZENIX LON-2', 'https://sentrax.com/product/zenix-lon-2/'],
  ['ZENIX LEF-3', 'https://sentrax.com/product/zenix-lef-3/'],
  ['PINIX TOW-1', 'https://sentrax.com/product/pinix-tow-1/'],
  ['PINIX TOW-5', 'https://sentrax.com/product/pinix-tow-5/'],
  ['PINIX TOK-1', 'https://sentrax.com/product/pinix-tok-1/'],
  ['PINIX TOB-1', 'https://sentrax.com/product/pinix-tob-1/'],
];

const PAGES = [
  'https://sentrax.com/',
  'https://sentrax.com/technology/',
  'https://sentrax.com/solutions/bilink-tracking/',
  'https://sentrax.com/solutions/proximity-track/',
  'https://sentrax.com/solutions/aoa-rtls/',
  'https://sentrax.com/solutions/hybrid-tracking/',
  'https://sentrax.com/applications/healthcare/',
  'https://sentrax.com/applications/manufacturing/',
  'https://sentrax.com/product/solix/',
  'https://sentrax.com/documents/',
];
const BROCHURE = 'https://sentrax.com/docs/brochures/BiLink-Proximity-Tracking-Brochure.pdf';

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, '-')
    .replace(/&nbsp;/g, ' ');
}

function htmlToText(html) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<(br|\/p|\/li|\/tr|\/h\d|\/div)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** Full-size upload URL: strips WordPress thumbnail suffixes such as -300x300. */
function fullSize(url) {
  return url.replace(/-\d{2,4}x\d{2,4}(\.(?:jpe?g|png|webp))$/i, '$1');
}

function productImages(html) {
  const urls = new Set();
  const og = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
  if (og) urls.add(decode(og[1]));
  const galleryStart = html.indexOf('woocommerce-product-gallery');
  const scope = galleryStart >= 0 ? html.slice(galleryStart, galleryStart + 60000) : html;
  for (const m of scope.matchAll(
    /(?:data-large_image|href|src)="([^"]+\/wp-content\/uploads\/[^"]+\.(?:jpe?g|png|webp))"/gi,
  )) {
    urls.add(fullSize(decode(m[1])));
  }
  return [...urls].filter((u) => !/logo|icon|favicon|placeholder/i.test(u));
}

function pdfLinks(html) {
  const urls = new Set();
  for (const m of html.matchAll(/href="([^"]+\.pdf)"/gi))
    urls.add(new URL(decode(m[1]), 'https://sentrax.com/').href);
  return [...urls];
}

const SPEC_LINE =
  /dimension|size|weight|\bmm\b|\bcm\b|\bIP ?6\d\b|battery|mount|antenna|operating temp|range/i;

async function download(url, dir) {
  const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'file');
  const res = await get(url);
  await writeFile(join(dir, name), Buffer.from(await res.arrayBuffer()));
  return name;
}

async function main() {
  const pagesDir = join(root, 'reference', 'pages');
  await mkdir(pagesDir, { recursive: true });
  for (const url of PAGES) {
    try {
      const html = await (await get(url)).text();
      const name = slug(new URL(url).pathname) || 'home';
      await writeFile(join(pagesDir, `${name}.txt`), `Source: ${url}\n\n${htmlToText(html)}\n`);
      console.log(`page  ${url}`);
    } catch (e) {
      console.warn(`page  FAILED ${url}: ${e.message}`);
    }
  }
  try {
    await download(BROCHURE, pagesDir);
    console.log(`pdf   ${BROCHURE}`);
  } catch (e) {
    console.warn(`pdf   FAILED ${BROCHURE}: ${e.message}`);
  }

  for (const [model, url] of DEVICES) {
    const dir = join(root, 'reference', 'devices', slug(model));
    await mkdir(dir, { recursive: true });
    const meta = {
      model,
      sourceUrl: url,
      fetchedAt: new Date().toISOString(),
      images: [],
      pdfs: [],
      specLines: [],
      errors: [],
    };
    try {
      const html = await (await get(url)).text();
      const text = htmlToText(html);
      await writeFile(join(dir, 'page.txt'), `Source: ${url}\n\n${text}\n`);
      meta.title = decode(html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '');
      meta.specLines = text.split('\n').filter((l) => SPEC_LINE.test(l) && l.length < 240);
      for (const img of productImages(html)) {
        try {
          meta.images.push({ file: await download(img, dir), url: img });
        } catch (e) {
          meta.errors.push(`${img}: ${e.message}`);
        }
      }
      for (const pdf of pdfLinks(html)) {
        try {
          meta.pdfs.push({ file: await download(pdf, dir), url: pdf });
        } catch (e) {
          meta.errors.push(`${pdf}: ${e.message}`);
        }
      }
    } catch (e) {
      meta.errors.push(e.message);
    }
    await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
    console.log(
      `device ${model}: ${meta.images.length} images, ${meta.pdfs.length} pdfs, ${meta.errors.length} errors`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
