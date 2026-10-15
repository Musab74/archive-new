import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { router } from '../app/router';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import { tokenStore } from '../shared/auth/tokenStore';
import { readXlsx, sheetRows, cellRef, colName } from '../features/admin/pages/companies/xlsxRead';
import { DRAFT_KEY, IMPORT_KEYS, dropLines, isHrdTraineeFile, loadDraft, mapImportRows, rowFromHrdTraineeCells, rowsFromTemplateGrid, saveDraft } from '../features/admin/pages/companies/companyImport';
import { emptyValues, fromCompany, validateCompanyForm } from '../features/admin/pages/companies/CompanyForm';
import { flaggedKeys } from '../features/admin/pages/companies/CompanyImportPage';
import CompanyByCodePage from '../features/admin/pages/companies/CompanyByCodePage';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const adminA = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['A'], subGrants: ['A1'], canWrite: true };
const salesB = { ...adminA, id: 'sales01', dept: 'B', deptIdx: 2, topGrants: [], subGrants: ['A1'], canWrite: false };
const company = { idx: 1, companyCode: '1234567890', bizNo: '123-45-67890', companyName: '테스트기업', scale: 'C', scaleLabel: '우선지원대상', companyId: 'co01', hrd: null, ceo: '대표', uptae: null, upjong: null, zipcode: '06000', address01: '서울', address02: null, tel: '--', tel2: null, csEnabled: false, fax: '--', fax2: null, email: null, bankName: null, bankNumber: null, manageCode: 'co01', cyberUrl: null, cyberEnabled: false, eduManager: '담당', eduManagerPhone: '010', eduManagerEmail: 'e@x', salesManager: 'sales01', remark: null, sendSMS: 'Y', sendSMSLabel: '수신허용', regDate: '2026-10-01 10:00:00' };
const detail = { company, sales: { id: 'sales01', name: '영업', team: '영업부', mobile: null, useYN: 'Y', deptName: '영업부', deptPath: '영업부' }, stats: { members: 1, activeMembers: 1, eduManagers: 0, enrollments: 1, passed: 0, ended: 0, activeEnrollments: 1 }, managers: [] };
const terms = { year: 2026, order: 'desc', companyCode: '1234567890', items: [{ lectureCode: 'ARC2026', courseName: 'HRD 아카이브 2026', start: '2026-10-01', end: '2026-12-31', enrolled: 4, passed: 1, passRate: 25, price: 1000, refund: 500 }] };
const members = { items: [{ no: 1, idx: 2, id: 'user01', name: '홍길동', birthDay: '1991-****-03', gender: 'M', genderLabel: '남성', email: '*******@example.com', mobile: '010-****-3333', depart: '교육팀', position: '대리', lastLogin: null, regDate: '2026-10-01 10:00:00', useYN: 'Y', useYNLabel: '사용', eduManager: false }], page: 1, size: 20, total: 1 };
const studies = { items: [{ no: 1, studySeq: 849, serviceType: 'A', serviceTypeLabel: '패키지', id: 'user01', name: '홍길동', lectureCode: 'ARC2026', courseName: 'HRD 아카이브 2026', period: { start: '2026-10-01', end: '2026-12-29' }, tutorLimitDay: '2027-01-02', seconds: 27000, formatted: '7시간 30분', percent: 50, midView: '평가 없음', testView: '평가 없음', reportView: '과제 없음', totalScoreView: '-', passOk: 'N', passOkLabel: '미수료', studyEnd: false, tutor: 'admin01', tutorName: '강사', companyName: '테스트기업', depart: '교육팀', certCount: 2 }], page: 1, size: 20, total: 1 };
const progress = { study: { studySeq: 849, id: 'user01', name: '홍길동', lectureCode: 'ARC2026', courseName: 'HRD 아카이브 2026', period: { start: '2026-10-01', end: '2026-12-29' }, serviceTypeLabel: '패키지', passOkLabel: '미수료', passOk: 'N', companyName: '테스트기업(수강)', depart: '교육팀', tutor: 'tutor9', tutorName: '김첨삭' }, header: { seconds: 27000, label: '7시간 30분 0초', percent: 50 },
  learning: { isPackage: true, items: [{ no: 1, serviceTypeLabel: '이러닝', courseName: '하위과정', contentsTitle: '1강', lectureCode: 'D00001', chapterNo: 1, chapterSeq: 1001, rowStudySeq: 900, progress: 100, seconds: 27000, studyTimeLabel: '7시간 30분 0초', lectureTimeMin: 30, startDate: '2026-10-02 10:00:00', endDate: '2026-10-02 11:00:00' }], sum: { chapters: 1, seconds: 27000, label: '7시간 30분 0초', criterionSeconds: 54000, met: false, judge: '수강시간 미달' } } };
const ticks = { mode: 'ticks', chapterNo: 1, sameCount: 1, items: [{ no: 1, idx: 77, progress: 10, studyTime: 60, studyTimeLabel: '00:01:00 (+60)', delta: 60, positionSec: 60, ip: '1.2.3.4', at: '2026-10-02 10:01:00', lastStudy: null, sameMinute: true }] };
const courseInfo = { courseIdx: 1, lectureCode: 'ARC2026', classGrade: 'A', classGradeLabel: 'A등급', useYN: 'Y', useYNLabel: '사용', contentsURLSelect: 'A', packageLectureCode: 'D00001|D00002', hrdSeq: null, category: ' > ', serviceType: 'X', serviceTypeLabel: '이러닝', contentsTime: 900, contentsName: 'HRD 아카이브 2026', views: 3, keyword1: null, keyword2: null, keyword3: null, keyword4: null, chapter: 2, contentsStart: null, contentsEnd: null, uploadDate: null, professor: null, passTime: 15, mobile: 'Y', mobileLabel: '사용', bookPrice: 0, price: 0, price01: 0, price02: 0, price03: 0, bookIntro: null, attachFile: null, previewImage: null, bookImage: null, intro: null, eduTarget: null, eduGoal: null };
const meta = { scales: [{ value: 'C', label: '우선지원대상' }], sendSMS: [{ value: 'Y', label: '수신허용' }, { value: 'N', label: '수신거부' }], yn: [], banks: [], salesManagers: [{ id: 'sales01', name: '영업', team: '영업부', mobile: null, deptIdx: 2, deptName: '영업부' }] };
const list = { items: [{ idx: 1, companyCode: '1234567890', bizNo: '123-45-67890', companyName: '테스트기업', scale: 'C', scaleLabel: '우선지원대상', companyId: 'co01', manageCode: 'co01', cyberEnabled: false, eduManager: null, eduManagerPhone: null, eduManagerEmail: null, sendSMS: 'Y', sendSMSLabel: '수신허용', salesManager: 'sales01', salesName: '영업', salesTeam: '영업부', regDate: '2026-10-01 09:00:00' }], page: 1, size: 20, total: 1 };

const memberInfo = {
  profile: { id: 'user01', name: '홍길동', useYN: 'Y', unused: false, gender: 'M', genderLabel: '남성', email: '*******@example.com', tel: null, mobile: '010-****-3333', birthDay: '1991-****-03', hasEmail: true, hasTel: false, hasMobile: true, hasBirthDay: true,
    nameEng: '', zipcode: '', address01: '', address02: '', depart: '교육팀', position: '대리', etc01: '', etc02: '', mailling: '', acs: '', regDate: '2026-10-01 10:00:00', eduManager: 'N', protectId: '', marketing: 'N', marketingLabel: '미동의', cardName: '', cardNumber: '', companyCode: '1234567890', masked: true },
  company: null, loginHistory: [{ no: 1, regDate: '2026-10-02 09:00:00', ip: '10.0.0.1', device: 'PC', userAgent: 'UA', browser: 'Chrome' }], certHistory: [], inquiries: [],
};
const a1Only = { ...adminA, id: 'a1only', dept: 'D', deptIdx: 9, deptName: '사업주팀', topGrants: [], subGrants: ['A1'] }; // 사업주 관리 only (no 회원 관리 A2)
const calls: { url: string; method: string; body: unknown }[] = [];
function apiMock(who = adminA) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.endsWith('/auth/admin/refresh')) return json({ accessToken: 'adm', expiresIn: 900, admin: who });
    if (url.endsWith('/auth/admin/me')) return json(who);
    if (url.endsWith('/auth/refresh')) return json({ error: { code: 'SESSION_EXPIRED', message: 'x' } }, 401);
    if (url.endsWith('/public/design')) return json({ error: { code: 'NOT_FOUND', message: 'x' } }, 404);
    if (url.endsWith('/admin/companies/meta')) return json(meta);
    if (url.includes('/admin/companies/by-code/')) return json({ idx: 1, companyCode: '1234567890', companyName: '테스트기업' });
    if (url.includes('/admin/companies/course-info/')) return json(courseInfo);
    if (url.includes('/admin/companies/1/terms')) return json(terms);
    if (url.includes('/admin/companies/1/members/export')) return new Response('﻿번호\r\n', { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': "attachment; filename*=UTF-8''%EC%88%98%EA%B0%95%EC%83%9D%EC%A0%95%EB%B3%B4.csv" } });
    if (url.includes('/admin/companies/1/members')) return json(members);
    if (url.includes('/admin/companies/1/studies/849/progress-excel')) return new Response('﻿번호,과정구분\r\n', { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': "attachment; filename*=UTF-8''%ED%95%99%EC%8A%B5%EB%82%B4%EC%97%AD.csv" } });
    if (url.includes('/admin/companies/1/member-info/user01/reveal')) return json({ field: 'Mobile', label: '휴대폰', value: '010-2222-3333' });
    if (url.includes('/admin/companies/1/member-info/user01')) return json(memberInfo);
    if (url.includes('/admin/companies/1/studies/849/progress')) return json(progress);
    if (url.includes('/admin/companies/1/studies/849/chapter-log')) return json(ticks);
    if (url.includes('/admin/companies/1/studies')) return json(studies);
    if (method === 'PATCH' && url.endsWith('/admin/companies/1')) return json({ ok: true, updated: 1, fields: ['Ceo'] });
    if (url.endsWith('/admin/companies/1')) return json(detail);
    if (url.includes('/admin/companies/import')) {
      const body = JSON.parse(String(init?.body));
      return json({ mode: body.mode, summary: { total: body.rows.length, create: body.rows.length, update: 0, error: 0 }, rows: body.rows.map((r: { CompanyCode: string; CompanyName: string }, i: number) => ({ line: i + 1, action: 'create', companyCode: r.CompanyCode, companyName: r.CompanyName, companyId: r.CompanyCode, homePage: r.CompanyCode, errors: [], warnings: i === 0 ? ["우편번호 '1' 가 5자리 숫자가 아닙니다."] : [] })), applied: body.mode === 'commit' ? { created: body.rows.length, updated: 0, skipped: 0 } : null });
    }
    if (url.includes('/admin/companies')) return json(list);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}
const mount = (path: string, state?: unknown) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const memory = createMemoryRouter(router.routes, { initialEntries: [state ? { pathname: path, state } : path] });
  render(<QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><RouterProvider router={memory} /></MotionConfig></QueryClientProvider>);
  return memory;
};

describe('사업주 상세 (company_read.php) parity', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); tokenStore.clear(); adminTokenStore.clear(); calls.length = 0; });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('수강 정보 / 수강생 정보 / 수강 내역 show the PHP columns from the companies API (no B5/A2 endpoints)', { timeout: 20000 }, async () => {
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/companies/1', { listSearch: '?q=테스트&page=2' });
    expect(await screen.findByRole('heading', { level: 1, name: /사업주 상세/ }, { timeout: 8000 })).toBeInTheDocument();
    expect(await screen.findByText('2026-10-01 ~ 2026-12-31')).toBeInTheDocument();
    for (const h of ['생년월일', '성별', '이메일', '휴대폰', '부서', '직위', '최종로그인', '가입일', '계정 사용유무']) expect(screen.getAllByRole('columnheader', { name: new RegExp(h) }).length).toBeGreaterThan(0);
    expect(await screen.findByText('1991-****-03')).toBeInTheDocument();
    expect(screen.getByText('*******@example.com')).toBeInTheDocument();
    expect(screen.getByText('010-****-3333')).toBeInTheDocument();
    expect(await screen.findByText(/첨삭완료 : 2027-01-02까지/)).toBeInTheDocument();
    expect(screen.getAllByText('평가 없음')).toHaveLength(2);
    expect(screen.getByText('과제 없음')).toBeInTheDocument();
    expect(screen.getByText('미수료')).toBeInTheDocument();
    expect(screen.getByText('강사')).toBeInTheDocument();
    expect(screen.getByText(/부서 : 교육팀/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/admin/companies/1/studies?'))).toBe(true);
    expect(calls.some((c) => c.url.includes('/admin/companies/1/members?'))).toBe(true);
    expect(calls.some((c) => /\/admin\/(studies|members)\?/.test(c.url))).toBe(false);
    // 목록 keeps the list's search (pg/sw/col)
    const back = screen.getAllByRole('link', { name: '목록' })[0]!;
    expect(back.getAttribute('href')).toBe('/admin/companies?q=테스트&page=2');
  });

  it('진도율 opens the ProgressInfo drawer (학습 내역 → 차시 진도 로그); 과정명 opens CourseInfo', { timeout: 20000 }, async () => {
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/companies/1');
    fireEvent.click(await screen.findByRole('button', { name: '진도율 50% 상세' }));
    const drawer = await screen.findByRole('dialog', { name: '학습내역 상세 정보' });
    expect(await within(drawer).findByText('하위과정', { exact: false })).toBeInTheDocument();
    expect(within(drawer).getByText('수강시간 미달')).toBeInTheDocument();
    fireEvent.click(within(drawer).getByText('2026-10-02 10:00:00'));
    expect(await within(drawer).findByText('2026-10-02 10:01:00')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/chapter-log?') && c.url.includes('chapterSeq=1001') && c.url.includes('studySeq=900'))).toBe(true);
    fireEvent.click(within(drawer).getAllByRole('button', { name: '닫기' }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'HRD 아카이브 2026' }));
    const course = await screen.findByRole('dialog', { name: /컨텐츠 상세 정보/ });
    expect(await within(course).findByText('D00001|D00002')).toBeInTheDocument();
    expect(within(course).getByText('15 시간 이상')).toBeInTheDocument();
  });

  it('수강생 정보 엑셀 출력 calls company_read_excel equivalent; edit confirms before saving', { timeout: 20000 }, async () => {
    vi.stubGlobal('fetch', apiMock());
    const created = vi.fn(() => 'blob:x'); vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }));
    mount('/admin/companies/1');
    const exportBtn = await screen.findByRole('button', { name: '검색항목 엑셀 출력' });
    await waitFor(() => expect(exportBtn).toBeEnabled());
    fireEvent.click(exportBtn);
    await waitFor(() => expect(calls.some((c) => c.url.includes('/admin/companies/1/members/export'))).toBe(true));
    fireEvent.click(screen.getAllByRole('button', { name: '정보 수정' })[0]!);
    const ceo = await screen.findByLabelText('대표자명');
    // "--" (empty 3-part phone) is shown as an empty input
    expect((screen.getByLabelText('대표 전화번호') as HTMLInputElement).value).toBe('');
    fireEvent.change(ceo, { target: { value: '새대표' } });
    fireEvent.click(screen.getByRole('button', { name: '다시 작성' }));
    expect((screen.getByLabelText('대표자명') as HTMLInputElement).value).toBe('대표');
    fireEvent.change(screen.getByLabelText('대표자명'), { target: { value: '새대표' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('dialog', { name: '수정 하시겠습니까?' })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    fireEvent.click(within(screen.getByRole('dialog', { name: '수정 하시겠습니까?' })).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ Ceo: '새대표' }));
  });

  it('list: 검색항목 엑셀 출력 only for write accounts (AdminWrite=Y)', async () => {
    vi.stubGlobal('fetch', apiMock(salesB));
    mount('/admin/companies');
    expect(await screen.findByText('테스트기업')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /엑셀/ })).not.toBeInTheDocument();
  });
});

describe('CompanyInfo(CompanyCode) → /admin/companies/by-code/:code', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('resolves the CompanyCode and replaces the URL with the 사업주 상세 page', async () => {
    vi.stubGlobal('fetch', apiMock());
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const memory = createMemoryRouter([{ path: '/admin/companies/by-code/:code', element: <CompanyByCodePage /> }, { path: '/admin/companies/:idx', element: <p>detail page</p> }], { initialEntries: ['/admin/companies/by-code/123-45-67890'] });
    render(<QueryClientProvider client={qc}><RouterProvider router={memory} /></QueryClientProvider>);
    expect(await screen.findByText('detail page')).toBeInTheDocument();
    expect(memory.state.location.pathname).toBe('/admin/companies/1');
    expect(memory.state.location.search).toBe('?year=all&order=asc'); // company_info_pop.php: every term, LectureStart ASC
    expect(calls.some((c) => c.url.includes('/admin/companies/by-code/123-45-67890'))).toBe(true);
  });
});

describe('사업주 엑셀 등록 helpers', () => {
  const dir = resolve(__dirname, '../features/admin/pages/companies');
  it('reads the legacy 사업주정보(샘플).xlsx: first sheet, row 2, columns A..W', async () => {
    const book = await readXlsx(readFileSync(resolve(dir, 'company-sample.xlsx')));
    expect(book.sheetNames.length).toBeGreaterThan(0);
    const sheet = (await book.sheet(0))!;
    expect(sheet.cells.get('A1')).toBe('회사명(*)');
    const m = rowsFromTemplateGrid(sheetRows(sheet, 2, IMPORT_KEYS.length));
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0]).toMatchObject({ CompanyName: '홍길동 주식회사', CompanyCode: '1234567890', Ceo: '홍길동', Tel: '02-1111-2222', EduManager: '김사랑', EduManagerPhone: '010-1234-5678', EduManagerEmail: 'abc@naver.com', SalesManager: 'waiting', CyberEnabled: 'Y', CSEnabled: 'N', CompanyID: null });
    // the header row of the official template maps too (paste path)
    const header = sheetRows(sheet, 1, IMPORT_KEYS.length)[0]!;
    expect(mapImportRows([header, ['a', '', '', '1234567890']]).headerDetected).toBe(true);
    const blank = await readXlsx(readFileSync(resolve(dir, 'company-template.xlsx')));
    expect(rowsFromTemplateGrid(sheetRows((await blank.sheet(0))!, 2, IMPORT_KEYS.length)).rows).toHaveLength(0);
  });
  it('cell refs, HRD 훈련생 등록 cell map, row removal, draft storage, flagged cells', () => {
    expect(cellRef('AB12')).toEqual({ col: 28, row: 12 });
    expect(colName(23)).toBe('W');
    expect(isHrdTraineeFile('2026 HRD 훈련생 등록 양식.xlsx')).toBe(true);
    const cells: Record<string, string> = { B3: '(주)훈련', D3: '123-45 67890', B4: '대표', F3: 'B032119', B9: 'edu@x' };
    const m = rowFromHrdTraineeCells((r) => cells[r]);
    expect(m.rows[0]).toMatchObject({ CompanyName: '(주)훈련', CompanyCode: '1234567890', Ceo: '대표', SalesManager: 'B032119', EduManagerEmail: 'edu@x', CompanyScale: 'C', Zipcode: '00000', CyberEnabled: 'N', CSEnabled: 'N', CompanyID: null });
    expect(rowFromHrdTraineeCells(() => undefined).rows).toEqual([]);
    expect(dropLines(['a', 'b', 'c'], [1, 3])).toEqual(['b']);
    saveDraft({ rows: m.rows, format: 'hrdTrainee', fileName: 'x.xlsx', savedAt: 'now' });
    expect(loadDraft()).toMatchObject({ format: 'hrdTrainee', fileName: 'x.xlsx' });
    saveDraft(null);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect([...flaggedKeys({ line: 1, action: 'error', companyCode: 'x', companyName: '', companyId: 'x', homePage: 'x', errors: ["사업자번호 'x' 는 10자리 숫자가 아닙니다.", '회사명이 비어 있습니다.'], warnings: ["우편번호 '1' 가 5자리 숫자가 아닙니다.", "영업자ID 'z' 는 등록된 영업담당자(영업 부서)가 아닙니다."] })].sort()).toEqual(['CompanyCode', 'CompanyName', 'SalesManager', 'Zipcode']);
  });
  it('validateCompanyForm (create): 10-digit 사업자번호, required 4~20 alnum 사업주 ID; fromCompany hides "--"', () => {
    const base = { ...emptyValues(), CompanyName: 'A', SalesManager: 'B032' };
    expect(validateCompanyForm({ ...base, CompanyCode: '123-45-6789', CompanyID: 'ab01' }, 'create')).toEqual({ CompanyCode: '사업자번호는 10자리 숫자만 입력하세요.' });
    expect(validateCompanyForm({ ...base, CompanyCode: 'B03-2119', CompanyID: 'ab01' }, 'create')).toEqual({ CompanyCode: '사업자번호는 숫자만 입력하세요.' });
    expect(validateCompanyForm({ ...base, CompanyCode: '1234567890', CompanyID: '' }, 'create')).toEqual({ CompanyID: '사업주 아이디를 입력하세요.' });
    expect(validateCompanyForm({ ...base, CompanyCode: '1234567890', CompanyID: 'ab' }, 'create').CompanyID).toContain('4자이상');
    expect(validateCompanyForm({ ...base, CompanyCode: '1234567890', CompanyID: 'ab_01' }, 'create').CompanyID).toContain('영문/숫자');
    expect(validateCompanyForm({ ...base, CompanyCode: '1234567890', CompanyID: 'ab01' }, 'create')).toEqual({});
    expect(fromCompany(company as never)).toMatchObject({ Tel: '', Fax: '' });
  });
});

describe('사업주 엑셀 등록 page', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); tokenStore.clear(); adminTokenStore.clear(); calls.length = 0; });
  afterEach(() => { vi.unstubAllGlobals(); });
  it('pasted rows → 23-field two-row preview with warnings, 선택항목 삭제 re-validates, 업로드 하기 confirms then commits', async () => {
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/companies/import');
    const ta = await screen.findByLabelText(/붙여넣기|붙여 넣기|엑셀에서 복사/);
    fireEvent.change(ta, { target: { value: '회사명\t사업자등록번호\t영업담당자ID\t우편번호\n(주)하나\t1111111111\tsales01\t1\n(주)둘\t2222222222\tsales01\t06000' } });
    fireEvent.click(screen.getByRole('button', { name: /검증|확인/ }));
    const table = await screen.findByRole('table', { name: '업로드한 엑셀파일 데이터' });
    for (const h of ['회사 아이디', 'HRD코드', '전자계산서 이메일', '영업자ID', '고객센터 사용여부', '종목']) expect(within(table).getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(within(table).getByText("우편번호 '1' 가 5자리 숫자가 아닙니다.")).toBeInTheDocument();
    expect(localStorage.getItem(DRAFT_KEY)).toContain('(주)하나');
    fireEvent.click(within(table).getByRole('checkbox', { name: '1번 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '선택항목 삭제' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: '선택한 항목을 삭제하시겠습니까?' })).getByRole('button', { name: '확인' }));
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/import')).at(-1)?.body).toMatchObject({ mode: 'dryRun', rows: [expect.objectContaining({ CompanyName: '(주)둘' })], format: 'template' }));
    fireEvent.click(await screen.findByRole('button', { name: '업로드 하기' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: '현재 내역을 사업주로 등록하시겠습니까?' })).getByRole('button', { name: '확인' }));
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/import')).at(-1)?.body).toMatchObject({ mode: 'commit', skipInvalid: false }));
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
  });
});

describe('사업주 상세 fix-ups (verifier findings)', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); tokenStore.clear(); adminTokenStore.clear(); calls.length = 0; });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('아이디/이름 open MemberInfo in a drawer from the companies API — an A1-only account is not sent to /admin/members (A2)', { timeout: 20000 }, async () => {
    vi.stubGlobal('fetch', apiMock(a1Only));
    mount('/admin/companies/1');
    fireEvent.click(await screen.findByRole('button', { name: 'user01 수강생 상세 정보' }));
    const drawer = await screen.findByRole('dialog', { name: '수강생 상세 정보' });
    expect(await within(drawer).findByText('10.0.0.1')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/admin/companies/1/member-info/user01'))).toBe(true);
    expect(within(drawer).queryByRole('link', { name: '수강생 상세 페이지' })).not.toBeInTheDocument(); // no A2
    // masked 휴대폰 → 구분 + 사유 → InformationProtectionLog via the companies endpoint
    fireEvent.click(within(drawer).getByRole('button', { name: '010-****-3333' }));
    fireEvent.change(within(drawer).getByLabelText('휴대폰 열람 사유'), { target: { value: '사업주 문의 확인' } });
    fireEvent.click(within(drawer).getByRole('button', { name: '열람' }));
    expect(await within(drawer).findByText('010-2222-3333')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST' && c.url.includes('/admin/companies/1/member-info/user01/reveal'))?.body).toEqual({ field: 'Mobile', gubun: '학습자 관리', reason: '사업주 문의 확인' });
    fireEvent.click(within(drawer).getAllByRole('button', { name: '닫기' }).at(-1)!);
    // 수강 내역 이름/ID opens the same drawer
    fireEvent.click(await screen.findByRole('button', { name: '홍길동 (user01) 수강생 상세 정보' }));
    expect(await screen.findByRole('dialog', { name: '수강생 상세 정보' })).toBeInTheDocument();
    expect(screen.queryAllByRole('link').some((a) => (a.getAttribute('href') ?? '').startsWith('/admin/members/'))).toBe(false);
    expect(calls.some((c) => c.url.includes('/admin/nudge/'))).toBe(false);
  });

  it('ProgressInfo drawer: 사업주 / 교·강사 in 수강 정보, 과정구분 and 과정코드 columns, 학습내역 엑셀 출력', { timeout: 20000 }, async () => {
    vi.stubGlobal('fetch', apiMock(a1Only));
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    mount('/admin/companies/1');
    fireEvent.click(await screen.findByRole('button', { name: '진도율 50% 상세' }));
    const drawer = await screen.findByRole('dialog', { name: '학습내역 상세 정보' });
    expect(await within(drawer).findByText('테스트기업(수강)')).toBeInTheDocument();
    expect(within(drawer).getByText('김첨삭')).toBeInTheDocument();
    for (const h of ['번호', '과정구분', '과정명', '과정코드', '차시', '진도율', '수강시간', '학습시작일', '학습종료일']) expect(within(drawer).getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(within(drawer).getByText('D00001')).toBeInTheDocument();
    expect(within(drawer).getByText('이러닝')).toBeInTheDocument();
    fireEvent.click(within(drawer).getByRole('button', { name: '학습내역 엑셀 출력' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/admin/companies/1/studies/849/progress-excel'))).toBe(true));
    expect(calls.some((c) => c.url.includes('/admin/studies/progress-excel'))).toBe(false);
  });

  it('?year=all&order=asc (the CompanyInfo popup redirect) loads every term oldest first; the order can be switched', { timeout: 20000 }, async () => {
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/companies/1?year=all&order=asc');
    expect(await screen.findByText('2026-10-01 ~ 2026-12-31')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/admin/companies/1/terms?') && c.url.includes('year=all') && c.url.includes('order=asc'))).toBe(true);
    const sort = screen.getByRole('combobox', { name: '회차 정렬' });
    expect(sort).toHaveTextContent('오래된 회차부터');
    sort.focus(); fireEvent.keyDown(sort, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('option', { name: '최근 회차부터' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/terms?') && c.url.includes('year=all') && c.url.includes('order=desc'))).toBe(true));
  });

  it('import: a blank 회사명 is sent as "" (not null) so the API validates the row instead of rejecting the batch', { timeout: 20000 }, async () => {
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/companies/import');
    const ta = await screen.findByLabelText(/붙여넣기|붙여 넣기|엑셀에서 복사/);
    fireEvent.change(ta, { target: { value: '회사명\t사업자등록번호\t영업담당자ID\n\t1111111111\tsales01\n(주)둘\t\tsales01' } });
    fireEvent.click(screen.getByRole('button', { name: /검증|확인/ }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/import'))).toBe(true));
    const body = calls.find((c) => c.url.includes('/import'))!.body as { rows: Record<string, string | null>[] };
    expect(body.rows[0]).toMatchObject({ CompanyName: '', CompanyCode: '1111111111', Ceo: null });
    expect(body.rows[1]).toMatchObject({ CompanyName: '(주)둘', CompanyCode: '' });
  });

  it('import: a legacy .xls file is read (no "save as .xlsx" refusal) and its rows are validated', { timeout: 20000 }, async () => {
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/companies/import');
    const input = await screen.findByLabelText('엑셀 파일');
    expect(input.getAttribute('accept')).toContain('.xls');
    const bytes = readFileSync(resolve(__dirname, '../features/admin/pages/companies/company-legacy.xls'));
    fireEvent.change(input, { target: { files: [new File([bytes], '사업주정보.xls', { type: 'application/vnd.ms-excel' })] } });
    await waitFor(() => expect(calls.some((c) => c.url.includes('/import'))).toBe(true), { timeout: 8000 });
    const body = calls.find((c) => c.url.includes('/import'))!.body as { rows: Record<string, string | null>[]; format: string };
    expect(body.format).toBe('template');
    expect(body.rows).toHaveLength(2);
    expect(body.rows[0]).toMatchObject({ CompanyName: '(주)엑셀구버전', CompanyCode: '1234567890', SalesManager: 'B032119' });
    expect(body.rows[1]).toMatchObject({ CompanyName: '', CompanyCode: '2234567890' });
    expect(screen.queryByText(/\.xlsx"로 저장/)).not.toBeInTheDocument();
  });
});
