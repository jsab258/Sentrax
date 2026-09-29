import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import './styles.css';
import { ScrollApp } from './app';
import { readEnv } from './detect';
import { defaultStoryId, scrollStories } from './stories';

/**
 * Entry of the scroll story page (scroll/index.html). Standalone it scrolls itself; inside the embed
 * loader's iframe (?embed=1) the host page scrolls and sends the progress. ?force=3d|video|static
 * overrides device detection, ?capture=1 is for the clip script.
 */
const q = new URLSearchParams(window.location.search);
const entry = scrollStories[q.get('story') ?? defaultStoryId] ?? scrollStories[defaultStoryId];
const host = document.getElementById('scroll-root');
if (entry && host) {
  const app = new ScrollApp(host, {
    story: entry.story,
    timeline: entry.timeline,
    embed: q.get('embed') === '1',
    capture: q.get('capture') === '1',
    env: readEnv(window.location.search),
  });
  void app.start();
}
