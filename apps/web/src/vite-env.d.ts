/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_REMOTE_SUPPORT_URL?: string;
  /** Public site origin used by the Design Studio preview iframe (defaults to window.location.origin). */
  readonly VITE_PUBLIC_WEB_URL?: string;
}
