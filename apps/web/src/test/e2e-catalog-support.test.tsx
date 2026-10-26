/**
 * Regression tests for the bugs the catalog / 고객지원 end-to-end round found (apps/web/e2e/catalog, e2e/support-center).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { flushSync } from 'react-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { CtaBand } from '../features/home/editorial/CtaBand';
import { RubyWidget, RUBY_OPEN_EVENT } from '../app/layouts/chatbot/RubyWidget';
import { home } from '../shared/strings/ko';
import { SessionContext, type SessionState } from '../shared/auth/useSession';
import LivePage from '../features/live/LivePage';
import { DesignProvider } from '../app/providers/DesignProvider';

const authed = { phase: 'authed', user: { id: 'xcatalog01', name: '카탈일' }, roles: ['learner'], isAuthed: true, login: vi.fn(), logout: vi.fn(), refresh: vi.fn(), patchUser: vi.fn() } as unknown as SessionState;

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><SessionContext.Provider value={authed}><MemoryRouter>{node}</MemoryRouter></SessionContext.Provider></MotionConfig></QueryClientProvider>);
}

describe('home CTA band (archive/main/main.html:432-434)', () => {
  it('links 학습 유의사항 and 부정행위방지정책 to the pages that hold them (/support/cheating tabs), not to missing #anchors of 이용안내', () => {
    const e = home.editorial.cta;
    wrap(<CtaBand label={e.label} title="t" lead={e.lead} apply={{ label: e.apply, to: '/support/inquiry/new' }} phone={{ label: e.phone, href: e.phoneHref }} columns={e.columns} />);
    expect(screen.getByRole('link', { name: '훈련제도 안내' })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: '학습 유의사항' })).toHaveAttribute('href', '/support/cheating?tab=guide'); // etc/guide.html
    expect(screen.getByRole('link', { name: '부정행위방지정책' })).toHaveAttribute('href', '/support/cheating?tab=policy'); // etc/cheating_guide.html
  });
});

describe('러비 opened from outside its own widget (코비 「우측 하단 러비」 hint)', () => {
  afterEach(() => { vi.unstubAllGlobals(); document.body.querySelectorAll('[data-outside]').forEach((n) => n.remove()); });

  it('stays open: the click that dispatched ruby:open is not taken as a click outside the panel', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })));
    wrap(<RubyWidget />);
    // a button outside the widget whose click opens 러비 synchronously (React flushes discrete updates and their effects in-line)
    const outside = document.createElement('button');
    outside.dataset.outside = '1';
    outside.addEventListener('click', () => { flushSync(() => { window.dispatchEvent(new Event(RUBY_OPEN_EVENT)); }); });
    document.body.appendChild(outside);
    outside.click();
    await waitFor(() => expect(screen.getByRole('region', { name: 'Chat Bot 러비' })).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByRole('region', { name: 'Chat Bot 러비' })).toBeInTheDocument();
    // a later click outside still closes it (ruby-widget.js:268-272)
    document.body.click();
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Chat Bot 러비' })).not.toBeInTheDocument());
  });
});

describe('라이브 클래스 입장 (header.html openLiveClass → new tab)', () => {
  /** Like the HTML spec: window.open(…, 'noopener') returns null even though the tab opens. */
  const specOpen = (win: object) => vi.fn((_u?: string | URL, _t?: string, features?: string) => (features?.includes('noopener') ? null : win) as Window | null);
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('does not report a blocked popup after a successful entry; reports it when the browser really blocks it', async () => {
    // the tab is opened inside the click, then pointed at the SSO address (LivePage start/launch)
    const open = specOpen({ opener: {}, location: { replace: vi.fn() }, close: vi.fn() });
    vi.spyOn(window, 'open').mockImplementation(open);
    vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL) => {
      const url = String(u);
      const body = url.includes('/support/live/entry') ? { launchUrl: 'https://live.hrdeedu.co.kr?token=t', records: false, notice: '' }
        : url.includes('/support/live') ? { liveClassUrl: 'https://live.hrdeedu.co.kr', entryAvailable: true, signedIn: true, enrollments: [], schedule: { available: false, reason: 'r' }, discussions: { available: false, reason: 'd', items: [] } }
        : {};
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    wrap(<DesignProvider><LivePage /></DesignProvider>);
    fireEvent.click(await screen.findByRole('button', { name: '라이브 클래스 입장' }));
    await waitFor(() => expect(open).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('새 창을 열지 못했습니다. 팝업 허용 상태를 확인한 뒤 다시 입장해 주세요.')).not.toBeInTheDocument();
    open.mockImplementation(() => null);
    fireEvent.click(screen.getByRole('button', { name: '라이브 클래스 입장' }));
    expect(await screen.findByText('새 창을 열지 못했습니다. 팝업 허용 상태를 확인한 뒤 다시 입장해 주세요.')).toBeInTheDocument();
  });
});
