import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { router } from '../app/router';

/** Mounts the real route tree with the API unreachable: pages must render their fallback/empty states, never crash. */
const mount = (path: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const memory = createMemoryRouter(router.routes, { initialEntries: [path] });
  return render(<QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><RouterProvider router={memory} /></MotionConfig></QueryClientProvider>);
};

describe('app smoke (API offline)', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline'))); localStorage.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders the public home (editorial hero + old-site sections) with header and footer from DEFAULT_DESIGN', async () => {
    mount('/');
    expect(await screen.findByRole('heading', { level: 1, name: /필요한 배움을/ })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '주 메뉴' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    // navy intro band + content tabs + CTA band (old-site sections), storyboard sections hidden by default
    expect(screen.getByRole('heading', { level: 2, name: 'AINEX Archive란' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '콘텐츠 목록 선택' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '수강신청' }).length).toBeGreaterThanOrEqual(2); // header white pill + CTA band
    expect(screen.queryByText('두 가지 운영, 같은 자유학습')).not.toBeInTheDocument();
    // explore panel: catalog search + learning areas as links
    expect(document.querySelector('[data-hero="editorial"] [role="search"]')).not.toBeNull();
    expect(document.querySelector('[data-hero="editorial"] [data-area="common"]')).toHaveAttribute('href', '/catalog?competency=common');
    await waitFor(() => expect(screen.getAllByText('목록을 불러오지 못했습니다.').length).toBeGreaterThan(0));
    expect(screen.queryByText('AXIS 자격검정 바로가기')).not.toBeInTheDocument(); // axisUrl empty → hidden
  });

  it('renders the storyboard home when the published design keeps heroVariant split', async () => {
    const { DEFAULT_DESIGN, LEGACY_DEFAULT_DESIGN_V1 } = await import('@ainex/contracts');
    localStorage.setItem('design.v1', JSON.stringify({ etag: 'W/"legacy"', config: LEGACY_DEFAULT_DESIGN_V1 }));
    mount('/');
    expect(await screen.findByRole('heading', { level: 1, name: /필요한 배움을/ })).toBeInTheDocument();
    expect(screen.getByText('두 가지 운영, 같은 자유학습')).toBeInTheDocument();
    expect(document.querySelector('[data-hero="editorial"]')).toBeNull();
    // sections the legacy config predates are appended hidden (the admin toggles them on in Design Studio)
    expect(DEFAULT_DESIGN.layout.homeSections.find((s) => s.key === 'intro')?.visible).toBe(true);
    expect(screen.queryByRole('heading', { level: 2, name: 'AINEX Archive란' })).not.toBeInTheDocument();
  });

  it('renders the catalog with a LIST_ERROR state when the API is down', async () => {
    mount('/catalog?competency=job&type=micro');
    expect(await screen.findByRole('heading', { level: 1, name: '콘텐츠 탐색·목록' })).toBeInTheDocument();
    expect(await screen.findByText('콘텐츠를 불러오지 못했습니다.')).toBeInTheDocument();
  });

  it('renders support FAQ and the login form', async () => {
    const { unmount } = mount('/support/faq');
    expect(await screen.findByRole('heading', { level: 1, name: '무엇을 도와드릴까요?' })).toBeInTheDocument();
    unmount();
    mount('/auth/login?next=%2Fcatalog');
    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument();
    expect(screen.getByLabelText('아이디')).toBeInTheDocument();
  });

  it('shows NOT_FOUND for unknown routes and LOGIN redirect for guarded routes', async () => {
    const { unmount } = mount('/nope/nothing');
    expect(await screen.findByText('페이지를 찾을 수 없습니다.')).toBeInTheDocument();
    unmount();
    mount('/my/records');
    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument();
  });
});
