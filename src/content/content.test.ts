import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { allClaims, unapprovedClaims } from './index';
import { claims } from './claims';
import { links } from './links';

// Built at runtime so this file does not contain the character it searches for.
const EM_DASH = String.fromCharCode(0x2014);
const repoRoot = join(import.meta.dirname, '..', '..');

function filesUnder(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p, exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

describe('claims policy (SPEC section 3)', () => {
  it('keeps the search-time claim unapproved', () => {
    expect(claims.searchTime.approved).toBe(false);
    expect(unapprovedClaims().map((c) => c.id)).toContain('searchTime');
  });

  it('gives every claim a unique id and a sentrax.com source', () => {
    const ids = allClaims().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of allClaims()) expect(c.sourceUrl).toMatch(/^https:\/\/sentrax\.com\//);
  });

  it('contains no percentages or prices in any claim', () => {
    for (const c of allClaims()) {
      expect(c.text, c.id).not.toMatch(/%|percent|CHF|EUR|USD|\$|€/i);
    }
  });

  it('never uses the site percentage claims', () => {
    for (const c of allClaims())
      expect(c.text, c.id).not.toMatch(/(60|70|100) ?(%|percent)|half the infrastructure/i);
  });

  it('marks every claim as verified against the live site', () => {
    for (const c of allClaims()) expect(c.verifiedAt, c.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses only the allowed accuracy figures', () => {
    expect(claims.rssiAccuracy.text).toBe('3 to 5 m');
    expect(claims.aoaAccuracy.text).toBe('sub-meter');
    expect(claims.bilinkAccuracy.text).toBe('room-level');
  });

  it('points the CTA at the booking page', () => {
    expect(links.bookMeeting).toMatch(
      /^https:\/\/outlook\.office365\.com\/owa\/calendar\/MeetupwithSentrax@sentrax\.com\//,
    );
  });
});

describe('writing rules (SPEC section 0)', () => {
  const docs = readdirSync(repoRoot)
    .filter((n) => n.endsWith('.md'))
    .map((n) => join(repoRoot, n))
    .concat(filesUnder(join(repoRoot, 'docs'), ['.md']));
  const sources = filesUnder(join(repoRoot, 'src'), ['.ts', '.tsx', '.css']);

  it('has no em-dashes in docs or source', () => {
    for (const f of [...docs, ...sources]) {
      expect(readFileSync(f, 'utf8').includes(EM_DASH), f).toBe(false);
    }
  });

  it('has no italic markdown in docs', () => {
    const italic = /(^|[\s(])(\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_)(?=[\s).,;:!?]|$)/m;
    for (const f of docs) {
      expect(italic.test(readFileSync(f, 'utf8')), f).toBe(false);
    }
  });
});
