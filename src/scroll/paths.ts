/**
 * The site root the story's pages and files are served from (the full demo's public files, the clips and
 * the logo live there). With an absolute base (the Pages preview, the dev server) that is the base. With
 * the default relative base ('./') it is found from this module's own URL: built chunks sit in
 * story-assets/, one level below the root, so the story works from any folder it is copied to.
 */
const base = import.meta.env.BASE_URL;
const root = base.startsWith('.')
  ? new URL(/* @vite-ignore */ '../', import.meta.url).href
  : new URL(base, window.location.href).href;

export function siteUrl(path = ''): string {
  return root + path.replace(/^\.?\//, '');
}
