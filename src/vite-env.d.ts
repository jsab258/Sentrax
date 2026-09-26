/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EMBED_PARENT_ORIGIN?: string;
  /** Enables dev tools (claims overlay, brand sheet) in production builds. Off by default. */
  readonly VITE_ENABLE_DEV_TOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
