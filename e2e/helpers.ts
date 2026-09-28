import type { Page } from '@playwright/test';

/** Page errors and console errors seen while a test runs (every smoke test expects none). */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/** Analytics events the default console sink logs (`[track] <event> <props>`). */
export function collectTracked(page: Page): Array<{ event: string; props: Record<string, unknown> }> {
  const out: Array<{ event: string; props: Record<string, unknown> }> = [];
  page.on('console', async (m) => {
    if (m.type() !== 'info' || !m.text().startsWith('[track]')) return;
    const [, event, props] = m.args();
    out.push({
      event: String(await event?.jsonValue()),
      props: ((await props?.jsonValue()) ?? {}) as Record<string, unknown>,
    });
  });
  return out;
}

/** Dev handle (`window.__sentrax`, dev server and preview builds). */
export interface SentraxHandle {
  activeSim: () => { time: number; agents: { agents: Map<string, { node: string }> } };
  activePlayer: () => { finish: () => void; index: number; story: { id: string } } | null;
}

/** Finishes the current story step instantly (as Next does), so tests need not wait for it. */
export async function finishStep(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __sentrax: SentraxHandle }).__sentrax.activePlayer()?.finish();
  });
}

export async function simTime(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __sentrax: SentraxHandle }).__sentrax.activeSim().time);
}
