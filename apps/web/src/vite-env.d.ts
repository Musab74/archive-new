/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_REMOTE_SUPPORT_URL?: string;
  /** Public site origin used by the Design Studio preview iframe (defaults to window.location.origin). */
  readonly VITE_PUBLIC_WEB_URL?: string;
  /** Base URL of the previous PHP admin for menus not yet rebuilt (default https://hrdeedu.co.kr/hrd_manager). */
  readonly VITE_LEGACY_ADMIN_URL?: string;
}
