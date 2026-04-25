/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GHOST_URL?: string;
  readonly VITE_GHOST_CONTENT_KEY?: string;
  readonly VITE_PAGE_SIZE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
