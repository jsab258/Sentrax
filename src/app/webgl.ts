/** WebGL2 is required (SPEC section 11). `?webgl=0` forces the fallback for testing. */
export function hasWebGL2(search: string = window.location.search): boolean {
  if (new URLSearchParams(search).get('webgl') === '0') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
