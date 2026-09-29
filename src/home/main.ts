import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/lato/400.css';
import './home.css';
import { siteUrl } from '../scroll/paths';

/**
 * Homepage mock at /home-preview/ (SCROLL-SPEC.md section 7): header, the live homepage's hero wording,
 * the scroll story through the same embed snippet as WordPress, two placeholder sections and a footer.
 * ?force=3d|video|static passes through to the story. Runs before the (deferred) loader script, so the
 * story container is set up when the loader mounts it.
 */
const q = new URLSearchParams(window.location.search);
const logo = document.getElementById('hp-logo') as HTMLImageElement | null;
if (logo) logo.src = siteUrl('brand/sentrax-logo.png');

const story = document.querySelector<HTMLElement>('.sentrax-scroll');
const force = q.get('force');
if (story && force) story.dataset.force = force;
