/** prefers-reduced-motion (SPEC section 11): camera flights become cuts and radio pulses stop. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
