/**
 * URL of a file in public/, relative to the app's base path: './' for local and embed builds, the Pages
 * site path (for example '/Sentrax/') for the online preview. Keeps assets loading under any base.
 */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\.?\//, '')}`;
}
