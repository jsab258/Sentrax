import type { StoryState } from './state';
import type { Copy, ScrollStory } from './stories/types';

export interface OverlayLinks {
  book: string;
  demo: string;
}

export interface OverlayHandlers {
  onFind: () => void;
  onCta: (cta: 'book_meeting' | 'explore_demo') => void;
}

const LABELS = {
  book: 'Book a meeting',
  demo: 'Explore the full demo',
  newTab: 'opens in a new tab',
  solix: 'SOLIX',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Headline split into words for the word-by-word reveal. */
function headline(text: string): HTMLHeadingElement {
  const h = el('h2', 'ss-headline');
  h.setAttribute('aria-label', text);
  text.split(' ').forEach((w, i) => {
    const s = el('span', 'ss-w', w);
    s.setAttribute('aria-hidden', 'true');
    s.style.setProperty('--i', String(i));
    h.append(s, ' ');
  });
  return h;
}

function copyBlock(copy: Copy, key: string): HTMLDivElement {
  const d = el('div', 'ss-copy');
  d.dataset.copy = key;
  d.append(headline(copy.headline));
  if (copy.body) d.append(el('p', 'ss-body', copy.body));
  return d;
}

/**
 * The story's text over the stage (real HTML, SCROLL-SPEC.md section 2): one headline and one line per
 * beat, the Find button, the found state with the two calls to action, the phone-style result card and
 * the "Illustrative animation" label.
 */
export class Overlay {
  readonly root: HTMLDivElement;
  private readonly blocks: HTMLDivElement[] = [];
  private readonly tryBlock: HTMLDivElement;
  private readonly foundBlock: HTMLDivElement;
  private readonly findButton: HTMLButtonElement;
  private readonly cta: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private active: HTMLDivElement | null = null;

  constructor(story: ScrollStory, links: OverlayLinks, handlers: OverlayHandlers) {
    this.root = el('div', 'ss-overlay');
    const text = el('div', 'ss-text');
    story.beats.forEach((b, i) => {
      if (i === story.beats.length - 1) return;
      const block = copyBlock(b.copy, b.id);
      this.blocks.push(block);
      text.append(block);
    });
    const last = story.beats[story.beats.length - 1];
    this.tryBlock = copyBlock(last?.copy ?? { headline: '', body: '', approved: false }, 'try');
    this.findButton = el('button', 'ss-find', story.find.button);
    this.findButton.type = 'button';
    this.findButton.dataset.testid = 'find';
    this.findButton.addEventListener('click', () => handlers.onFind());
    this.tryBlock.append(this.findButton);
    this.foundBlock = copyBlock(story.find.found, 'found');
    this.cta = el('div', 'ss-cta');
    const book = el('a', 'ss-btn ss-btn-primary', LABELS.book);
    book.href = links.book;
    book.dataset.testid = 'cta-book';
    const demo = el('a', 'ss-btn ss-btn-secondary', LABELS.demo);
    demo.href = links.demo;
    demo.dataset.testid = 'cta-demo';
    for (const [a, cta] of [
      [book, 'book_meeting'],
      [demo, 'explore_demo'],
    ] as const) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.append(Object.assign(el('span', 'ss-sr', ` (${LABELS.newTab})`)));
      a.addEventListener('click', () => handlers.onCta(cta));
    }
    this.cta.append(book, demo);
    this.foundBlock.append(this.cta);
    text.append(this.tryBlock, this.foundBlock);

    this.card = el('div', 'ss-card');
    this.card.dataset.testid = 'card';
    const phone = el('div', 'ss-phone');
    const bar = el('div', 'ss-phone-bar', LABELS.solix);
    const result = el('div', 'ss-result');
    result.append(
      el('span', 'ss-result-dot'),
      el('strong', 'ss-result-title', story.find.card.title),
      el('span', 'ss-result-place', story.find.card.place),
      el('span', 'ss-result-when', story.find.card.when),
    );
    phone.append(bar, result);
    this.card.append(phone);

    const label = el('div', 'ss-label', story.label);
    this.root.append(el('div', 'ss-scrim'), text, this.card, label);
  }

  update(state: StoryState): void {
    const block =
      state.text.mode === 'found'
        ? this.foundBlock
        : state.text.mode === 'try'
          ? this.tryBlock
          : this.blocks[state.text.beat];
    if (block !== this.active) {
      for (const b of [...this.blocks, this.tryBlock, this.foundBlock]) {
        const on = b === block;
        b.classList.toggle('is-in', on);
        b.setAttribute('aria-hidden', on ? 'false' : 'true');
        b.inert = !on;
      }
      this.active = block ?? null;
    }
    this.cta.classList.toggle('is-in', state.cta);
    const c = state.fx.card;
    this.card.style.opacity = String(c);
    this.card.style.transform = `translateY(${(1 - c) * 24}px) scale(${0.96 + 0.04 * c})`;
    this.card.style.visibility = c > 0.01 ? 'visible' : 'hidden';
  }
}
