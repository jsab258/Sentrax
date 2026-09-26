# Device reference files

One folder per device model (for example `nodix-cen-1/`), filled by `npm run refs:fetch` on 2026-09-26:

- product photos and technical diagrams from the product page (full size)
- the official datasheet PDF linked from the product page
- `page.txt`: plain text of the product page
- `meta.json`: source URL, fetch time, downloaded files and every spec line that mentions dimensions, weight, IP rating, battery, mounting or range

Use: modelling reference and product cards only (SPEC section 9). No other imagery from sentrax.com is used. The verified summary is in docs/device-reference.md.
