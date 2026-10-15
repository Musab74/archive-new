import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { AdminSession } from '@ainex/contracts';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import ContentsExcelPage from '../features/admin/pages/courses/ContentsExcelPage';
import CourseExcelPage, { courseTempFormError } from '../features/admin/pages/courses/CourseExcelPage';
import ChapterExcelPage, { chapterTempFormError } from '../features/admin/pages/courses/ChapterExcelPage';
import ContentDetailPage, { defaultPlayer } from '../features/admin/pages/courses/ContentDetailPage';
import CourseEditPage from '../features/admin/pages/courses/CourseEditPage';
import CoursesPage from '../features/admin/pages/courses/CoursesPage';
import ListsPage, { filterCandidates } from '../features/admin/pages/courses/ListsPage';
import { CHILD_GRID } from '../features/admin/pages/courses/CategoriesPage';
import { detailFormError, detailForm } from '../features/admin/pages/courses/courses-parity.contents';
import { playerSrc, stepMp4 } from '../features/admin/pages/courses/courses-parity.player';
import { listHref, parsePasted, rememberListSearch } from '../features/admin/pages/courses/courses-parity.shared';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin: AdminSession = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['D', 'E'], subGrants: ['D2', 'E1'], canWrite: true } as AdminSession;
const session: AdminSessionState = { phase: 'authed', admin, isAuthed: true, canWrite: true, secondsLeft: 900, login: async () => admin, logout: async () => undefined, extend: async () => true };

const ctRow = (idx: number, no: number, over: Record<string, unknown> = {}) => ({ no, idx, gubun: '테스트 차시', title: `${no}강`, lectureTime: 25, goal: '목표', trainingContents: '내용', activities: '활동', contentsType: 'A', pages: '5', mobilePages: '5', url: '/MCS01/019/01/index.html', mobileUrl: '/MCS01-m/019/01.mp4', regDate: null, missing: [], errorCount: 0, ...over });
const courseVals = { ClassGrade: 'A', LectureCode: 'TEST1111', PackageLectureCode: '', UseYN: 'Y', ContentsURLSelect: 'A', HrdSeq: '', Category1: '1', Category2: '2', ContentsName: '테스트 과정', Keyword1: '1', Keyword2: '7', Keyword3: '83,86', Keyword4: '97', Chapter: '2', ContentsTime: '100', ContentsStart: '2025-03-01', ContentsEnd: '2025-04-01', UploadDate: '2025-02-15', Professor: '', PassTime: 0, Mobile: 'N', BookPrice: 0, PreviewImage: '', Intro: '소개', EduTarget: '대상', EduGoal: '목표', Price: 150000, Price01View: 0, Price02View: 0, Price03View: 0, HrdCode: '', ServiceType: 'Z', Ctype: 'Z' };
const courseTemp = { ctype: 'Z', total: 1, errorCount: 2, items: [{ no: 1, idx: 11, values: courseVals, dates: { ContentsStart: '20250301', ContentsEnd: '20250401', UploadDate: '20250215' }, missing: ['Intro'], blank: ['HrdSeq'], duplicate: '중복(이미 등록된 과정코드)', errorCount: 2 }] };
const chapterTemp = { total: 2, errorCount: 0, items: [{ no: 1, idx: 21, lectureCode: 'TEST1111', chapterType: 'A', subIdx: '417', orderByNum: 1, missing: [], dupSub: null, dupOrder: null, errorCount: 0 }, { no: 2, idx: 22, lectureCode: 'TEST1111', chapterType: 'A', subIdx: '418', orderByNum: 2, missing: [], dupSub: null, dupOrder: null, errorCount: 0 }] };
const content = {
  idx: 5, gubun: '구분', title: '1강', lectureTimeMin: 25, goal: '목표', trainingContents: '내용', activities: '활동', regDate: null, deleted: false,
  details: [{ seq: 41, type: 'B', typeLabel: 'mp4 영상강의', pages: '1', mobilePages: '1', urlSelect: 'A', urlSelectLabel: '(주)', url: '/v/01.mp4', url2: 'https://cdn.example.com/backup.html', mobileUrl: '/m/01.mp4', mobileUrl2: null, question: null, examples: [null, null, null, null, null], answer: null, comment: null, teacher: 0, teacherName: null, useYN: 'Y', useLabel: '사용', order: 1, caption: 'cap.vtt' }],
  usedIn: [], nextDetailOrder: 2,
};
const courseRow = { idx: 7, ctype: 'Z', lectureCode: 'MIC001', name: '마이크로 과정', useYN: 'Y', useLabel: '사용', hrdCode: null, category1: '1', category2: '2', keyword1: '3', keyword2: '4', contentsTime: '10', chapter: '2', chapterLabel: '2차시', chapterRows: 2, isPackage: false, packageCodes: [], packageLectureCode: null, packageCount: 0, packageRef: 0, packageRefPad: '000', image: null, professor: null, price: 0, passTime: 0, regDate: null, views: 0, enrollments: 0, classGrade: 'A', classGradeLabel: 'A등급', categoryName1: '직무', categoryName2: '인사', category: '직무>인사', hrdSeq: null, contentsStart: '2026-01-01', uploadDate: '2026-01-02', mobile: 'Y', mobileLabel: '사용', serviceType: 'Z', serviceTypeLabel: '마이크로닝' };
const courseDetail = { ...courseRow, keyword3: '11', keyword4: '21', intro: '', eduTarget: '', eduGoal: '', contentsUrl: '', mobileUrl: '', contentsEnd: '2026-12-31', legalEduReq: 'N', legalEduLabel: '아니오', prices: { normal: 0, priority: 0, large1: 0, large2: 0 }, terms: [], deleted: false, contentsUrlSelect: 'A', bookPrice: 0, attachFile: 'old01.pdf', previewImage: null, bookImage: null, fileBase: '/upload/Course/', keyword1Name: null, keyword2Name: null, keyword3Ids: [11], keyword4Ids: [21], keyword3Names: [], keyword4Names: [], menuName: '마이크로닝', testIdCount: 0, chapterMismatch: false, packageCourses: [] };
const meta = { classGrades: [{ value: 'A', label: 'A등급' }], useYN: [], serviceTypes: [], ctypes: [], categories: [{ idx: 1, name: '직무', children: [{ idx: 2, name: '인사' }] }], keyword1: [{ idx: 3, name: '사원', del: false, useYN: 'Y' }], keyword2: [{ idx: 4, name: '인사', del: false, useYN: 'Y' }], keyword3: [{ idx: 11, name: '리더십' }], keyword4: [{ idx: 21, name: '소통' }], fileBase: '/upload/Course/' };
const chapters = [{ chapterSeq: 31, chapterType: 'A', typeLabel: '강의 차시', order: 1, subIdx: '5', regDate: null, contentsIdx: 5, gubun: '마이크로 과정', title: '1강', listTitle: '1강', lectureTimeMin: 25, deleted: false, details: 3, subCount: '3 건' }, { chapterSeq: 32, chapterType: 'C', typeLabel: '최종평가', order: 2, subIdx: '1|2', regDate: null, contentsIdx: null, gubun: null, title: null, listTitle: null, lectureTimeMin: null, deleted: false, details: 0, subCount: null }];

let contentsTemp: { items: unknown[]; total: number; errorCount: number };
let detailOverride: Record<string, unknown> = {};
const calls: string[] = [];
const bodies: Record<string, unknown> = {};
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^.*\/v1/, ''); const method = init?.method ?? 'GET';
    calls.push(`${method} ${url}`);
    const key = `${method} ${url.split('?')[0]}`;
    if (init?.body instanceof FormData) bodies[key] = { file: (init.body.get('file') as File | null)?.name };
    else if (init?.body) bodies[key] = JSON.parse(String(init.body));
    if (method === 'POST' && /\/register$/.test(url.split('?')[0]!)) { const idx = Number(/\/(\d+)\/register/.exec(url)![1]); return json({ ok: idx !== 22, idx, status: idx === 22 ? 'C' : 'B', label: idx === 22 ? '오류' : '등록', newIdx: 900 }); }
    if (method === 'POST' && url.startsWith('/admin/courses/files/upload')) return json({ ok: true, fileName: '2026101518000001.png', realFileName: 'a.png' });
    if (method === 'POST' && url.endsWith('/excel-temp/upload')) return json({ ok: true, inserted: 2, ids: [1, 2] });
    if (method !== 'GET') return json({ ok: true, updated: 1, deleted: 1, removed: true });
    if (url.startsWith('/admin/contents/excel-temp')) return json(contentsTemp);
    if (url.startsWith('/admin/courses/excel-temp')) return json(courseTemp);
    if (url.startsWith('/admin/chapters/excel-temp')) return json(chapterTemp);
    if (url.startsWith('/admin/contents/meta')) return json({ contentsTypes: [{ value: 'B', label: 'mp4 영상강의' }], teachers: [], servers: { flash: 'https://f.example/contents', movie: 'https://mv.example/contents', mobile: 'https://mo.example/contents' } });
    if (url.startsWith('/admin/contents/options')) return json({ gubuns: ['마이크로 과정'], contents: [{ no: 1, idx: 5, title: '1강', detailCount: 3 }, { no: 2, idx: 6, title: '2강', detailCount: 1 }] });
    if (url.startsWith('/admin/contents/5')) return json(content);
    if (url.startsWith('/admin/courses/meta')) return json(meta);
    if (/^\/admin\/courses\/MIC001\/chapters/.test(url)) return json(chapters);
    if (url.startsWith('/admin/courses/7')) return json({ ...courseDetail, ...detailOverride });
    if (url.startsWith('/admin/courses?')) return json({ items: [courseRow], page: 1, size: 30, total: 1 });
    if (url === '/admin/lists') return json({ items: [{ gubun: '1', label: 'PICK', title: "HRDe's PICK 추천컨텐츠", count: 1 }] });
    if (url.startsWith('/admin/lists/1/candidates')) return json({ items: [{ no: 1, idx: 8, lectureCode: 'NEW001', name: '신규 과정', ctype: 'X' }, { no: 2, idx: 9, lectureCode: 'ABC002', name: '경영 기초', ctype: 'X' }] });
    if (url.startsWith('/admin/lists/1')) return json({ gubun: '1', label: 'PICK', title: "HRDe's PICK 추천컨텐츠", items: [{ idx: 3, lectureCode: 'MIC001', order: 0, useYN: 'Y', courseUseYN: 'Y', courseUseLabel: '사용', regDate: null, regId: 'admin01', name: '마이크로 과정', ctype: 'Z', serviceType: 'Z', courseVisible: true }] });
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}
const mount = (el: ReactElement, path = '/x', route?: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><AdminSessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}>{route ? <Routes><Route path={route} element={el} /></Routes> : el}</MemoryRouter></AdminSessionContext.Provider></ToastProvider></QueryClientProvider>);
};

describe('엑셀로 등록 screens', () => {
  beforeEach(() => {
    calls.length = 0; for (const k of Object.keys(bodies)) delete bodies[k]; detailOverride = {};
    contentsTemp = { total: 2, errorCount: 4, items: [ctRow(1, 1), ctRow(2, 2, { lectureTime: 0, goal: '', trainingContents: '', activities: '', missing: ['LectureTime', 'Expl01', 'Expl02', 'Expl03'], errorCount: 4 })] };
    adminTokenStore.set('adm', 900); vi.stubGlobal('fetch', apiMock()); vi.spyOn(window, 'confirm').mockReturnValue(true);
    try { sessionStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); adminTokenStore.clear(); });

  it('contents_excel.php: samples, the 14 PHP columns, 미입력 marks and the error count instead of 차시 등록하기', async () => {
    mount(<ContentsExcelPage />, '/admin/contents/excel');
    expect(await screen.findByRole('heading', { level: 1, name: '기초차시 엑셀 등록' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '양식 다운로드' })).toHaveAttribute('download', '기초차시.xlsx');
    expect(screen.getByRole('link', { name: '샘플 다운로드' })).toHaveAttribute('download', '기초차시(샘플).xlsx');
    expect(await screen.findByText('2강')).toBeInTheDocument();
    for (const h of ['번호', '차시 구분', '차시명', '수강시간', '차시 목표', '훈련 내용', '학습 활동', '콘텐츠 유형', '차시페이지수', '모바일페이지수', '콘텐츠 경로', '모바일 경로', '상태']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getAllByText('미입력')).toHaveLength(4);
    expect(screen.getByText('오류 건수가 [ 4 ]건이 있습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '차시 등록하기' })).toBeNull();
    expect(screen.getAllByText('대기')).toHaveLength(2);
  });

  it('upload: file required, confirm, multipart POST; 선택항목 삭제 with 전체 선택 posts the ids', async () => {
    mount(<ContentsExcelPage />, '/admin/contents/excel');
    await screen.findByText('2강');
    fireEvent.click(screen.getByRole('button', { name: '업로드 하기' }));
    expect(await screen.findByText('엑셀 파일을 선택하세요.')).toBeInTheDocument();
    const file = new File(['x'], '기초차시.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(screen.getByLabelText('엑셀 파일'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '업로드 하기' }));
    await waitFor(() => expect(bodies['POST /admin/contents/excel-temp/upload']).toEqual({ file: '기초차시.xlsx' }));
    expect(window.confirm).toHaveBeenCalledWith('업로드 하시겠습니까?');
    fireEvent.click(screen.getByRole('button', { name: '선택항목 삭제' }));
    expect(await screen.findByText('삭제하려는 항목을 선택하세요.')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('전체 선택'));
    fireEvent.click(screen.getByRole('button', { name: '선택항목 삭제' }));
    await waitFor(() => expect(bodies['POST /admin/contents/excel-temp/delete']).toEqual({ ids: [1, 2] }));
  });

  it('차시 등록하기 registers every row in order and shows 등록 / 오류 per row', async () => {
    contentsTemp = { total: 2, errorCount: 0, items: [ctRow(21, 1), ctRow(22, 2)] };
    mount(<ContentsExcelPage />, '/admin/contents/excel');
    await screen.findByText('2강');
    fireEvent.click(await screen.findByRole('button', { name: '차시 등록하기' }));
    await waitFor(() => expect(calls.filter((c) => c.includes('/register'))).toEqual(['POST /admin/contents/excel-temp/21/register', 'POST /admin/contents/excel-temp/22/register']));
    expect(await screen.findByText('등록')).toBeInTheDocument();
    expect(screen.getByText('오류')).toBeInTheDocument();
    expect((window.confirm as unknown as { mock: { calls: string[][] } }).mock.calls.some((c) => c[0]!.startsWith('등록한 엑셀파일로 기초차시 등록을 시작하시겠습니까?'))).toBe(true);
  }, 15000);

  it('contents_reg_edit.php: popup validation and PATCH of the six fields', async () => {
    mount(<ContentsExcelPage />, '/admin/contents/excel');
    await screen.findByText('2강');
    fireEvent.click(screen.getAllByRole('button', { name: '수정' })[1]!);
    const dlg = await screen.findByRole('dialog');
    fireEvent.click(within(dlg).getByRole('button', { name: '수정 하기' }));
    expect(await within(dlg).findByText('수강시간을 입력하세요.')).toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText(/수강시간/), { target: { value: '30' } });
    fireEvent.click(within(dlg).getByRole('button', { name: '수정 하기' }));
    await waitFor(() => expect(bodies['PATCH /admin/contents/excel-temp/2']).toEqual({ Gubun: '테스트 차시', ContentsTitle: '2강', LectureTime: '30', Expl01: '', Expl02: '', Expl03: '' }));
  });

  it('course_write_excel.php: ctype notice, 33 columns, red/blue 미입력, duplicate code, edit popup PATCH', async () => {
    mount(<CourseExcelPage />, '/admin/courses/excel?ctype=Z');
    expect(await screen.findByRole('heading', { level: 1, name: '마이크로닝 엑셀 등록' })).toBeInTheDocument();
    expect(screen.getByText(/모두 "마이크로닝" 으로 등록이 됩니다/)).toBeInTheDocument();
    expect(await screen.findByText('중복(이미 등록된 과정코드)')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(33);
    expect(screen.getAllByText('미입력')).toHaveLength(2); // Intro (red) + HrdSeq (blue)
    expect(screen.getByText('20250301')).toBeInTheDocument();
    expect(screen.getByText('오류 건수가 [ 2 ]건이 있습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText(/과정분류1/), { target: { value: 'a' } });
    fireEvent.click(within(dlg).getByRole('button', { name: '수정 하기' }));
    expect(await within(dlg).findByText('과정분류1은 숫자만 입력하세요.')).toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText(/과정분류1/), { target: { value: '1' } });
    fireEvent.change(within(dlg).getByLabelText(/과정코드/, { selector: '#ce-LectureCode' }), { target: { value: 'TEST2222' } });
    fireEvent.click(within(dlg).getByRole('button', { name: '수정 하기' }));
    await waitFor(() => expect(bodies['PATCH /admin/courses/excel-temp/11']).toMatchObject({ LectureCode: 'TEST2222', Category1: '1', ContentsURLSelect: 'A', ContentsStart: '20250301', Intro: '소개' }));
  });

  it('chapter_write_excel.php: register run sends ctype-less per-row calls', async () => {
    mount(<ChapterExcelPage />, '/admin/chapters/excel?ctype=X&from=%2Fadmin%2Fcourses%2F7');
    expect(await screen.findByRole('heading', { level: 1, name: '이러닝 차시 엑셀 등록' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '목록' })).toHaveAttribute('href', '/admin/courses/7');
    for (const h of ['과정코드', '유형', '기초차시 idx값', '정렬 순서', '상태']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: '차시 등록하기' }));
    await waitFor(() => expect(calls.filter((c) => c.includes('/register'))).toEqual(['POST /admin/chapters/excel-temp/21/register', 'POST /admin/chapters/excel-temp/22/register']));
  });
});

describe('inside-page parity (contents / course / chapters / lists)', () => {
  beforeEach(() => { calls.length = 0; for (const k of Object.keys(bodies)) delete bodies[k]; detailOverride = {}; adminTokenStore.set('adm', 900); vi.stubGlobal('fetch', apiMock()); vi.spyOn(window, 'confirm').mockReturnValue(true); try { sessionStorage.clear(); } catch { /* ignore */ } });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); adminTokenStore.clear(); });

  it('contents_read.php: (주) plays the video with the server prefix, (예비) opens the raw URL in an iframe; 목록 keeps the list search', async () => {
    rememberListSearch('contents', '?gubun=%EA%B5%AC%EB%B6%84&page=3');
    const { container } = mount(<ContentDetailPage />, '/admin/contents/5', '/admin/contents/:idx');
    expect(await screen.findByText('기초차시 상세 구성 (1)')).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('video')?.getAttribute('src')).toBe('https://mv.example/contents/v/01.mp4'));
    fireEvent.click(screen.getByText('(예비) https://cdn.example.com/backup.html'));
    await waitFor(() => expect(container.querySelector('iframe')?.getAttribute('src')).toBe('https://cdn.example.com/backup.html'));
    fireEvent.click(screen.getByText('(주) /m/01.mp4'));
    await waitFor(() => expect(container.querySelector('video')?.getAttribute('src')).toBe('https://mo.example/contents/m/01.mp4'));
    expect(screen.getByRole('button', { name: '다음 차시 ▶' })).toBeInTheDocument();
    expect(screen.getByText('URL: https://mo.example/contents/m/01.mp4')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '목록' })).toHaveAttribute('href', '/admin/contents?gubun=%EA%B5%AC%EB%B6%84&page=3');
  });

  it('contents_detail.php caption: 파일 삭제 clears Caption and is saved with the PUT', async () => {
    mount(<ContentDetailPage />, '/admin/contents/5', '/admin/contents/:idx');
    fireEvent.click(await screen.findByRole('button', { name: '수정' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('cap.vtt')).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole('button', { name: '파일 삭제' }));
    fireEvent.click(within(dlg).getByRole('button', { name: '등록 하기' }));
    await waitFor(() => expect(bodies['PUT /admin/contents/5/details/41']).toMatchObject({ Caption: '', ContentsType: 'B', ContentsURL: '/v/01.mp4' }));
  });

  it('course.php: 30 rows per page, 엑셀로 등록 button', async () => {
    mount(<CoursesPage />, '/admin/courses?ctype=Z&page=2');
    expect(await screen.findByText('마이크로 과정')).toBeInTheDocument();
    expect(calls.some((c) => c.includes('/admin/courses?') && c.includes('size=30') && c.includes('page=2'))).toBe(true);
    expect(screen.getByRole('button', { name: '엑셀로 등록' })).toBeInTheDocument();
  });

  it('course_read.php: deleted content shows no detail; 학습자료 is a download link; 목록 keeps the list search', async () => {
    rememberListSearch('courses:Z', '?ctype=Z&page=2&q=%EB%A7%88');
    mount(<CourseEditPage />, '/admin/courses/7', '/admin/courses/:idx');
    expect(await screen.findByRole('link', { name: 'old01.pdf' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '목록' })[0]).toHaveAttribute('href', '/admin/courses?ctype=Z&page=2&q=%EB%A7%88');
    expect(screen.getByRole('button', { name: '엑셀로 등록' })).toBeInTheDocument(); // 차시 구성 → chapter_write_excel
  });

  it('deleted course (Del=Y): only the notice and 목록', async () => {
    detailOverride = { deleted: true };
    mount(<CourseEditPage />, '/admin/courses/7', '/admin/courses/:idx');
    expect(await screen.findByText(/삭제된\(Del=Y\) 컨텐츠입니다/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '컨텐츠 수정' })).toBeNull();
  });

  it('course_write.php: 파일 첨부 uploads to upload/Course and the PATCH carries the new file name', async () => {
    mount(<CourseEditPage />, '/admin/courses/7?mode=edit', '/admin/courses/:idx');
    expect(await screen.findByDisplayValue('마이크로 과정')).toBeInTheDocument();
    const pickers = screen.getAllByLabelText('첨부할 파일');
    fireEvent.change(pickers[1]!, { target: { files: [new File(['p'], 'a.png', { type: 'image/png' })] } });
    await waitFor(() => expect(calls).toContain('POST /admin/courses/files/upload?kind=img'));
    expect(await screen.findByText('2026101518000001.png')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '파일 삭제' })[0]!); // 학습자료 old01.pdf
    await waitFor(() => expect(calls).toContain('DELETE /admin/courses/files/old01.pdf?idx=7'));
    await waitFor(() => expect(screen.queryByText('old01.pdf')).toBeNull()); // the form drops the file once the DELETE answers
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    await waitFor(() => expect(bodies['PATCH /admin/courses/7']).toMatchObject({ PreviewImage: '2026101518000001.png', attachFile: '' }));
  });

  it('chapter_regist.php: confirm, the drawer stays open with 정렬 순서 + 1; 수정 is allowed on a non-강의 row', async () => {
    mount(<CourseEditPage />, '/admin/courses/7', '/admin/courses/:idx');
    expect(await screen.findByText('최종평가')).toBeInTheDocument();
    const edits = screen.getAllByRole('button', { name: '수정' });
    expect(edits[edits.length - 1]).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '추가 하기' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByLabelText('현재 강의와 일치하는 차시구분만 보기')).toBeChecked();
    expect(within(dlg).getByLabelText(/정렬 순서/)).toHaveValue('3');
    // pick a base content via the native fallback of ASelect: set the value through the form helper
    const sel = within(dlg).getByRole('combobox', { name: /기초 차시 선택/ });
    expect(sel).toBeInTheDocument();
  });

  it('main_contents_list.php: typing filters the course picker; 정렬하기 works without reordering', async () => {
    mount(<ListsPage />, '/admin/lists?gubun=1');
    expect(await screen.findByText('마이크로 과정')).toBeInTheDocument();
    const sort = screen.getByRole('button', { name: '정렬하기' });
    expect(sort).not.toBeDisabled();
    fireEvent.click(sort);
    await waitFor(() => expect(bodies['PUT /admin/lists/1/order']).toEqual({ ids: [3] }));
    fireEvent.change(screen.getByLabelText('과정 검색'), { target: { value: 'abc' } });
    await waitFor(() => expect(screen.getByLabelText('과정 검색')).toHaveValue('abc'));
    expect(filterCandidates([{ no: 1, lectureCode: 'NEW001', name: '신규 과정' }, { no: 2, lectureCode: 'ABC002', name: '경영 기초' }], 'abc')).toHaveLength(1);
  }, 15000);
});

describe('parity helpers', () => {
  it('ContentsDetailSubmitOk rules', () => {
    const f = detailForm(null, 3);
    expect(detailFormError({ ...f, ContentsType: 'A' })).toEqual({ field: 'ContentsURL', message: '컨텐츠 경로를 입력하세요.' });
    expect(detailFormError({ ...f, ContentsType: 'C', Question: 'q', Example01: '1', Example02: '2', Example03: '3', Example04: '4' })?.message).toBe('보기중 정답을 선택하세요.');
    expect(detailFormError({ ...f, ContentsType: 'D', Question: 'q' })?.message).toBe('해답 설명을 입력하세요.');
    expect(detailFormError({ ...f, ContentsType: 'F' })?.message).toBe('강사를 선택하세요.');
    expect(detailFormError({ ...f, ContentsType: 'E', OrderByNum: 'x' })?.message).toBe('정렬순서는 숫자만 입력하세요.');
    expect(detailFormError({ ...f, ContentsType: 'G' })).toBeNull();
  });
  it('players: server prefix unless https, 예비 raw; mobile stepping', () => {
    const servers = { flash: 'https://f/contents', movie: 'https://m/contents', mobile: 'https://mo/contents/' };
    expect(playerSrc({ kind: 'flash', sel: 'A', url: '/a/index.html' }, servers)).toBe('https://f/contents/a/index.html');
    expect(playerSrc({ kind: 'mobile', sel: 'A', url: 'https://x/1.mp4' }, servers)).toBe('https://x/1.mp4');
    expect(playerSrc({ kind: 'mobile', sel: 'A', url: '/m/01.mp4' }, servers)).toBe('https://mo/contents/m/01.mp4');
    expect(playerSrc({ kind: 'movie', sel: 'B', url: 'b.html' }, servers)).toBe('b.html');
    expect(stepMp4('https://mo/c/09.mp4', true)).toEqual({ ok: true, url: 'https://mo/c/10.mp4' });
    expect(stepMp4('https://mo/c/01.mp4', false)).toEqual({ ok: false, message: '이전 차시가 없습니다.' });
    expect(stepMp4('https://mo/c/a.html', true)).toEqual({ ok: false, message: '영상 경로를 인식할 수 없습니다.' });
    expect(defaultPlayer({ ...content.details[0]!, type: 'A', url: '/f/index.html' } as never)).toEqual({ kind: 'flash', sel: 'A', url: '/f/index.html' });
  });
  it('popup validations of the temp rows', () => {
    expect(chapterTempFormError({ LectureCode: 'T', ChapterType: 'A', Sub_idx: '1', OrderByNum: 'x' })?.message).toBe('정렬순서는 숫자만 입력하세요.');
    expect(courseTempFormError({ ClassGrade: '' })?.message).toBe('등급을 입력하세요.');
  });
  it('list search memory, select2 filter, 5-per-row grid, pasted blank rows keep numbering', () => {
    rememberListSearch('packages', '?packageYN=Y&page=4');
    expect(listHref('packages', '/admin/courses', '?packageYN=Y')).toBe('/admin/courses?packageYN=Y&page=4');
    expect(listHref('none', '/admin/contents')).toBe('/admin/contents');
    expect(filterCandidates([{ no: 1, lectureCode: 'NEW001', name: '신규' }, { no: 12, lectureCode: 'ABC', name: '경영 기초' }], '경영').map((c) => c.lectureCode)).toEqual(['ABC']);
    expect(filterCandidates([{ no: 1, lectureCode: 'NEW001', name: '신규' }], '')).toHaveLength(1);
    expect(CHILD_GRID).toContain('/ 5');
    expect(parsePasted('강의 코드\t수강 유형\t차시수\nA\tX\t1\n\nB\tX\t1\n')).toHaveLength(3);
  });
});
