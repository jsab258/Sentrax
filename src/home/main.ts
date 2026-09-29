import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/lato/400.css';
import './home.css';
import { siteUrl } from '../scroll/paths';

/**
 * Homepage mock at /home-preview/ (SCROLL-SPEC.md section 7): header, the live homepage's hero wording,
 * the scroll story through the same embed snippet as WordPress, two placeholder sections and a footer.
 * ?look=a|b|c and ?force=3d|video|static pass through to the story; ?looks=1 shows a look switcher.
 * Runs before the (deferred) loader script, so the story container is set up when the loader mounts it.
 */
const LOOKS = [
  ['a', 'A Night model'],
  ['b', 'B Glass'],
  ['c', 'C Realistic night'],
] as const;

const q = new URLSearchParams(window.location.search);
const logo = document.getElementById('hp-logo') as HTMLImageElement | null;
if (logo) logo.src = siteUrl('brand/sentrax-logo.png');

const story = document.querySelector<HTMLElement>('.sentrax-scroll');
const look = q.get('look');
const current = look && LOOKS.some(([id]) => id === look) ? look : 'a';
if (story) {
  story.dataset.look = current;
  const force = q.get('force');
  if (force) story.dataset.force = force;
}

if (q.get('looks') === '1') {
  const bar = document.createElement('nav');
  bar.className = 'hp-looks';
  bar.setAttribute('aria-label', 'Story look');
  for (const [id, label] of LOOKS) {
    const a = document.createElement('a');
    const next = new URLSearchParams(q);
    next.set('look', id);
    a.href = `?${next.toString()}`;
    a.textContent = label;
    a.dataset.look = id;
    if (id === current) a.setAttribute('aria-current', 'true');
    bar.append(a);
  }
  document.body.append(bar);
}
