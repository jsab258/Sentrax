# Embedding the scroll story

The homepage scroll story (SCROLL-SPEC.md) runs inside the WordPress (Elementor) homepage without touching
the page's own styles or scripts. A small loader script on the page finds the story section, loads the
story into an iframe once the section is about one screen away, and passes the page's scroll position to
it. Why an iframe and not a Shadow DOM mount: DECISIONS.md 123 and 124.

## The snippet

Paste this into an Elementor **HTML** widget, in a full-width section, where the story should play.
Replace `https://STORY-HOST/` with the address the story is deployed to (for the current online preview:
`https://jsab258.github.io/Sentrax/`).

```html
<div class="sentrax-scroll" style="position: relative; height: 600vh; background: #03040a"></div>
<script src="https://STORY-HOST/scroll-embed.js" async></script>
```

- The inline `height: 600vh` reserves the whole scroll track before anything loads, so nothing on the page
  moves when the story appears (no layout shift). Keep it in the snippet.
- The loader is one small file (10 KB gzip or less, checked by the build). Nothing else is requested until
  the section is within about one screen height of the viewport.
- The story page defaults to `scroll/` next to the loader. Set `data-src` (absolute, or relative to the host
  page) to point elsewhere.

### Attributes

| Attribute     | Values                  | Default                  | Purpose                                     |
| ------------- | ----------------------- | ------------------------ | ------------------------------------------- |
| `data-src`    | URL                     | `scroll/` next to loader | Where the story page lives                  |
| `data-height` | number (vh)             | `600`                    | Only used when the inline height is missing |
| `data-force`  | `3d`, `video`, `static` | none (device detection)  | Testing only                                |
| `data-title`  | text                    | `Sentrax scroll story`   | The iframe's accessible title               |

## Elementor settings

- **Overflow**: the story stays pinned while the visitor scrolls through its section (CSS sticky). Sticky
  stops working if any parent of the widget clips its overflow. Leave the section's and column's
  **Overflow** on **Default** (not Hidden), and do not put the widget in a container with a fixed height.
- **Width**: use a full-width (stretched) section with no padding, so the story fills the screen.
- **Motion effects**: leave them off for this section (transforms on a parent also break sticky).
- **Content Security Policy**: if the site sends one, allow the story host in `frame-src`.

## Analytics on the host page

The story reports its events (scroll_story_view, scroll_beat with the beat id, find_tapped, find_auto,
cta_clicked, fallback_used with the reason) to the loader, which re-dispatches each one as a
`sentrax-scroll` DOM event on the section. To forward them, for example to a Google Tag Manager data layer,
add this after the snippet:

```html
<script>
  document.querySelector('.sentrax-scroll').addEventListener('sentrax-scroll', function (e) {
    if (e.detail.type === 'track' && window.dataLayer) {
      window.dataLayer.push(Object.assign({ event: e.detail.payload.event }, e.detail.payload.props));
    }
  });
</script>
```

Other `e.detail.type` values: `ready` (the story has loaded), `beat` (`payload.beat` is the beat id) and
`cta_click` (`payload.cta` is `book_meeting` or `explore_demo`).

## Tested

- `embed-test/index.html` is a plain HTML host page with the snippet above (paths relative to the repo's
  build). `e2e/scroll.spec.ts` ("embed") checks that no story file is requested while the section is more
  than a viewport away, that the iframe loads within one viewport, that the cumulative layout shift is 0,
  that content below the section does not move and that the host page's fonts and colours are unchanged.
- `home-preview/` is the homepage mock for the team demo, built with the same snippet.
