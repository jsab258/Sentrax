# Brand

Status: NOT EXTRACTED. The values in src/brand/brand.ts are neutral placeholders, not Sentrax colors or fonts. The dev brand sheet (`?dev=brand`) shows a warning banner while the status is `placeholder`.

Why: SPEC section 10 requires the brand to be extracted from sentrax.com. The build environment's network policy blocks sentrax.com, so neither the Elementor kit CSS, nor the computed homepage styles, nor the header logo could be read. Web search snippets do not contain CSS, so they cannot stand in.

## Extraction procedure (ready to run)

`npm run brand:extract` (scripts/extract-brand.mjs) opens https://sentrax.com/ in Chromium and writes to reference/brand/:

1. Elementor global kit: the `elementor-kit-<id>` body class, every `--e-global-color-*` and `--e-global-typography-*` custom property, and the raw kit stylesheet (`/wp-content/uploads/elementor/css/post-<id>.css`).
2. Computed styles on the homepage for body, h1 to h3, paragraphs, links, `.elementor-button`, header, footer and nav links: color, background, font family, size, weight, line height, letter spacing, text transform, border radius.
3. Loaded web fonts (`document.fonts`) and every stylesheet URL, to find where the font files come from.
4. The header logo, downloaded as served (SVG if the site serves SVG), plus its alt text and natural size.
5. A homepage screenshot, for reference only (not used in the app).

After extraction:

- Copy the values into src/brand/brand.ts, set `status: 'extracted'`, and fill the source table below.
- Self-host the fonts (from @fontsource if the family is published there, otherwise the files the site serves, after checking the font license). No runtime requests to Google Fonts or other third parties.
- Put the logo under public/brand/ and set `brand.logo.src`.
- From then on the brand values are not changed (SPEC section 10).

## Token sources

| Token             | Value | Source (kit variable, selector or file) |
| ----------------- | ----- | --------------------------------------- |
| colors.primary    | TBD   | TBD                                     |
| colors.secondary  | TBD   | TBD                                     |
| colors.accent     | TBD   | TBD                                     |
| colors.text       | TBD   | TBD                                     |
| colors.textMuted  | TBD   | TBD                                     |
| colors.background | TBD   | TBD                                     |
| colors.surface    | TBD   | TBD                                     |
| colors.border     | TBD   | TBD                                     |
| colors.onPrimary  | TBD   | TBD                                     |
| fonts.heading     | TBD   | TBD                                     |
| fonts.body        | TBD   | TBD                                     |
| logo              | TBD   | TBD                                     |

## Overlay colors

The 3D world uses realistic colors. Brand colors are reserved for the Radio, Data and Insight overlays so the technology stands out (SPEC section 10). The overlay tokens map to brand palette entries once they are known:

| Overlay token   | Used for                                          | Brand palette entry |
| --------------- | ------------------------------------------------- | ------------------- |
| overlay.rssi    | RSSI range rings, trilateration, uncertainty disk | TBD                 |
| overlay.aoa     | AoA rays and estimate dot                         | TBD                 |
| overlay.bilink  | BiLink room glow and relay arc                    | TBD                 |
| overlay.data    | Data packets, network plane, protocol labels      | TBD                 |
| overlay.insight | Dashboard highlights, in-scene labels, heatmap    | TBD                 |
| overlay.alert   | Alerts                                            | TBD                 |

If the palette has fewer distinct colors than the overlays need, derived tints of palette colors will be proposed at the M3 checkpoint rather than new colors being added silently.

## Contrast

UI text and controls must meet WCAG AA (4.5:1 for body text, 3:1 for large text and UI components). A contrast test will check the extracted pairs once they exist.
