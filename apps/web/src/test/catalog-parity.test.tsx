import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { ToastProvider } from '../app/providers/ToastProvider';
import { SessionContext, type SessionState } from '../shared/auth/useSession';
import { catalogApi, flattenCategories, flattenKeywords, mapCourseDetail } from '../shared/api/endpoints/catalog';
import ContentDetail from '../features/content/ContentDetail';
import { SitePopups, hideToday, isHiddenToday, todayKey, isMobileAgent } from '../app/layouts/SitePopups';
import { RubyWidget, failureText } from '../app/layouts/chatbot/RubyWidget';
import { KobeWidget, kobeContext } from '../app/layouts/chatbot/KobeWidget';
import { rolloutOverride } from '../app/layouts/chatbot/useChatbotGate';
import { aiHubQuery } from '../features/aizone/AiHub';
import { AboutArchivePage, AboutCompanyPage } from '../features/about/AboutPages';
import AiZonePage from '../features/aizone/AiZonePage';
import { DesignProvider } from '../app/providers/DesignProvider';
import { AppError } from '../shared/api/client';
import { contentType } from '../shared/strings/ko';
import { tokenStore } from '../shared/auth/tokenStore';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const authed = { phase: 'authed', user: { id: 'user01', name: '학습자일' }, roles: ['learner'], isAuthed: true, login: vi.fn(), logout: vi.fn(), refresh: vi.fn(), patchUser: vi.fn() } as unknown as SessionState;
const guest = { ...authed, phase: 'guest', user: null, roles: [], isAuthed: false } as unknown as SessionState;

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}{l.search}</p>; }
function mount(node: ReactNode, path = '/', session: SessionState = authed, route = '*') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><ToastProvider><SessionContext.Provider value={session}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path={route} element={<>{node}<Where /></>} /><Route path="*" element={<Where />} /></Routes>
      </MemoryRouter>
    </SessionContext.Provider></ToastProvider></MotionConfig></QueryClientProvider>,
  );
}

const card = { idx: 1, lectureCode: 'D1', title: '보고서 작성', ctype: 'Z', serviceType: 'Z', category1: '공통역량', category2: null, minutes: 26, thumbnailUrl: null, viewCount: 12, rating: null, ratingCount: 0, keywords: ['보고서'], regDate: '2026-01-01', contentsStart: '2025-03-01', uploadDate: '2025-04-02', jobField: '기획·마케팅' };
const detail = { ...card, intro: '<p>소개</p>', eduTarget: '', eduGoal: '목표', professor: null, chapterCount: 2, singleVideo: false, mobile: true, isPackage: false, legalEdu: false, abilities: ['문제해결'], teacher: { idx: 1, name: '김강사', photo: null, profile: '경력 10년' }, chapters: [{ seq: 1001, number: 1, chapterType: 'A', title: '1차시', minutes: 13 }, { seq: 1002, number: 2, chapterType: 'A', title: '2차시', minutes: 13 }], myRating: null, canRate: false };

describe('catalog client adapters', () => {
  it('flattens the category tree and the keyword groups', () => {
    expect(flattenCategories([{ idx: 1, name: '공통역량', children: [{ idx: 11, name: '소통' }] }])).toEqual([{ id: 1, name: '공통역량', parentId: null }, { id: 11, name: '소통', parentId: 1 }]);
    const groups = [{ jobCate: '직무', category: '2', items: [{ idx: 7, keyword: 'IT·SW' }] }, { jobCate: null, category: '3', items: [{ idx: 8, keyword: '관심' }] }];
    expect(flattenKeywords(groups, '2')).toEqual([{ id: 7, name: 'IT·SW' }]);
    expect(flattenKeywords(groups)).toHaveLength(2);
  });

  it('maps the detail payload: teacher profile, 제작연도 from ContentsStart, 업데이트 = UploadDate, chapter numbers as text', () => {
    const d = mapCourseDetail(detail as unknown as Record<string, unknown>);
    expect(d).toMatchObject({ teacher: '김강사', teacherIntro: '경력 10년', year: '2025', updatedDate: '2025-04-02', abilities: ['문제해결'] });
    expect(d.chapters[0]!.number).toBe('1');
    expect(d.reviews).toEqual([]);
  });

  it('labels ctype letters like the PHP site (Z 마이크로러닝, Y 숏폼)', () => {
    expect(contentType.Z).toBe('마이크로러닝');
    expect(contentType.Y).toBe('숏폼');
  });
});

describe('찜 / 상세 / 학습하기', () => {
  let calls: string[] = [];
  beforeEach(() => { calls = []; tokenStore.set('t'); });
  afterEach(() => { tokenStore.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('찜 해제 sends DELETE, 찜하기 POST', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => { calls.push(`${init?.method} ${String(u).replace(/^.*\/v1/, '')}`); return json({ liked: init?.method === 'POST', count: 1 }); }));
    await catalogApi.like('D1', false);
    await catalogApi.like('D1', true);
    expect(calls).toEqual(['DELETE /catalog/courses/D1/like', 'POST /catalog/courses/D1/like']);
  });

  it('학습하기 resolves the enrollment and opens /learn/:studySeq/:chapterSeq; a blocked resolution shows the server message', async () => {
    let status = 'ok';
    vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL) => {
      const url = String(u);
      if (url.includes('/enrollments/resolve')) return json(status === 'ok' ? { status: 'ok', studySeq: 7, message: '' } : { status: 'blocked', studySeq: 7, message: '수강기간이 종료되었습니다.\n문의 1811-9530' });
      if (url.includes('/catalog/courses/D1')) return json(detail);
      return json({});
    }));
    const { unmount } = mount(<ContentDetail />, '/courses/D1', authed, '/courses/:lectureCode');
    await screen.findByRole('heading', { level: 1, name: '보고서 작성' });
    expect(screen.getAllByText('마이크로러닝').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /학습하기/ }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/learn/7/1001?lectureCode=D1'));
    unmount();
    status = 'blocked';
    mount(<ContentDetail />, '/courses/D1', authed, '/courses/:lectureCode');
    await screen.findByRole('heading', { level: 1, name: '보고서 작성' });
    fireEvent.click(screen.getByRole('button', { name: /학습하기/ }));
    expect(await screen.findByText(/수강기간이 종료되었습니다/)).toBeInTheDocument();
  });

  it('평점 needs study history (canRate) and the reviews tab reads GET /reviews', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL) => {
      const url = String(u);
      if (url.includes('/reviews')) return json({ items: [{ idx: 1, author: 'tes***', starPoint: 5, title: '', contents: '좋아요', regDate: '2026-10-01 10:00:00', mine: false }], page: 1, size: 10, total: 1, rating: 5, ratingCount: 1 });
      if (url.includes('/catalog/courses/D1')) return json(detail);
      return json({});
    }));
    mount(<ContentDetail />, '/courses/D1', authed, '/courses/:lectureCode');
    await screen.findByRole('heading', { level: 1, name: '보고서 작성' });
    fireEvent.click(screen.getByRole('tab', { name: '평점·후기' }));
    expect(await screen.findByText(/좋아요/)).toBeInTheDocument();
    expect(screen.getAllByText('학습 이력이 확인된 콘텐츠에서 평점을 등록할 수 있습니다.').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '평점 등록' })).toBeDisabled();
  });
});

describe('site popups (popup/include_popup.php)', () => {
  afterEach(() => { vi.unstubAllGlobals(); document.cookie = 'Popup5=; max-age=0; path=/'; localStorage.clear(); sessionStorage.clear(); });
  const popups = [{ idx: 5, title: '안내 팝업', imageUrl: '/upload/upload_popup/p.png', width: 392, height: 403, left: 200, top: 50, mobile: { imageUrl: '/upload/upload_popup/m.png', width: 300, height: 400, left: 10, top: 10 }, endDate: '20991231', links: [{ num: 1, area: '', url: 'https://example.com' }] }];

  it('shows active popups with the single link, hides them for the day, and never on the login page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(popups)));
    const { unmount } = mount(<SitePopups />, '/');
    const dlg = await screen.findByRole('dialog', { name: '안내 팝업' });
    expect(dlg.querySelector('a')).toHaveAttribute('href', 'https://example.com');
    fireEvent.click(screen.getByLabelText(/오늘 하루 창 열지 않기/));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '안내 팝업' })).not.toBeInTheDocument());
    expect(isHiddenToday(5)).toBe(true);
    expect(localStorage.getItem('hrde_hide_Popup5')).toBe(todayKey());
    unmount();
    mount(<SitePopups />, '/');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    document.cookie = 'Popup5=; max-age=0; path=/'; localStorage.clear(); sessionStorage.clear();
    mount(<SitePopups />, '/auth/login');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('detects phones by User-Agent like popup_view.php and expires yesterday\'s storage key', () => {
    expect(isMobileAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(true);
    expect(isMobileAgent('Mozilla/5.0 (Windows NT 10.0)')).toBe(false);
    localStorage.setItem('hrde_hide_Popup9', '2000-01-01');
    expect(isHiddenToday(9)).toBe(false);
    expect(localStorage.getItem('hrde_hide_Popup9')).toBeNull();
    hideToday(9);
    expect(isHiddenToday(9)).toBe(true);
    document.cookie = 'Popup9=; max-age=0; path=/';
  });
});

describe('러비 / 코비', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('러비 sends the question with the fallback state and, after a contact offer, files the ticket', async () => {
    const bodies: { url: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => {
      const url = String(u);
      bodies.push({ url: url.replace(/^.*\/v1/, ''), body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url.includes('/ruby/reply')) return json({ ok: true, reply: '담당자 확인을 위해 성함과 연락처를 함께 입력해 주세요.', courseLinks: [{ label: '과정', url: '/courses/D1' }], escalation: { userMessage: '1:1 문의 접수해줘', botContext: '', similarity: 0, confidence: 0 }, meta: { intent: 'escalation_request', source: 'escalation_prompt', fallbackCount: 0, followupIntent: '', escalation: true } });
      if (url.includes('/ruby/tickets')) return json({ created: true, pending: false, released: false, reply: '접수가 완료되었습니다.', ticketId: 3 });
      return json({});
    }));
    mount(<RubyWidget />, '/');
    fireEvent.click(screen.getByRole('button', { name: '챗봇 러비 열기' }));
    fireEvent.change(screen.getByPlaceholderText('질문을 입력해 주세요'), { target: { value: '1:1 문의 접수해줘' } });
    fireEvent.click(screen.getByRole('button', { name: '전송' }));
    expect(await screen.findByText('담당자 확인을 위해 성함과 연락처를 함께 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '과정' })).toHaveAttribute('href', '/courses/D1');
    fireEvent.change(screen.getByPlaceholderText('질문을 입력해 주세요'), { target: { value: '홍길동 / 010-1234-5678' } });
    fireEvent.click(screen.getByRole('button', { name: '전송' }));
    expect(await screen.findByText('접수가 완료되었습니다.')).toBeInTheDocument();
    expect(bodies[0]).toMatchObject({ url: '/chatbot/ruby/reply', body: { message: '1:1 문의 접수해줘', fallbackCount: 0, followupIntent: '' } });
    expect(bodies[1]).toMatchObject({ url: '/chatbot/ruby/tickets', body: { message: '홍길동 / 010-1234-5678', escalation: { userMessage: '1:1 문의 접수해줘' } } });
  });

  it('러비 refuses over-long questions locally and maps failures to the widget texts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({})));
    mount(<RubyWidget />, '/');
    fireEvent.click(screen.getByRole('button', { name: '챗봇 러비 열기' }));
    fireEvent.change(screen.getByPlaceholderText('질문을 입력해 주세요'), { target: { value: 'a'.repeat(1001) } });
    fireEvent.click(screen.getByRole('button', { name: '전송' }));
    expect(await screen.findByText(/1,000자 이내/)).toBeInTheDocument();
    expect(failureText(null, true)).toContain('응답이 지연');
    expect(failureText(new AppError('CONFLICT', 'x', 429), false)).toContain('요청이 너무 많습니다');
    expect(failureText(new AppError('NETWORK', 'x', 0), false)).toContain('네트워크 오류');
  });

  it('코비 maps routes to the trigger pages and shows the coaching message with its button', async () => {
    expect(kobeContext('/catalog')).toEqual({ page: 'contents', event: 'content_list_enter' });
    expect(kobeContext('/my/ranking')).toEqual({ page: 'ranking_badges', event: 'gamification_view' });
    expect(kobeContext('/learn/1/2')).toEqual({ page: 'lesson', event: 'lesson_start' });
    expect(kobeContext('/')).toEqual({ page: 'main', event: 'first_visit' });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: true, show: true, module_id: 3, message: '학습자일님, 현재 화면 기준으로 추천 콘텐츠를 정리했어요.', cta: { label: '추천 과정 보기', url: '/roadmap' }, recommended_courses: [], role: 'learner' })));
    mount(<KobeWidget />, '/catalog');
    await vi.advanceTimersByTimeAsync(2600);
    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: '코비 열기' }));
    expect(await screen.findByText(/추천 콘텐츠를 정리했어요/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '추천 과정 보기' })).toHaveAttribute('href', '/roadmap');
  });

  it('honours the ?ruby= / ?kobe= QA override and the rollout cookie', () => {
    expect(rolloutOverride('ruby', '?ruby=1', '')).toBe(true);
    expect(rolloutOverride('ruby', '?ruby=0', 'hrde_ruby_rollout=1')).toBe(false);
    expect(rolloutOverride('kobe', '', 'a=b; hrde_kobe_rollout=1')).toBe(true);
    expect(rolloutOverride('kobe', '', '')).toBeNull();
  });
});

describe('AI ZONE hub and 소개', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('builds the aizone-content.php query from the filters', () => {
    const f = { search: ' 프롬프트 ', categories: ['ai-prompt'], ctypes: ['Z'], minTime: 30, minYear: 2024, minRating: 4 };
    expect(aiHubQuery('content', 'rating', f)).toEqual({ tab: 'content', type: 'popular', sortBy: 'rating', categories: ['ai-prompt'], ctypes: ['Z'], search: '프롬프트', minTime: 30, minYear: 2024, minRating: 4 });
    expect(aiHubQuery('content', 'new', f)).toMatchObject({ type: 'new', sortBy: 'latest' });
    expect(aiHubQuery('handson', 'rating', f)).toEqual({ tab: 'handson' });
  });

  it('renders the AI ZONE page: AI-scoped catalog list and the content hub with 실습형 / 자격 tabs', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL) => {
      const url = String(u); urls.push(url.replace(/^.*\/v1/, ''));
      if (url.includes('/catalog/ai-zone')) return json({ tab: 'content', count: 1, items: [{ ...card, lectureCode: 'H1', title: 'AI 실전 특강', difficulty: '기초' }] });
      if (url.includes('/catalog/courses')) return json({ items: [card], page: 1, size: 6, total: 1 });
      return json({}, 404);
    }));
    mount(<DesignProvider><AiZonePage /></DesignProvider>, '/ai-zone', guest);
    expect(await screen.findByText('AI 실전 특강')).toBeInTheDocument();
    expect(screen.getByText('난이도 기초')).toBeInTheDocument();
    expect(urls.some((u) => u.startsWith('/catalog/courses') && u.includes('ai=all'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '실습형 AI' }));
    await waitFor(() => expect(urls.some((u) => u.includes('/catalog/ai-zone?tab=handson'))).toBe(true));
  });

  it('renders 훈련제도 안내 and 회사소개', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({}, 503)));
    const { unmount } = mount(<DesignProvider><AboutArchivePage /></DesignProvider>, '/about', guest);
    expect(await screen.findByRole('heading', { level: 1, name: 'HRDe 아카이브란?' })).toBeInTheDocument();
    expect(screen.getByText('140,000원')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'HRDe 아카이브 환급절차' })).toBeInTheDocument();
    unmount();
    mount(<DesignProvider><AboutCompanyPage /></DesignProvider>, '/about/company', guest);
    expect(await screen.findByRole('heading', { level: 1, name: /앞서 나가기/ })).toBeInTheDocument();
    expect(screen.getByText('LMS 개발')).toBeInTheDocument();
  });
});
