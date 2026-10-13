import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE, AppError, api, isAppError, refreshAccessToken, request, toAppError } from '../shared/api/client';
import { tokenStore } from '../shared/auth/tokenStore';

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });

describe('api client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); tokenStore.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('mounts under /v1 and sends credentials + Idempotency-Key on POST', async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true }));
    await api.post('/support/inquiries', { a: 1 }, { auth: false });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(API_BASE.endsWith('/v1')).toBe(true);
    expect(url).toBe(`${API_BASE}/support/inquiries`);
    expect(init.credentials).toBe('include');
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeTruthy();
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('normalises API error bodies into AppError', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'INVALID_CREDENTIALS', message: '아이디 또는 비밀번호를 확인해 주세요.', details: { attempts: 2 } }, requestId: 'r-1' }, { status: 401 }));
    const err = await request('/auth/login', { method: 'POST', body: {}, auth: false, noRefresh: true }).catch((e: unknown) => e);
    expect(isAppError(err)).toBe(true);
    const e = err as AppError;
    expect(e.code).toBe('INVALID_CREDENTIALS');
    expect(e.message).toBe('아이디 또는 비밀번호를 확인해 주세요.');
    expect(e.status).toBe(401);
    expect(e.details).toEqual({ attempts: 2 });
    expect(e.requestId).toBe('r-1');
    expect(e.isAuth).toBe(true);
  });

  it('falls back to a Korean message when the body has no error object', async () => {
    fetchMock.mockResolvedValueOnce(new Response('oops', { status: 503 }));
    const err = (await api.get('/catalog/courses').catch((e: unknown) => e)) as AppError;
    expect(err.code).toBe('INTERNAL');
    expect(err.message).toBe('서버 오류가 발생했습니다.');
    expect(err.status).toBe(503);
  });

  it('wraps network failures as NETWORK', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const err = (await api.get('/x').catch((e: unknown) => e)) as AppError;
    expect(err.code).toBe('NETWORK');
    expect(err.status).toBe(0);
    expect(toAppError(new Error('x')).code).toBe('NETWORK');
  });

  it('refreshes once on 401 and replays with the new Bearer token', async () => {
    tokenStore.set('old');
    fetchMock
      .mockResolvedValueOnce(json({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, { status: 401 }))
      .mockResolvedValueOnce(json({ accessToken: 'new', expiresIn: 900, user: { id: 'u' }, next: 'home' }))
      .mockResolvedValueOnce(json({ items: [] }));
    const data = await api.get<{ items: unknown[] }>('/catalog/lists/1');
    expect(data).toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe(`${API_BASE}/auth/refresh`);
    const replay = fetchMock.mock.calls[2] as [string, RequestInit];
    expect((replay[1].headers as Record<string, string>).Authorization).toBe('Bearer new');
    expect(tokenStore.get()).toBe('new');
  });

  it('single-flights concurrent refresh calls', async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => { resolve = r; }));
    const a = refreshAccessToken();
    const b = refreshAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(json({ accessToken: 't', expiresIn: 60 }));
    expect(await a).toBe(true);
    expect(await b).toBe(true);
  });

  it('clears the token when refresh fails', async () => {
    tokenStore.set('stale');
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'SESSION_EXPIRED', message: 'x' } }, { status: 401 }));
    expect(await refreshAccessToken()).toBe(false);
    expect(tokenStore.get()).toBeNull();
  });
});
