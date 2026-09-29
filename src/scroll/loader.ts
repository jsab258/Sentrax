/**
 * Embed loader for the homepage scroll story (EMBED.md). A classic script, no imports, kept tiny: it
 * finds each `.sentrax-scroll` container, keeps its reserved height, and only when the container comes
 * within about one viewport of the screen inserts the story in an iframe inside a sticky wrapper. It then
 * sends the host page's scroll progress through the section to the iframe with postMessage. The host
 * page's own styles and scripts are never touched; the story's CSS and JavaScript stay inside the iframe.
 *
 * Container attributes: data-src (story page URL, relative to the page; default: scroll/ next to this
 * script), data-look (a, b or c), data-force (3d, video or static, for testing), data-height (track length
 * in vh, default 600).
 */
(() => {
  const HOST = 'sentrax-scroll-host';
  const STORY = 'sentrax-scroll';
  const script = document.currentScript as HTMLScriptElement | null;
  const base = script?.src || window.location.href;

  function mount(el: HTMLElement): void {
    if (el.dataset.ssMounted) return;
    el.dataset.ssMounted = '1';
    const d = el.dataset;
    // The snippet reserves the height inline; this only fills it in when a host forgot to.
    if (!el.style.height) el.style.height = `${Number(d.height) || 600}vh`;
    if (!el.style.position) el.style.position = 'relative';
    const stick = document.createElement('div');
    stick.style.cssText = 'position:sticky;top:0;width:100%;height:100vh;overflow:hidden;background:#05040f';
    el.append(stick);

    // data-src is relative to the host page, like any URL in its HTML; the default sits next to this script.
    const url = d.src ? new URL(d.src, window.location.href) : new URL('scroll/', base);
    url.searchParams.set('embed', '1');
    if (d.look) url.searchParams.set('look', d.look);
    if (d.force) url.searchParams.set('force', d.force);
    let frame: HTMLIFrameElement | null = null;
    let ready = false;
    let queued = false;

    const progress = (): number => {
      const r = el.getBoundingClientRect();
      return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
    };
    const send = (): void => {
      queued = false;
      if (frame?.contentWindow && ready) {
        frame.contentWindow.postMessage({ source: HOST, type: 'progress', value: progress() }, url.origin);
      }
    };
    const queue = (): void => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(send);
    };

    const load = (): void => {
      frame = document.createElement('iframe');
      frame.src = url.href;
      frame.title = d.title || 'Sentrax scroll story';
      frame.setAttribute('allow', 'autoplay; fullscreen');
      frame.style.cssText = 'display:block;width:100%;height:100%;border:0;background:#05040f';
      stick.append(frame);
      el.dataset.ssLoaded = '1';
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        load();
      },
      { rootMargin: '100% 0px 100% 0px' },
    );
    io.observe(el);

    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    window.addEventListener('message', (e) => {
      const m = e.data as { source?: string; type?: string; payload?: unknown } | null;
      if (!frame || e.source !== frame.contentWindow || !m || m.source !== STORY) return;
      if (m.type === 'ready') {
        ready = true;
        el.dataset.ssReady = '1';
        send();
      }
      // Lets the host page forward the story's events to its own analytics.
      el.dispatchEvent(new CustomEvent('sentrax-scroll', { detail: { type: m.type, payload: m.payload } }));
    });
  }

  const run = (): void => document.querySelectorAll<HTMLElement>('.sentrax-scroll').forEach(mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
