# Device reference files

One folder per device model (for example `nodix-cen-1/`), filled by `npm run refs:fetch`:

- product photos from the product page (full size)
- linked PDFs (datasheets, user guides)
- `page.txt`: plain text of the product page
- `meta.json`: source URL, fetch time, downloaded files and every spec line that mentions dimensions, weight, IP rating, battery, mounting or range

Status at M0: empty. sentrax.com is blocked by the build environment's network policy, so nothing could be downloaded. See docs/device-reference.md for what is known so far.

Use: modelling reference and product cards only (SPEC section 9). No other imagery from sentrax.com is used.
