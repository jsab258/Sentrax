/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EMBED_PARENT_ORIGIN?: string;
  /** Enables dev tools (claims overlay, brand sheet) in production builds. Off by default. */
  readonly VITE_ENABLE_DEV_TOOLS?: string;
  /** Target of the teaser's "Explore the interactive demo" button; defaults to this app in guided mode. */
  readonly VITE_DEMO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
