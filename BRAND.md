# Brand

Status: EXTRACTED on 2026-09-26 from https://sentrax.com/ with `npm run brand:extract` (scripts/extract-brand.mjs). Raw output: reference/brand/extracted.json, reference/brand/logo.png, reference/brand/homepage.png (reference only).

Values live in src/brand/brand.ts and are not changed from here on (SPEC section 10).

## What the site defines

The site uses the Woodmart theme with Elementor. They define two palettes:

| Source                            | Variable                                       | Value     | Visible on the live site?                      |
| --------------------------------- | ---------------------------------------------- | --------- | ---------------------------------------------- |
| Woodmart theme                    | `--wd-primary-color`                           | `#D31F4C` | Yes: every CTA button, logo "x"                |
| Woodmart theme                    | `--wd-alternative-color`                       | `#352E86` | Yes: logo wordmark                             |
| Woodmart theme                    | `--wd-text-color`                              | `#777777` | Yes: body text                                 |
| Woodmart theme                    | `--wd-entities-title-color`, `--wd-link-color` | `#333333` | Yes: titles, links                             |
| Elementor kit (`elementor-kit-5`) | `--e-global-color-primary`                     | `#ED5087` | Barely                                         |
| Elementor kit                     | `--e-global-color-secondary`                   | `#520088` | Barely                                         |
| Elementor kit                     | `--e-global-color-text`                        | `#000000` | Yes: computed color of h1 to h3 and paragraphs |
| Elementor kit                     | `--e-global-color-accent`                      | `#2E0075` | Barely                                         |
| Header logo (sampled)             | signal waves                                   | `#6683C2` | Yes                                            |

Fonts:

| Source         | Variable or selector                                             | Value                                                  |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| Woodmart theme | `--wd-title-font`, `--wd-entities-title-font`                    | Poppins (titles weight 500 to 600)                     |
| Woodmart theme | `--wd-text-font`, `--wd-header-el-font`, `--wd-alternative-font` | Lato                                                   |
| Computed       | h1 to h3                                                         | Poppins, 600 (h1, h2), 500 (h3)                        |
| Computed       | body, p, nav                                                     | Lato, 400; nav 12 to 13 px uppercase                   |
| Elementor kit  | `--e-global-typography-*-font-family`                            | Roboto, Roboto Slab (Elementor defaults, not rendered) |

Note: the page ships `@font-face` rules for Roboto and Roboto Slab only. Lato and Poppins are referenced but no `@font-face` for them was found, so visitors without those fonts installed likely see Arial. Logged in SITE-ISSUES.md.

Other computed values: CTA buttons `#D31F4C` background, `#FFFFFF` text, 10 px radius, uppercase; light buttons `#F3F3F3` background, `#E9E9E9` border.

## Token sources (src/brand/brand.ts)

| Token             | Value                                        | Source                                                                        |
| ----------------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| colors.primary    | `#D31F4C`                                    | `--wd-primary-color`; computed background of CTA buttons                      |
| colors.secondary  | `#352E86`                                    | `--wd-alternative-color`; logo wordmark                                       |
| colors.accent     | `#6683C2`                                    | Header logo signal waves (pixel sample of sentrax_logo.png)                   |
| colors.text       | `#000000`                                    | `--e-global-color-text`; computed color of headings and paragraphs            |
| colors.textMuted  | `#333333`                                    | `--wd-entities-title-color`, `--wd-link-color`                                |
| colors.background | `#FFFFFF`                                    | Computed body background                                                      |
| colors.surface    | `#FFFFFF`                                    | Computed body background                                                      |
| colors.surfaceAlt | `#F3F3F3`                                    | Computed background of light theme buttons                                    |
| colors.border     | `#E9E9E9`                                    | Computed border of light theme buttons                                        |
| colors.onPrimary  | `#FFFFFF`                                    | Computed text color of CTA buttons                                            |
| kit.*             | see above                                    | `.elementor-kit-5` custom properties, verbatim                                |
| radius.button     | `10px`                                       | Computed border radius of CTA buttons                                         |
| fonts.heading     | Poppins 500, 600                             | `--wd-title-font`; computed h1 to h3                                          |
| fonts.body        | Lato 400, 700                                | `--wd-text-font`; computed body                                               |
| logo              | `public/brand/sentrax-logo.png`, 250 x 95 px | Header logo `https://sentrax.com/wp-content/uploads/2023/10/sentrax_logo.png` |

Choice made: the UI follows what the site renders (Woodmart colors), not the barely visible Elementor kit colors. The kit colors are kept verbatim and used for overlays.

Body text: the site's `#777777` on white is 4.48:1, just under WCAG AA (4.5:1) for normal text, so the UI uses `#333333` (also a theme value) for secondary text.

## Fonts

Lato and Poppins are Google Fonts under the SIL Open Font License 1.1. They are self-hosted through @fontsource/lato and @fontsource/poppins (latin subset, only the weights above), bundled by Vite. No runtime requests to Google or any other third party.

Logo: only a PNG (250 x 95 px) is served in the header. An SVG would be sharper on high-DPI screens; if Sentrax has one, it can replace the PNG without code changes.

## Overlay colors (proposed mapping, to confirm at M3)

The 3D world uses realistic colors. Brand colors are reserved for the Radio, Data and Insight overlays (SPEC section 10). All six overlay colors come from the palette above; no new colors were added.

| Overlay token   | Used for                                          | Value     | Palette entry           |
| --------------- | ------------------------------------------------- | --------- | ----------------------- |
| overlay.rssi    | RSSI range rings, trilateration, uncertainty disk | `#6683C2` | Logo signal blue        |
| overlay.aoa     | AoA rays and estimate dot                         | `#ED5087` | Elementor kit primary   |
| overlay.bilink  | BiLink room glow and relay arc                    | `#520088` | Elementor kit secondary |
| overlay.data    | Data packets, network plane, protocol labels      | `#352E86` | Theme alternative       |
| overlay.insight | Dashboard highlights, in-scene labels, heatmap    | `#2E0075` | Elementor kit accent    |
| overlay.alert   | Alerts                                            | `#D31F4C` | Theme primary           |

Three of these are close purples. If they are hard to tell apart in the 3D view, tints of these palette colors will be proposed at the M3 checkpoint rather than new colors being added silently.

## Contrast

src/brand/brand.test.ts checks the UI text pairs against WCAG AA (4.5:1) and the focus ring (secondary on white, 11.1:1) against 3:1.
