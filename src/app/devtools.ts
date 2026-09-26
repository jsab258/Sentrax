/** Dev-only tools are on in the dev server, and in production builds only when explicitly enabled. */
export const devToolsEnabled: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true';
