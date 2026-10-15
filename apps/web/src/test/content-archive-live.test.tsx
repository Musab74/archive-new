import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { AdminSession } from '@ainex/contracts';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import LiveCoursesPage from '../features/admin/pages/content-archive/LiveCoursesPage';
import LiveCourseDetailPage, { EMPTY_LIVE_FORM, liveCourseBody, validateLiveForm } from '../features/admin/pages/content-archive/LiveCourseDetailPage';
import LiveCourseExcelPage from '../features/admin/pages/content-archive/LiveCourseExcelPage';
import { excelSerialDate, liveExcelRows, liveExcelTableFromXlsx, liveExcelTemplate, parseLiveExcel } from '../features/admin/pages/content-archive/liveExcel';
import { liveHref } from '../features/admin/pages/content-archive/shared';
import { adminRouteTree } from '../features/admin/routes';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RouteObject } from 'react-router-dom';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const superAdmin = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['E'], subGrants: ['E1'], canWrite: true } as AdminSession;
const sessionOf = (admin: AdminSession, canWrite = admin.canWrite): AdminSessionState => ({ phase: 'authed', admin, isAuthed: true, canWrite, secondsLeft: 900, login: async () => admin, logout: async () => undefined, extend: async () => true });

const liveRow = { idx: 5, lectureCode: 'LIVE01', classGrade: 'A', classGradeLabel: 'A등급', courseName: '라이브 특강', category: '-', chapter: '', chapterLabel: '차시', contentsTime: '60', packageLectureCode: null, hrdSeq: null, contentsStart: '2026-01-01', uploadDate: '2026-01-02', mobile: 'Y', mobileLabel: '사용', useYN: 'Y', useLabel: '사용', professor: null, regDate: '2026-01-01 00:00:00' };
const liveCourses = { items: [liveRow], page: 1, size: 30, total: 1 };
const detail = {
  idx: 5, ctype: 'R', lectureCode: 'LIVE01', name: '라이브 특강', useYN: 'Y', useLabel: '사용', hrdCode: null, category1: '0', category2: '0', keyword1: '', keyword2: '', contentsTime: '60', chapter: '0', chapterLabel: '없음', chapterRows: 0, isPackage: false, packageCodes: [], packageLectureCode: '', packageCount: 0, packageRef: 0, packageRefPad: '000',
  image: null, professor: '홍강사', price: 0, passTime: 0, regDate: '2026-01-01', views: 3, enrollments: 0, classGrade: 'A', classGradeLabel: 'A등급', categoryName1: null, categoryName2: null, category: '', hrdSeq: '', contentsStart: '2026-01-01', uploadDate: '2026-01-02', mobile: 'Y', mobileLabel: '사용', serviceType: 'R', serviceTypeLabel: '',
  keyword3: '', keyword4: '', intro: '소개', eduTarget: '대상', eduGoal: '목표', contentsUrl: '', mobileUrl: '', contentsEnd: '2026-12-31', legalEduReq: 'N', legalEduLabel: '아니오', prices: { normal: 0, priority: 0, large1: 0, large2: 0 }, terms: [], deleted: false, contentsUrlSelect: 'A', bookPrice: 0,
  attachFile: null, previewImage: null, bookImage: null, fileBase: '/upload/Course/', keyword1Name: null, keyword2Name: null, keyword3Ids: [], keyword4Ids: [], keyword3Names: [], keyword4Names: [], menuName: '실시간 강의실', testIdCount: 2, chapterMismatch: false, packageCourses: [], ncsCode: null,
};
const meta = { classGrades: [{ value: 'A', label: 'A등급' }, { value: 'B', label: 'B등급' }], useYN: [], serviceTypes: [], ctypes: [], categories: [{ idx: 1, name: '경영', children: [{ idx: 2, name: '리더십' }] }], keyword1: [], keyword2: [], keyword3: [{ idx: 7, name: '소통' }], keyword4: [], fileBase: '/upload/Course/', ncsCodes: [{ value: '020101', label: '020101 (기획·마케팅 / 자기계발)' }], ncsColumn: false };
const cells = { ClassGrade: 'A', UseYN: 'Y', ContentsURLSelect: 'A', PackageLectureCode: null, HrdSeq: null, Category1: '1', Category2: '2', ContentsName: '엑셀 라이브', Keyword1: '1', Keyword2: '2', Keyword3: '3', Keyword4: '4', Chapter: '1', ContentsTime: '60', ContentsStart: '2026-01-01', ContentsEnd: '2026-12-31', UploadDate: '2026-01-02', Professor: null, PassTime: 0, Mobile: 'Y', BookPrice: 0, PreviewImage: null, Intro: 'i', EduTarget: 't', EduGoal: 'g', Price: 0, Price01View: 0, Price02View: 0, Price03View: 0 };

let excelErrors = true;
let detailChapter = '0';
const calls: { line: string; body?: unknown }[] = [];
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET';
    const path = url.replace(/^.*\/v1/, '');
    calls.push({ line: `${method} ${path}`, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (path.startsWith('/admin/live-courses/export')) return new Response('﻿번호\r\n', { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': "attachment; filename*=UTF-8''x.csv" } });
    if (path === '/admin/live-courses/meta') return json(meta);
    if (path === '/admin/live-courses/excel' && method === 'GET') {
      const items = [{ no: 1, idx: 31, ctype: 'R', ServiceType: 'R', hrdCode: null, LectureCode: 'LIVE09', ...cells, missing: excelErrors ? { Intro: 'error', Professor: 'optional' } : { Professor: 'optional' }, duplicate: excelErrors ? 'course' : null, errors: excelErrors ? ['과정소개 미입력', '중복(이미 등록된 과정코드)'] : [], errorCount: excelErrors ? 2 : 0, status: excelErrors ? 'error' : 'wait' }];
      return json({ items, total: 1, errorCount: excelErrors ? 2 : 0 });
    }
    if (path === '/admin/live-courses/excel' && method === 'POST') return json({ ok: true, inserted: 1, ids: [31] }, 201);
    if (path === '/admin/live-courses/excel/31/register') return json({ ok: true, idx: 99, lectureCode: 'LIVE09', status: 'registered' }, 201);
    if (path === '/admin/live-courses/5/chapters') return json([{ chapterSeq: 11, chapterType: 'A', typeLabel: '강의 차시', order: 1, subIdx: '77', regDate: '2026-01-01', contentsIdx: 77, gubun: 'G', title: '1차시 오리엔테이션', listTitle: '1차시 오리엔테이션', lectureTimeMin: 30, deleted: false, details: 3, subCount: '3 건' }]);
    if (path === '/admin/live-courses/5/test-ids') return json({ lectureCode: 'LIVE01', items: [{ no: 1, id: 'simsa00001', name: '테스트', mobile: '010-0000-0001', lectureStart: '2026-01-01', lectureEnd: '2026-04-01', lastLogin: null, regDate: '2026-01-01', useYN: 'Y', useLabel: '사용' }] });
    if (path === '/admin/live-courses/5') return method === 'GET' ? json({ ...detail, chapter: detailChapter }) : json({ ok: true, deleted: 1, idx: 5 });
    if (path === '/admin/live-courses' && method === 'POST') return json({ ok: true, idx: 77, lectureCode: 'LIVE77' }, 201);
    if (path.startsWith('/admin/live-courses')) return json(liveCourses);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}

const mount = (_el: ReactElement, path: string, session = sessionOf(superAdmin)) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><ToastProvider><AdminSessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}>
      <Routes>
        {/* exactly what routes.tsx registers: only /admin/live-courses (the sub-screens are query params on it) */}
        <Route path="/admin/live-courses" element={<LiveCoursesPage />} />
        <Route path="*" element={<p>other page</p>} />
      </Routes>
    </MemoryRouter></AdminSessionContext.Provider></ToastProvider></QueryClientProvider>,
  );
};

describe('실시간 강의실 관리 (라이브 컨텐츠) pages', () => {
  beforeEach(() => { calls.length = 0; excelErrors = true; detailChapter = '0'; adminTokenStore.set('adm', 900); vi.stubGlobal('fetch', apiMock()); vi.spyOn(window, 'confirm').mockReturnValue(true); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); adminTokenStore.clear(); });

  it('list: 라이브 신규 등록 / 엑셀로 등록 / 엑셀 다운로드 / 실시간 강의 생성 / 예정 강의 등록, and a row click opens the live detail', async () => {
    mount(<LiveCoursesPage />, '/admin/live-courses');
    expect(await screen.findByRole('heading', { level: 1, name: '라이브 컨텐츠 관리' })).toBeInTheDocument();
    expect(await screen.findByText('라이브 특강')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /라이브 신규 등록/ })).toHaveAttribute('href', '/admin/live-courses?idx=new');
    expect(screen.getByRole('link', { name: /엑셀로 등록/ })).toHaveAttribute('href', '/admin/live-courses?view=excel');
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    fireEvent.click(screen.getByRole('button', { name: /예정 강의 등록/ }));
    fireEvent.click(screen.getByRole('button', { name: /실시간 강의 생성/ }));
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledWith('https://live.hrdeedu.co.kr/instructor', '_blank', 'noopener');
    fireEvent.click(screen.getByRole('button', { name: /엑셀 다운로드/ }));
    await waitFor(() => expect(calls.some((c) => c.line.startsWith('GET /admin/live-courses/export'))).toBe(true));
    expect(screen.getByRole('link', { name: /LIVE01/ })).toHaveAttribute('href', '/admin/live-courses?idx=5');
    // the whole row (not only the code / name links) opens the live detail (/admin/live-courses?idx=5) — not NotFound
    fireEvent.click(screen.getByText('60 분'));
    expect(await screen.findByText('[등록된 심사용 테스트 아이디 2건 보기]')).toBeInTheDocument();
    expect(screen.queryByText('other page')).toBeNull();
  });

  it('list: any archive sub-grant opens it ($ArchiveHasAnySub); a read-only (dept B) admin gets disabled write buttons; no E grant → no access', async () => {
    const e4 = { ...superAdmin, dept: 'B', topGrants: [], subGrants: ['E4'], canWrite: false } as AdminSession;
    const a = mount(<LiveCoursesPage />, '/admin/live-courses', sessionOf(e4));
    expect(await screen.findByText('라이브 특강')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /라이브 신규 등록/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /엑셀로 등록/ })).toBeDisabled();
    a.unmount();
    calls.length = 0;
    const none = { ...superAdmin, dept: 'B', topGrants: ['D'], subGrants: ['D1'] } as AdminSession;
    mount(<LiveCoursesPage />, '/admin/live-courses', sessionOf(none));
    expect(screen.queryByText('라이브 특강')).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('detail: course_read.php rows, test-id viewer, 목록 → live list, 컨텐츠 삭제 → DELETE then back to the live list', async () => {
    mount(<LiveCourseDetailPage />, '/admin/live-courses?idx=5');
    expect(await screen.findByText('홍강사')).toBeInTheDocument();
    for (const l of ['등급 / 과정코드', '사이트노출 / 컨텐츠 경로', '과정 분류', '교육시간', '과정명', '조회수', '차시수', '수료기준', '교육비용']) expect(screen.getByText(l)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '목록' })).toHaveAttribute('href', '/admin/live-courses');
    fireEvent.click(screen.getByText('[등록된 심사용 테스트 아이디 2건 보기]'));
    expect(await screen.findByText('simsa00001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '심사용 테스트 아이디 생성' })).toBeDisabled();
    fireEvent.click(screen.getAllByRole('button', { name: '닫기' }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: '컨텐츠 삭제' }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.click(within(dlg).getByRole('button', { name: /삭제|확인/ }));
    await waitFor(() => expect(calls.some((c) => c.line === 'DELETE /admin/live-courses/5')).toBe(true));
    expect(await screen.findByText('라이브 특강')).toBeInTheDocument(); // back on the list
  });

  it('new: ctype R skips 관심분야/역량/과정분류/난이도/직무분야/차시수 checks, offers the NCS select, confirms, then POSTs', async () => {
    mount(<LiveCourseDetailPage />, '/admin/live-courses?idx=new');
    expect(await screen.findByText('실시간 강의실 컨텐츠 관리 등록', { selector: 'h1' })).toBeInTheDocument();
    expect(await screen.findByText('소통')).toBeInTheDocument(); // meta loaded (관심분야 checklist)
    const submit = () => fireEvent.click(screen.getByText('등록', { selector: 'button' }));
    submit();
    expect(await screen.findByText('과정코드를 입력하세요.')).toBeInTheDocument();
    expect(screen.queryByText('관심분야를 선택하세요.')).toBeNull();
    expect(screen.queryByText('과정분류 대분류를 선택하세요.')).toBeNull();
    const set = (id: string, value: string) => fireEvent.change(document.getElementById(id)!, { target: { value } });
    set('lf-LectureCode', 'live77'); set('lf-ContentsName', '새 라이브'); set('lf-ContentsTime', '90'); set('lf-UploadDate', '2026-01-02');
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('만료일'), { target: { value: '2026-12-31' } });
    const ncs = document.getElementById('lf-NcsCode')!;
    ncs.focus(); fireEvent.keyDown(ncs, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByText('020101 (기획·마케팅 / 자기계발)'));
    submit();
    expect(window.confirm).toHaveBeenCalledWith('등록 하시겠습니까?');
    await waitFor(() => expect(calls.some((c) => c.line === 'POST /admin/live-courses')).toBe(true));
    const body = calls.find((c) => c.line === 'POST /admin/live-courses')!.body as Record<string, unknown>;
    expect(body).toMatchObject({ LectureCode: 'LIVE77', ContentsName: '새 라이브', ContentsTime: '90', NcsCode: '020101', Category1: '', Keyword3: [] });
  });

  it('form helpers: R validation order/messages and the PATCH body without LectureCode', () => {
    const e = validateLiveForm({ ...EMPTY_LIVE_FORM, LectureCode: 'AB' }, true);
    expect(Object.keys(e)).toEqual(['LectureCode', 'ContentsName', 'ContentsTime', 'ContentsStart', 'ContentsEnd', 'UploadDate']);
    expect(e.LectureCode).toBe('과정코드는 영문 대문자, 숫자로 4자 이상, 10자 이하로 입력하세요.');
    expect(validateLiveForm({ ...EMPTY_LIVE_FORM, ContentsTime: '1a' }, false).ContentsTime).toBe('교육시간은 숫자만 입력하세요.');
    const b = liveCourseBody({ ...EMPTY_LIVE_FORM, LectureCode: 'LIVE01', Category1: '3', Keyword1: '' }, false);
    expect(b.LectureCode).toBeUndefined(); expect(b.Category1).toBe(3); expect(b.Keyword1).toBe('');
  });

  it('excel: paste → upload (cells by column position), red 미입력 / 중복 and the error total block registration', async () => {
    mount(<LiveCourseExcelPage />, '/admin/live-courses?view=excel');
    expect(await screen.findByRole('heading', { level: 1, name: '실시간 강의실 엑셀 등록' })).toBeInTheDocument();
    expect(await screen.findByText('LIVE09')).toBeInTheDocument();
    expect(screen.getByText('중복(이미 등록된 과정코드)')).toBeInTheDocument();
    expect(screen.getByText(/오류 건수가 \[ 2 \]건이 있습니다/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '컨텐츠 등록하기' })).toBeNull();
    const header = '등급\t과정코드\t패키지\t사이트노출';
    fireEvent.change(screen.getByRole('textbox', { name: '엑셀 붙여넣기' }), { target: { value: `${header}\nA\tLIVE10\t\tY\n\n` } });
    expect(screen.getByText('읽은 행 1건')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '업로드 하기' }));
    expect(window.confirm).toHaveBeenCalledWith('업로드 하시겠습니까?');
    await waitFor(() => expect(calls.some((c) => c.line === 'POST /admin/live-courses/excel')).toBe(true));
    const rows = (calls.find((c) => c.line === 'POST /admin/live-courses/excel')!.body as { rows: Record<string, unknown>[] }).rows;
    expect(rows).toEqual([expect.objectContaining({ ClassGrade: 'A', LectureCode: 'LIVE10', PackageLectureCode: null, UseYN: 'Y', ContentsName: null })]);
  });

  it('excel: with no errors 컨텐츠 등록하기 registers row by row and shows 등록 in 상태', async () => {
    excelErrors = false;
    mount(<LiveCourseExcelPage />, '/admin/live-courses?view=excel');
    expect(await screen.findByText('LIVE09')).toBeInTheDocument();
    fireEvent.click(screen.getByText('컨텐츠 등록하기', { selector: 'button' }));
    expect(await screen.findByText(/등록한 엑셀파일로 실시간 강의실 컨텐츠 등록을 시작하시겠습니까/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('확인', { selector: 'button' }));
    await waitFor(() => expect(calls.some((c) => c.line === 'POST /admin/live-courses/excel/31/register')).toBe(true));
    expect(await screen.findByText('등록')).toBeInTheDocument();
  });

  it('liveExcel helpers: header row skipped, A..AD by position, template headers mark 필수/선택', () => {
    const rows = parseLiveExcel('h1,h2,h3\r\nB,LIVE11,"P1,P2"\r\n');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ClassGrade: 'B', LectureCode: 'LIVE11', PackageLectureCode: 'P1,P2', Price03View: null });
    const t = liveExcelTemplate(true).split('\r\n');
    expect(t[0]!.startsWith('﻿등급(필수),과정코드(필수),패키지콘텐츠 과정코드(선택)')).toBe(true);
    expect(t[0]!.split(',')).toHaveLength(30);
    expect(t[1]!.split(',')[1]).toBe('LIVE0001');
  });

  it('routing: routes.tsx registers /admin/live-courses, and the list buttons reach 신규 등록 / 엑셀로 등록 (no NotFound)', async () => {
    const paths: string[] = [];
    const walk = (r: RouteObject, base: string) => { const p = r.path ? `${base}/${r.path}` : base; if (r.path) paths.push(p); r.children?.forEach((c) => walk(c, p)); };
    walk(adminRouteTree, '');
    expect(paths).toContain('/admin/live-courses');
    expect(liveHref.detail(5)).toBe('/admin/live-courses?idx=5');
    expect(liveHref.detail(5, true)).toBe('/admin/live-courses?idx=5&mode=edit');
    const a = mount(<LiveCoursesPage />, '/admin/live-courses');
    expect(await screen.findByText('라이브 특강')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /라이브 신규 등록/ }));
    expect(await screen.findByText('실시간 강의실 컨텐츠 관리 등록', { selector: 'h1' })).toBeInTheDocument();
    a.unmount();
    mount(<LiveCoursesPage />, '/admin/live-courses');
    expect(await screen.findByText('라이브 특강')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /엑셀로 등록/ }));
    expect(await screen.findByRole('heading', { level: 1, name: '실시간 강의실 엑셀 등록' })).toBeInTheDocument();
    expect(screen.queryByText('other page')).toBeNull();
  });

  it('detail: 컨텐츠 수정 keeps ?idx and opens the edit form; 차시 구성 shows for an archive-only (E) admin from the E-granted endpoint', async () => {
    detailChapter = '2';
    const eOnly = { ...superAdmin, dept: 'B', topGrants: ['E'], subGrants: ['E1'], canWrite: true } as AdminSession;
    mount(<LiveCourseDetailPage />, '/admin/live-courses?idx=5', sessionOf(eOnly));
    expect(await screen.findByText('1차시 오리엔테이션')).toBeInTheDocument();
    for (const h of ['차시 순서', '차시 유형', '차시명 / 질문', '하부 컨텐츠수 / 문항수']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(calls.some((c) => c.line === 'GET /admin/live-courses/5/chapters')).toBe(true);
    expect(calls.some((c) => c.line.includes('/admin/courses/'))).toBe(false); // not the D1 chapter API
    // the course says 2 차시, the chapter list has 1 lecture row → the course_read_list.php warning
    expect(screen.getByText(/☆ 차시수 오류/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '컨텐츠 수정' }));
    expect(await screen.findByText(/실시간 강의실 컨텐츠 관리 수정/, { selector: 'h1' })).toBeInTheDocument();
    expect(screen.queryByText('other page')).toBeNull();
  });

  it('excel: the real 컨텐츠(샘플).xlsx is read like course_excel_upload.php (first sheet, row 2.., A..AD); date serials become dates', async () => {
    const dir = resolve(__dirname, '../features/admin/pages/content-archive');
    const table = await liveExcelTableFromXlsx(readFileSync(resolve(dir, 'live-contents-example.xlsx')));
    expect(table[0]![0]).toBe('등급');
    const rows = liveExcelRows(table);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]).toMatchObject({ ClassGrade: 'A', LectureCode: 'TEST1111', PackageLectureCode: 'HRDE', UseYN: 'Y', Keyword3: '83,86,88', ContentsTime: '100', ContentsStart: '20250301', Price: '150000', Price01View: '150000', Price03View: '0' });
    const blank = await liveExcelTableFromXlsx(readFileSync(resolve(dir, 'live-contents-form.xlsx')));
    expect(liveExcelRows(blank)).toHaveLength(0);
    expect(excelSerialDate('46023')).toBe('2026-01-01');
    expect(excelSerialDate('20260101')).toBe('20260101');
    expect(excelSerialDate('LIVE')).toBe('LIVE');
  });

  it('excel page: choosing the .xlsx file fills the rows and uploads them; the 양식/샘플 buttons download the legacy .xlsx files', async () => {
    mount(<LiveCourseExcelPage />, '/admin/live-courses?view=excel');
    expect(await screen.findByText('LIVE09')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '양식 다운로드' })).toHaveAttribute('download', '컨텐츠.xlsx');
    expect(screen.getByRole('link', { name: '샘플 다운로드' })).toHaveAttribute('download', '컨텐츠(샘플).xlsx');
    const bytes = readFileSync(resolve(__dirname, '../features/admin/pages/content-archive/live-contents-example.xlsx'));
    const file = new File([bytes], '컨텐츠(샘플).xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(screen.getByLabelText('엑셀 파일'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/읽은 행 [1-9]\d*건/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '업로드 하기' }));
    await waitFor(() => expect(calls.some((c) => c.line === 'POST /admin/live-courses/excel')).toBe(true));
    const rows = (calls.find((c) => c.line === 'POST /admin/live-courses/excel')!.body as { rows: Record<string, unknown>[] }).rows;
    expect(rows[0]).toMatchObject({ LectureCode: 'TEST1111', ContentsStart: '20250301' });
  });
});
