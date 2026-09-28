import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { credits } from './credits';

/** The Credits panel lists every recorded asset in ASSETS.md with the same author and license. */
function recordedAssets(): Array<{ name: string; author: string; license: string }> {
  const md = readFileSync(join(import.meta.dirname, '..', '..', 'ASSETS.md'), 'utf8');
  const section = md.split('## Recorded assets')[1]?.split('\n## ')[0] ?? '';
  return section
    .split('\n')
    .filter((l) => l.startsWith('|') && !l.startsWith('| Asset') && !l.startsWith('| ---'))
    .map((l) => l.split('|').map((c) => c.trim()))
    .map((c) => ({ name: c[1] ?? '', author: c[3] ?? '', license: c[4] ?? '' }));
}

describe('credits', () => {
  const all = credits.flatMap((g) => g.items);

  it('lists every recorded asset of ASSETS.md with its author and license', () => {
    const rows = recordedAssets();
    expect(rows.length).toBeGreaterThanOrEqual(16);
    for (const row of rows) {
      const c = all.find((x) => x.name === row.name);
      expect(c, row.name).toBeDefined();
      expect(c?.author, row.name).toBe(row.author);
      expect(c?.license, row.name).toBe(row.license);
    }
  });

  it('links every credit over https', () => {
    for (const c of all) expect(c.url, c.name).toMatch(/^https:\/\//);
  });

  it('uses only licenses the SPEC allows (no NC, ND or editorial-only)', () => {
    for (const c of all) expect(c.license, c.name).not.toMatch(/NC|ND|editorial/i);
  });
});
