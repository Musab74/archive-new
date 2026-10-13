import type { ZodType, ZodTypeDef } from 'zod';
import { tokenStore } from '../auth/tokenStore';
import { adminTokenStore } from '../auth/adminTokenStore';
import { errors as errorCopy } from '../strings/ko';

const envBase = (import.meta.env?.VITE_API_BASE as string | undefined) ?? '';
/** The API mounts under /v1 (https://api.timeless.uz/v1). VITE_API_BASE is the origin prefix, e.g. https://api.timeless.uz */
export const API_BASE = `${envBase.replace(/\/+$/, '')}/v1`;

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  readonly requestId?: string;
  constructor(code: string, message: string, status: number, details?: unknown, requestId?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
  get isAuth(): boolean { return this.status === 401 || this.code === 'UNAUTHENTICATED' || this.code === 'SESSION_EXPIRED'; }
  get isNetwork(): boolean { return this.code === 'NETWORK'; }
}

export function isAppError(e: unknown): e is AppError { return e instanceof AppError; }
export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (e instanceof DOMException && e.name === 'AbortError') return new AppError('ABORTED', '요청이 취소되었습니다.', 0);
  return new AppError('NETWORK', errorCopy.network, 0, e);
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  /** zod schema; parsed in dev to catch contract drift. */
  schema?: ZodType<T, ZodTypeDef, unknown>;
  /** Send the Bearer token (default true when a token exists). */
  auth?: boolean;
  /** Skip the automatic refresh+replay on 401 (used by auth endpoints themselves). */
  noRefresh?: boolean;
  signal?: AbortSignal;
  idempotencyKey?: string;
  /** Returns the raw Response for callers that need headers (ETag). */
  raw?: boolean;
  /**
   * Which access token to send. Defaults by path: /admin/*, /design/*, /auth/admin/* use the staff token
   * (adminTokenStore), everything else the learner token. A 401 refreshes the matching session only.
   */
  tokenScope?: TokenScope;
}

export type TokenScope = 'learner' | 'admin';

/** Staff endpoints: /v1/admin/*, /v1/design/*, /v1/auth/admin/*. */
export function scopeForPath(path: string): TokenScope {
  const p = path.startsWith('http') ? (() => { try { return new URL(path).pathname.replace(/^\/v1/, ''); } catch { return path; } })() : path.replace(/^\/?v1(?=\/)/, '');
  const norm = p.startsWith('/') ? p : `/${p}`;
  return norm.startsWith('/admin/') || norm === '/admin' || norm.startsWith('/design/') || norm === '/design' || norm.startsWith('/auth/admin/') || norm === '/auth/admin' ? 'admin' : 'learner';
}

export interface ApiResult<T> { data: T; response: Response }

function buildUrl(path: string, query?: Query): string {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}${url.includes('?') ? '&' : '?'}${s}` : url;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function parseError(res: Response): Promise<AppError> {
  let body: unknown = null;
  try { body = await res.json(); } catch { /* no json body */ }
  const err = (body as { error?: { code?: string; message?: string; details?: unknown }; requestId?: string } | null)?.error;
  const code = err?.code ?? (res.status === 401 ? 'UNAUTHENTICATED' : res.status === 403 ? 'FORBIDDEN' : res.status === 404 ? 'NOT_FOUND' : res.status >= 500 ? 'INTERNAL' : 'UNKNOWN');
  const message = err?.message ?? errorCopy.byCode[code] ?? errorCopy.unknown;
  return new AppError(code, message, res.status, err?.details, (body as { requestId?: string } | null)?.requestId);
}

// ---- single-flight refresh
let refreshInFlight: Promise<boolean> | null = null;
let onSessionRestored: ((payload: unknown) => void) | null = null;
let onSessionLost: (() => void) | null = null;

/** SessionProvider registers hooks so a transparent refresh also updates the React session state. */
export function registerSessionHooks(hooks: { restored: (payload: unknown) => void; lost: () => void }): () => void {
  onSessionRestored = hooks.restored;
  onSessionLost = hooks.lost;
  return () => { onSessionRestored = null; onSessionLost = null; };
}

/** POST /auth/refresh exactly once for concurrent callers; resolves true when a new access token was stored. */
export function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(buildUrl('/auth/refresh'), { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } });
      if (!res.ok) { tokenStore.clear(); onSessionLost?.(); return false; }
      const data = (await res.json()) as { accessToken?: string; expiresIn?: number };
      if (!data?.accessToken) { tokenStore.clear(); onSessionLost?.(); return false; }
      tokenStore.set(data.accessToken, data.expiresIn);
      onSessionRestored?.(data);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// ---- admin (staff) session: own refresh cookie on /v1/auth/admin, own single-flight
let adminRefreshInFlight: Promise<boolean> | null = null;
let onAdminRestored: ((payload: unknown) => void) | null = null;
let onAdminLost: (() => void) | null = null;

/** AdminSessionProvider registers hooks so a transparent admin refresh updates its React state. */
export function registerAdminSessionHooks(hooks: { restored: (payload: unknown) => void; lost: () => void }): () => void {
  onAdminRestored = hooks.restored;
  onAdminLost = hooks.lost;
  return () => { onAdminRestored = null; onAdminLost = null; };
}

/** POST /auth/admin/refresh once for concurrent callers; resolves true when a new staff access token was stored. */
export function refreshAdminAccessToken(): Promise<boolean> {
  if (adminRefreshInFlight) return adminRefreshInFlight;
  adminRefreshInFlight = (async () => {
    try {
      const res = await fetch(buildUrl('/auth/admin/refresh'), { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } });
      if (!res.ok) { adminTokenStore.clear(); onAdminLost?.(); return false; }
      const data = (await res.json()) as { accessToken?: string; expiresIn?: number };
      if (!data?.accessToken) { adminTokenStore.clear(); onAdminLost?.(); return false; }
      adminTokenStore.set(data.accessToken, data.expiresIn);
      onAdminRestored?.(data);
      return true;
    } catch {
      return false;
    } finally {
      adminRefreshInFlight = null;
    }
  })();
  return adminRefreshInFlight;
}

async function doFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    throw toAppError(e);
  }
}

export async function requestRaw<T = unknown>(path: string, opts: RequestOptions<T> = {}): Promise<ApiResult<T>> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json', ...(opts.headers ?? {}) };
  const hasBody = opts.body !== undefined && opts.body !== null;
  if (hasBody && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (method === 'POST') headers['Idempotency-Key'] = opts.idempotencyKey ?? newIdempotencyKey();
  const useAuth = opts.auth ?? true;
  const scope = opts.tokenScope ?? scopeForPath(path);
  const store = scope === 'admin' ? adminTokenStore : tokenStore;
  const token = store.get();
  if (useAuth && token) headers.Authorization = `Bearer ${token}`;

  const url = buildUrl(path, opts.query);
  const init: RequestInit = {
    method,
    headers,
    credentials: 'include',
    signal: opts.signal,
    body: hasBody ? (opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body)) : undefined,
  };

  let res = await doFetch(url, init);

  const isAuthEndpoint = path.startsWith('/auth/refresh') || path.startsWith('/auth/login') || path.startsWith('/auth/admin/refresh') || path.startsWith('/auth/admin/login');
  if (res.status === 401 && useAuth && !opts.noRefresh && !isAuthEndpoint) {
    const ok = scope === 'admin' ? await refreshAdminAccessToken() : await refreshAccessToken();
    if (ok) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${store.get()}` };
      res = await doFetch(url, { ...init, headers: retryHeaders });
    }
  }

  if (!res.ok) throw await parseError(res);

  if (res.status === 204 || res.status === 304) return { data: undefined as T, response: res };
  const text = await res.text();
  let data: unknown = text;
  if (text) {
    try { data = JSON.parse(text); } catch {
      // A non-JSON body (e.g. the SPA's index.html when the API base is wrong) must never be treated as data.
      throw new AppError('INTERNAL', errorCopy.network, res.status, { nonJson: true, url });
    }
  }
  if (opts.schema && import.meta.env.DEV) {
    const parsed = opts.schema.safeParse(data);
    if (!parsed.success) {
      console.warn(`[api] response for ${method} ${path} does not match schema`, parsed.error.issues);
    } else {
      data = parsed.data;
    }
  }
  return { data: data as T, response: res };
}

export async function request<T = unknown>(path: string, opts: RequestOptions<T> = {}): Promise<T> {
  const { data } = await requestRaw<T>(path, opts);
  return data;
}

export const api = {
  get: <T>(path: string, opts: Omit<RequestOptions<T>, 'method' | 'body'> = {}) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions<T>, 'method' | 'body'> = {}) => request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts: Omit<RequestOptions<T>, 'method' | 'body'> = {}) => request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts: Omit<RequestOptions<T>, 'method' | 'body'> = {}) => request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts: Omit<RequestOptions<T>, 'method' | 'body'> = {}) => request<T>(path, { ...opts, method: 'DELETE' }),
};
