import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE, api, refreshAdminAccessToken, scopeForPath } from '../shared/api/client';
import { tokenStore } from '../shared/auth/tokenStore';
import { adminTokenStore } from '../shared/auth/adminTokenStore';

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });
const auth = (call: unknown[]) => ((call[1] as RequestInit).headers as Record<string, string>).Authorization;

describe('api client — admin token scoping', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); tokenStore.clear(); adminTokenStore.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('picks the scope from the path', () => {
    expect(scopeForPath('/admin/members')).toBe('admin');
    expect(scopeForPath('/admin')).toBe('admin');
    expect(scopeForPath('/design/draft')).toBe('admin');
    expect(scopeForPath('/design/media/abc')).toBe('admin');
    expect(scopeForPath('/auth/admin/refresh')).toBe('admin');
    expect(scopeForPath('/auth/refresh')).toBe('learner');
    expect(scopeForPath('/catalog/courses')).toBe('learner');
    expect(scopeForPath('/manager/trainees')).toBe('learner');
    expect(scopeForPath('/administrators')).toBe('learner');
    expect(scopeForPath(`${API_BASE}/admin/dashboard`)).toBe('admin');
  });

  it('sends the staff token for /admin and the learner token elsewhere — both sessions coexist', async () => {
    tokenStore.set('learner-token');
    adminTokenStore.set('admin-token');
    fetchMock.mockImplementation(() => Promise.resolve(json({ ok: true })));
    await api.get('/admin/dashboard');
    await api.get('/design/draft');
    await api.get('/manager/overview');
    await api.get('/catalog/courses');
    expect(auth(fetchMock.mock.calls[0]!)).toBe('Bearer admin-token');
    expect(auth(fetchMock.mock.calls[1]!)).toBe('Bearer admin-token');
    expect(auth(fetchMock.mock.calls[2]!)).toBe('Bearer learner-token');
    expect(auth(fetchMock.mock.calls[3]!)).toBe('Bearer learner-token');
  });

  it('never sends the learner token to admin endpoints when no staff token exists', async () => {
    tokenStore.set('learner-token');
    fetchMock.mockResolvedValueOnce(json({ ok: true }));
    await api.get('/admin/dashboard', { noRefresh: true });
    expect(auth(fetchMock.mock.calls[0]!)).toBeUndefined();
  });

  it('tokenScope option overrides the path rule', async () => {
    tokenStore.set('learner-token');
    adminTokenStore.set('admin-token');
    fetchMock.mockResolvedValueOnce(json({ ok: true }));
    await api.get('/catalog/courses', { tokenScope: 'admin' });
    expect(auth(fetchMock.mock.calls[0]!)).toBe('Bearer admin-token');
  });

  it('refreshes the ADMIN session on a 401 from /admin/* and replays with the new staff token', async () => {
    tokenStore.set('learner-token');
    adminTokenStore.set('stale-admin');
    fetchMock
      .mockResolvedValueOnce(json({ error: { code: 'SESSION_EXPIRED', message: 'x' } }, { status: 401 }))
      .mockResolvedValueOnce(json({ accessToken: 'fresh-admin', expiresIn: 900, admin: { id: 'admin01' } }))
      .mockResolvedValueOnce(json({ today: '2026-10-12' }));
    const data = await api.get<{ today: string }>('/admin/dashboard');
    expect(data.today).toBe('2026-10-12');
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe(`${API_BASE}/auth/admin/refresh`);
    expect(auth(fetchMock.mock.calls[2]!)).toBe('Bearer fresh-admin');
    expect(adminTokenStore.get()).toBe('fresh-admin');
    expect(tokenStore.get()).toBe('learner-token'); // learner session untouched
  });

  it('does not touch the staff token when the learner refresh fails', async () => {
    adminTokenStore.set('admin-token');
    tokenStore.set('stale-learner');
    fetchMock
      .mockResolvedValueOnce(json({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, { status: 401 }))
      .mockResolvedValueOnce(json({ error: { code: 'SESSION_EXPIRED', message: 'x' } }, { status: 401 }));
    await expect(api.get('/my/dashboard')).rejects.toMatchObject({ status: 401 });
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe(`${API_BASE}/auth/refresh`);
    expect(tokenStore.get()).toBeNull();
    expect(adminTokenStore.get()).toBe('admin-token');
  });

  it('single-flights the admin refresh and records the expiry', async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => { resolve = r; }));
    const a = refreshAdminAccessToken();
    const b = refreshAdminAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(json({ accessToken: 't', expiresIn: 900, admin: { id: 'a' } }));
    expect(await a).toBe(true);
    expect(await b).toBe(true);
    const left = adminTokenStore.secondsLeft();
    expect(left).not.toBeNull();
    expect(left!).toBeGreaterThan(880);
  });
});
