import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { AdminSession } from '@ainex/contracts';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import CoursesPage from '../features/admin/pages/courses/CoursesPage';
import CourseEditPage from '../features/admin/pages/courses/CourseEditPage';
import ContentsPage from '../features/admin/pages/courses/ContentsPage';
import ContentDetailPage from '../features/admin/pages/courses/ContentDetailPage';
import CategoriesPage from '../features/admin/pages/courses/CategoriesPage';
import ListsPage from '../features/admin/pages/courses/ListsPage';
import { validateCourseForm, formFromDetail, courseBody } from '../features/admin/pages/courses/courses-parity.course';
import { detailSections } from '../features/admin/pages/courses/courses-parity.contents';
import { parsePasted } from '../features/admin/pages/courses/courses-parity.shared';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin: AdminSession = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['D'], subGrants: ['D1'], canWrite: true } as AdminSession;
const session: AdminSessionState = { phase: 'authed', admin, isAuthed: true, canWrite: true, secondsLeft: 900, login: async () => admin, logout: async () => undefined, extend: async () => true };

const row = {
  idx: 7, ctype: 'Z', lectureCode: 'MIC001', name: '마이크로 과정', useYN: 'Y', useLabel: '사용', hrdCode: null, category1: '1', category2: '2', keyword1: '3', keyword2: '4', contentsTime: '10', chapter: '2', chapterLabel: '2차시', chapterRows: 1,
  isPackage: false, packageCodes: [], packageLectureCode: 'P01', packageCount: 1, packageRef: 0, packageRefPad: '000', image: null, professor: '홍길동', price: 1000, passTime: 15, regDate: '2026-01-01 00:00:00', views: 5, enrollments: 2,
  classGrade: 'A', classGradeLabel: 'A등급', categoryName1: '직무', categoryName2: '인사', category: '직무>인사', hrdSeq: 'H-9', contentsStart: '2026-01-01', uploadDate: '2026-01-02', mobile: 'Y', mobileLabel: '사용', serviceType: 'Z', serviceTypeLabel: '마이크로닝',
};
const pkgRow = { ...row, idx: 9, ctype: 'A', lectureCode: 'PKG001', name: '패키지', isPackage: true, packageRef: 2, packageRefPad: '002', packageCount: 3, serviceTypeLabel: '패키지' };
const detail = {
  ...row, chapter: '3', chapterLabel: '3차시', keyword3: '11', keyword4: '21', intro: '소개<br>둘째 줄', eduTarget: '대상', eduGoal: '목표', contentsUrl: '', mobileUrl: '', contentsEnd: '2026-12-31', legalEduReq: 'Y', legalEduLabel: '예',
  prices: { normal: 1000, priority: 100, large1: 200, large2: 300 }, terms: [], deleted: false, contentsUrlSelect: 'A', bookPrice: 0, attachFile: null, previewImage: null, bookImage: null, fileBase: '/upload/Course/',
  keyword1Name: '사원', keyword2Name: '인사', keyword3Ids: [11], keyword4Ids: [21], keyword3Names: ['리더십'], keyword4Names: ['소통'], menuName: '마이크로닝', testIdCount: 2, chapterMismatch: true, packageCourses: [],
};
const chapters = [
  { chapterSeq: 31, chapterType: 'A', typeLabel: '강의 차시', order: 1, subIdx: '5', regDate: null, contentsIdx: 5, gubun: '구분', title: '1강', listTitle: '1강', lectureTimeMin: 25, deleted: false, details: 3, subCount: '3 건' },
  { chapterSeq: 32, chapterType: 'A', typeLabel: '강의 차시', order: 2, subIdx: '6', regDate: null, contentsIdx: 6, gubun: '구분', title: '2강', listTitle: '2강', lectureTimeMin: 25, deleted: false, details: 1, subCount: '1 건' },
];
const contentsList = { items: [{ idx: 5, gubun: '구분', title: '1강', lectureTimeMin: 25, regDate: '2026-01-01 00:00:00', detailCount: 3, usedIn: 1 }], page: 1, size: 20, total: 1 };
const content = {
  idx: 5, gubun: '구분', title: '1강', lectureTimeMin: 25, goal: '목표', trainingContents: '내용', activities: '활동', regDate: '2026-01-01 00:00:00', deleted: false,
  details: [{ seq: 41, type: 'B', typeLabel: 'mp4 영상강의', pages: '1', mobilePages: '1', urlSelect: 'A', urlSelectLabel: '(주)', url: '/v/1.mp4', url2: '/v/1b.mp4', mobileUrl: '/m/1.mp4', mobileUrl2: null, question: null, examples: [null, null, null, null, null], answer: null, comment: null, teacher: 0, teacherName: null, useYN: 'Y', useLabel: '사용', order: 1, caption: null }],
  usedIn: [{ lectureCode: 'MIC001', chapterSeq: 31, order: 1 }], nextDetailOrder: 2,
};
const categories = { categories: [], tree: [{ idx: 1, parent: 0, deep: 1, name: '직무', order: 1, useYN: 'Y', children: [{ idx: 2, parent: 1, deep: 2, name: '인사', order: 1, useYN: 'N' }] }], keywords: [], nextOrder: { root: 2, byParent: { '1': 2 } } };
const overview = { items: [{ gubun: '1', label: 'PICK', title: "HRDe's PICK 추천컨텐츠", count: 1 }, { gubun: '2', label: 'TOP10', title: '오늘의 TOP10 인기컨텐츠', count: 0 }, { gubun: '3', label: 'NEW', title: 'NEW 신규컨텐츠', count: 0 }, { gubun: '4', label: 'HRDe', title: 'HRDe++', count: 0 }] };
const list1 = { gubun: '1', label: 'PICK', title: "HRDe's PICK 추천컨텐츠", items: [{ idx: 3, lectureCode: 'MIC001', order: 1, useYN: 'Y', courseUseYN: 'Y', courseUseLabel: '사용', regDate: null, regId: 'admin01', name: '마이크로 과정', ctype: 'Z', serviceType: 'Z', courseVisible: true }, { idx: 4, lectureCode: 'D00001', order: 2, useYN: 'Y', courseUseYN: 'N', courseUseLabel: '미사용', regDate: null, regId: 'admin01', name: '이러닝', ctype: 'X', serviceType: 'X', courseVisible: false }] };

const calls: string[] = [];
const bodies: Record<string, unknown> = {};
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^.*\/v1/, ''); const method = init?.method ?? 'GET';
    calls.push(`${method} ${url}`);
    if (init?.body) bodies[`${method} ${url.split('?')[0]}`] = JSON.parse(String(init.body));
    if (method !== 'GET') return json({ ok: true, updated: 1, deleted: 1, count: 2 });
    if (url.startsWith('/admin/courses/meta')) return json({ classGrades: [{ value: 'A', label: 'A등급' }], useYN: [], serviceTypes: [], ctypes: [], categories: [{ idx: 1, name: '직무', children: [{ idx: 2, name: '인사' }] }], keyword1: [{ idx: 3, name: '사원', del: false, useYN: 'Y' }], keyword2: [{ idx: 4, name: '인사', del: false, useYN: 'Y' }], keyword3: [{ idx: 11, name: '리더십' }], keyword4: [{ idx: 21, name: '소통' }], fileBase: '/upload/Course/' });
    if (/^\/admin\/courses\/MIC001\/chapters/.test(url)) return json(chapters);
    if (url.startsWith('/admin/courses/7')) return json(detail);
    if (url.startsWith('/admin/courses?') && url.includes('packageYN=Y')) return json({ items: [pkgRow], page: 1, size: 20, total: 1 });
    if (url.startsWith('/admin/courses?')) return json({ items: [row], page: 1, size: 20, total: 1 });
    if (url.startsWith('/admin/contents/options')) return json({ gubuns: ['구분'], contents: [] });
    if (url.startsWith('/admin/contents/meta')) return json({ contentsTypes: [{ value: 'A', label: 'Flash 강의' }, { value: 'B', label: 'mp4 영상강의' }, { value: 'C', label: '문제풀이 객관식' }], teachers: [], servers: { flash: 'f', movie: 'm', mobile: 'mo' } });
    if (url.startsWith('/admin/contents/5')) return json(content);
    if (url.startsWith('/admin/contents')) return json(contentsList);
    if (url.startsWith('/admin/categories')) return json(categories);
    if (url === '/admin/lists') return json(overview);
    if (url.startsWith('/admin/lists/1/candidates')) return json({ items: [{ no: 1, idx: 8, lectureCode: 'NEW001', name: '신규', ctype: 'X' }] });
    if (url.startsWith('/admin/lists/1')) return json(list1);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}

const mount = (el: ReactElement, path = '/x', route?: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><AdminSessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}>{route ? <Routes><Route path={route} element={el} /></Routes> : el}</MemoryRouter></AdminSessionContext.Provider></ToastProvider></QueryClientProvider>);
};

describe('컨텐츠관리 parity pages', () => {
  beforeEach(() => { calls.length = 0; for (const k of Object.keys(bodies)) delete bodies[k]; adminTokenStore.set('adm', 900); vi.stubGlobal('fetch', apiMock()); vi.spyOn(window, 'confirm').mockReturnValue(true); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); adminTokenStore.clear(); });

  it('course.php list: title per ctype, the PHP columns and PackageYN=N filter', async () => {
    mount(<CoursesPage />, '/admin/courses?ctype=Z');
    expect(await screen.findByRole('heading', { level: 1, name: '마이크로닝 컨텐츠 관리' })).toBeInTheDocument();
    expect(await screen.findByText('마이크로 과정')).toBeInTheDocument();
    for (const h of ['번호', '차시', '교육시간', '패키지콘텐츠 과정코드', '원격훈련 일련번호', '모바일']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByText('A등급')).toBeInTheDocument();
    expect(screen.getByText('H-9')).toBeInTheDocument();
    expect(calls.some((c) => c.includes('/admin/courses?') && c.includes('ctype=Z') && c.includes('packageYN=N'))).toBe(true);
    expect(screen.getByRole('button', { name: '검색 항목 엑셀 출력' })).toBeInTheDocument();
  });

  it('course_package.php list: 패키지 번호 padded, 등록된 단과 강의수', async () => {
    mount(<CoursesPage />, '/admin/courses?packageYN=Y');
    expect(await screen.findByRole('heading', { level: 1, name: '패키지 컨텐츠 관리' })).toBeInTheDocument();
    expect(await screen.findByText('002')).toBeInTheDocument();
    for (const h of ['과정 코드', '과정명', '패키지 번호', '등록된 단과 강의수', '사용 여부']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByText('** 패키지 컨텐츠는 1개만 사용 가능합니다.')).toBeInTheDocument();
  });

  it('course_read.php: every block, chapter mismatch warning, ▲▼ + 정렬 하기 sends the new Seq order', async () => {
    mount(<CourseEditPage />, '/admin/courses/7', '/admin/courses/:idx');
    expect(await screen.findByText('난이도(직급)')).toBeInTheDocument();
    for (const t of ['등급 / 과정코드', '원격훈련일련번호', '법정교육여부', '조회수', '직무분야', '관심분야', '역량', '수료기준', '교재비', '교육비용', '과정소개', '교육대상', '교육목표']) expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    expect(screen.getByText('#리더십')).toBeInTheDocument();
    expect(screen.getByText('[등록된 심사용 테스트 아이디 2건 보기]')).toBeInTheDocument();
    expect(await screen.findByText(/차시수 오류/)).toBeInTheDocument();
    expect(await screen.findByText('2강')).toBeInTheDocument();
    const downs = screen.getAllByRole('button', { name: '아래로' });
    fireEvent.click(downs[0]!);
    fireEvent.click(screen.getByRole('button', { name: '정렬 하기' }));
    await waitFor(() => expect(bodies['PUT /admin/courses/MIC001/chapters/order']).toEqual({ seqs: [32, 31] }));
  });

  it('course_write.php (?mode=edit): prefilled from the detail, PATCH carries every PHP column', async () => {
    mount(<CourseEditPage />, '/admin/courses/7?mode=edit', '/admin/courses/:idx');
    expect(await screen.findByDisplayValue('마이크로 과정')).toBeInTheDocument();
    expect(await screen.findByLabelText('리더십')).toBeChecked();
    fireEvent.change(screen.getByLabelText(/^과정명/, { selector: 'input' }), { target: { value: '바뀐 과정' } });
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    await waitFor(() => expect(bodies['PATCH /admin/courses/7']).toBeTruthy());
    expect(bodies['PATCH /admin/courses/7']).toMatchObject({ ContentsName: '바뀐 과정', Category1: 1, Category2: 2, Keyword3: [11], Keyword4: [21], LegalEduReq: 'Y', Price01View: 100, ServiceType: 'Z' });
  });

  it('contents.php list + contents_read.php detail table', async () => {
    mount(<ContentsPage />, '/admin/contents');
    expect(await screen.findByRole('heading', { level: 1, name: '기초차시 관리' })).toBeInTheDocument();
    for (const h of ['차시 구분', '차시명', '수강시간(분)', '등록일', '하부 컨텐츠수']) expect(await screen.findByRole('columnheader', { name: h })).toBeInTheDocument();
  });

  it('contents_read.php: 상세 구성 columns and the add drawer posting ContentsDetail', async () => {
    mount(<ContentDetailPage />, '/admin/contents/5', '/admin/contents/:idx');
    expect(await screen.findByText('기초차시 상세 구성 (1)')).toBeInTheDocument();
    expect(screen.getByText('mp4 영상강의(주)')).toBeInTheDocument();
    expect(screen.getByText(/\(예비\) \/v\/1b\.mp4/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '추가 하기' }));
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByLabelText(/정렬 순서/)).toHaveValue('2');
    fireEvent.click(within(drawer).getByRole('button', { name: '등록 하기' }));
    expect(await within(drawer).findByText('컨텐츠 경로를 입력하세요.')).toBeInTheDocument(); // ContentsDetailSubmitOk: type A needs a path
    expect(bodies['POST /admin/contents/5/details']).toBeUndefined();
    fireEvent.change(within(drawer).getByLabelText(/컨텐츠 경로/), { target: { value: '/MCS01/019/01/index.html' } });
    fireEvent.click(within(drawer).getByRole('button', { name: '등록 하기' }));
    await waitFor(() => expect(bodies['POST /admin/contents/5/details']).toMatchObject({ ContentsType: 'A', ContentsURL: '/MCS01/019/01/index.html', OrderByNum: 2, UseYN: 'Y', Teacher: 0 }));
    expect(window.confirm).toHaveBeenCalledWith('등록 하시겠습니까?');
  });

  it('course_category.php: tree with [미사용] and the 하부 카테고리 추가 drawer', async () => {
    mount(<CategoriesPage />, '/admin/categories');
    expect(await screen.findByText('직무')).toBeInTheDocument();
    expect(screen.getByText('[미사용]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '하부 카테고리 추가' }));
    expect(await screen.findByLabelText(/카테고리명/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/카테고리명/), { target: { value: '노무' } });
    fireEvent.click(screen.getByRole('button', { name: '등록 하기' }));
    await waitFor(() => expect(bodies['POST /admin/categories']).toEqual({ ParentCategory: 1, Deep: 2, CategoryName: '노무', OrderByNum: 2, UseYN: 'Y' }));
  });

  it('main_contents*.php: overview counts, course 사이트 노출, delete is a DELETE of the list row', async () => {
    mount(<ListsPage />, '/admin/lists?gubun=1');
    expect(await screen.findByText("HRDe's PICK 추천컨텐츠")).toBeInTheDocument();
    expect(await screen.findByText('마이크로 과정')).toBeInTheDocument();
    expect(screen.getByText('미사용')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '삭제' })[0]!);
    const dlg = await screen.findByRole('dialog');
    fireEvent.click(within(dlg).getByRole('button', { name: /확인|삭제/ }));
    await waitFor(() => expect(calls).toContain('DELETE /admin/lists/1/3'));
  });
});

describe('parity helpers', () => {
  it('validateCourseForm mirrors SubmitOk() of course_write.php', () => {
    const f = formFromDetail(detail as never);
    expect(validateCourseForm(f, false)).toEqual({});
    expect(validateCourseForm({ ...f, LectureCode: 'abc1' }, true).LectureCode).toContain('대문자');
    expect(validateCourseForm({ ...f, Keyword3: [], ContentsTime: '1시간' }, false)).toMatchObject({ Keyword3: '관심분야를 선택하세요.', ContentsTime: '교육시간은 숫자만 입력하세요.' });
    expect(courseBody({ ...f, LectureCode: 'NEW001', Price: '' }, 'X', true)).toMatchObject({ ctype: 'X', LectureCode: 'NEW001', Price: 0 });
  });
  it('detailSections follows the contents_detail.php TR switches', () => {
    expect(detailSections('A')).toEqual({ common: true, flash: true, movie: false, exam: false, examSelect: false, teacher: false });
    expect(detailSections('B')).toMatchObject({ common: true, movie: true });
    expect(detailSections('D')).toMatchObject({ exam: true, examSelect: false });
    expect(detailSections('F')).toMatchObject({ teacher: true, common: false });
  });
  it('parsePasted normalises headers like normalizeHeader()', () => {
    expect(parsePasted('번호\t강의 코드\t수강 유형\t차시수\t삭제\n1\tD00001\t이러닝\t3차시\t\n')).toEqual([{ 번호: '1', 강의코드: 'D00001', 수강유형: '이러닝', 차시수: '3차시', 삭제: '' }]);
  });
});
