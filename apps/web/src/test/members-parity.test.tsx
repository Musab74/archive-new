import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { router } from '../app/router';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import { tokenStore } from '../shared/auth/tokenStore';
import { residentNoValid, validateMemberForm } from '../features/admin/pages/members/members-parity-form';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], subGrants: ['A1', 'A2', 'A3'], canWrite: true };
const detail = {
  profile: { idx: 2, id: 'user01', name: '홍길동', memberType: 'A', memberTypeLabel: '아카이브', companyCode: '1234567890', companyName: '테스트기업', depart: '교육팀', position: '대리', gender: 'M', genderLabel: '남성', address: { zipcode: '06000', address01: '서울', address02: '1층' }, email: '*******@example.com', mobile: '010-****-3333', tel: null, birthDay: '1991-****-03', masked: true, useYN: 'Y', eduManager: 'Y', testId: 'N', protectId: 'Y', memberRemark: null, sleep: 'N', sleepDate: null, memberOut: 'N', memberOutDate: null, lastLogin: null, lastLoginIp: null, regDate: '2026-10-01 10:00:00', editDate: null, passChange: 'Y', mandatory: 'Y', marketing: 'Y', marketingLabel: '수신허용', abilityYN: null, abilityAfterYN: null, hrd: { nwIno: null, trneeSe: null, irglbrSe: null }, nameEng: 'Hong', etc01: '자격증', etc02: 'SNS', mailling: 'Y', acs: 'N', cardName: null, cardNumber: null, recomId: null, testLectureCode: null },
  company: { idx: 1, scale: 'C', scaleLabel: '우선지원대상', companyName: '테스트기업', companyCode: '1234567890', hrd: 'H1', companyId: 'co1', ceo: '대표', tel: '02-1', tel2: null, csEnabled: false, uptae: null, upjong: null, fax: null, fax2: null, address: { zipcode: null, address01: null, address02: null }, bankName: null, bankNumber: null, email: null, homePage: null, eduManager: '담당', eduManagerPhone: '010', eduManagerEmail: 'e@x', salesManager: 'sales01', salesName: '영업', remark: null, cyberUrl: null, cyberEnabled: true },
  managedCompanies: [{ idx: 5, companyCode: '1234567890', companyName: '관리기업', regDate: '2026-10-02 00:00:00' }],
  enrollments: [{ studySeq: 849, lectureCode: 'ARC2026', courseName: 'HRD 아카이브 2026', serviceType: 'A', serviceTypeLabel: '패키지', companyCode: '1234567890', companyName: '테스트기업', depart: '교육팀', memberName: '홍길동', packageYN: 'Y', period: { start: '2026-10-01', end: '2026-12-31' }, termeIdx: 1, storedProgress: 0, seconds: 27000, formatted: '7:30:00', percent: 50, over15h: false, passOk: false, passOkRaw: 'N', studyEnd: false, studyEndInPeriod: false, inputDate: null, tutor: null, tutorName: '강사', certCount: 2 }],
  loginHistory: [{ idx: 1, device: 'PC', ip: '1.2.3.4', userAgent: 'Chrome', uaLabel: 'Chrome · Windows', at: '2026-10-12 09:00:00' }], loginTotal: 1,
  identity: { certCount: 1, certSuccess: 1, lastCertAt: '2026-10-12' },
  certHistory: [{ seq: 1, lectureCode: 'ARC2026', courseName: 'HRD 아카이브 2026', studySeq: 849, certDate: '2026-10-12', certType: 'otp', result: 'T', ip: null, at: '2026-10-12 09:01:00' }],
  counselPhone: [{ idx: 3, category: 'B', categoryLabel: '시스템 문의', name: '상담원', contents: '로그인 문의', regDate: '2026-10-03 00:00:00', status: 'A', statusLabel: '처리중' }],
  inquiries: [{ idx: 4, category: 'A', categoryLabel: '학습 내용 문의', name: '홍길동', title: '질문있어요', regDate: '2026-10-04 00:00:00', status: 'B', statusLabel: '완료' }],
};
const staged = { items: [{ no: 1, idx: 900001, lectureCode: 'NOPE', tutor: '', name: '엑셀', resNo: '990101-1******', mobile: null, email: null, companyCode: '1234567890', depart: null, lectureStart: '2026-11-01', lectureEnd: '2026-11-30', reStudy: '2026-12-07', serviceType: 'A', serviceTypeLabel: '패키지', userId: '', userIdLabel: '자동 설정', pwd: '1111', nwIno: null, trneeSe: '007', trneeSeLabel: '자사근로자', irglbrSe: '000', irglbrSeLabel: '비정규직해당없음', openChapter: '1', salesId: 'sales01', eduManager: 'N', status: 'error', errors: ['과정코드 [NOPE]를 찾을 수 없습니다.'], errorCells: ['LectureCode'], studyOverlap: false, regDate: null }], total: 1, errorCount: 1 };

const calls: { url: string; method: string; body: unknown }[] = [];
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.endsWith('/auth/admin/refresh')) return json({ accessToken: 'adm', expiresIn: 900, admin });
    if (url.endsWith('/auth/admin/me')) return json(admin);
    if (url.endsWith('/auth/refresh')) return json({ error: { code: 'SESSION_EXPIRED', message: 'x' } }, 401);
    if (url.endsWith('/admin/members/user01/reveal')) return json({ field: 'Mobile', label: '휴대폰', value: '010-2222-3333' });
    if (url.endsWith('/admin/members/user01')) return json(detail);
    if (url.endsWith('/admin/enrollments/staged')) return json(staged);
    if (url.endsWith('/admin/enrollments/options')) return json({ courses: [], tutors: [], sales: [], serviceTypes: [{ value: 'A', label: '패키지' }], progress: [0, 50, 80, 100] });
    if (url.includes('/admin/studies')) return json({ items: [], page: 1, size: 10, total: 0 });
    if (url.endsWith('/public/design')) return json({ error: { code: 'NOT_FOUND', message: 'x' } }, 404);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}
const mount = (path: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const memory = createMemoryRouter(router.routes, { initialEntries: [path] });
  return render(<QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><RouterProvider router={memory} /></MotionConfig></QueryClientProvider>);
};

describe('수강생 관리 parity', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); tokenStore.clear(); adminTokenStore.clear(); calls.length = 0; });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('member_read.php sections in order, masked contacts revealed only after a logged reason', async () => {
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/members/user01');
    expect(await screen.findByRole('heading', { level: 1, name: '수강생 상세 내용' })).toBeInTheDocument();
    expect(await screen.findByText('소속 정보')).toBeInTheDocument();
    for (const t of [ '로그인 내역', '본인인증 내역', '교육담당자 관리 업체', '전화상담 내역', '1:1 문의 내역', '수강 내역']) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getByText('우선지원대상')).toBeInTheDocument();
    expect(screen.getByText('관리기업')).toBeInTheDocument();
    expect(screen.getByText('Chrome · Windows')).toBeInTheDocument();
    expect(screen.getByText('질문있어요')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('미마감')).toBeInTheDocument();
    // 진도 로그: each 수강 내역 row links to the enrollment page's 학습 내역 block; 학습내역 엑셀 is a real export (no PHP link)
    const logLink = screen.getByRole('link', { name: '보기' });
    expect(logLink.getAttribute('href')).toMatch(/^\/admin\/studies\/\d+#learning$/);
    expect(screen.getByRole('button', { name: '학습내역 엑셀 출력' })).toBeEnabled();
    expect(document.body.innerHTML).not.toContain('hrd_manager/');
    for (const b of ['정보 수정', '비밀번호 초기화', '회원 탈퇴처리', '회원 미사용처리', '회원 데이터 삭제']) expect(screen.getByRole('button', { name: b })).toBeEnabled();
    expect(screen.getByRole('button', { name: '회원으로 로그인' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '010-****-3333' }));
    expect(await screen.findByText('개인정보 열람사유 작성')).toBeInTheDocument();
    fireEvent.change(document.getElementById('pr-reason')!, { target: { value: '상담 <확인>' } });
    fireEvent.click(screen.getByRole('button', { name: '등록 하기' }));
    expect(await screen.findByText('사유에는 한글, 영문, 숫자, 공백만 입력 가능합니다.')).toBeInTheDocument();
    fireEvent.change(document.getElementById('pr-reason')!, { target: { value: '상담 확인' } });
    fireEvent.click(screen.getByRole('button', { name: '등록 하기' }));
    expect(await screen.findByText('010-2222-3333')).toBeInTheDocument();
    const rv = calls.find((c) => c.url.endsWith('/reveal'))!;
    expect(rv.method).toBe('POST');
    expect(rv.body).toEqual({ field: 'Mobile', gubun: '학습자 관리', reason: '상담 확인', url: '/admin/members/user01' });
  });

  it('lecture_reg.php shows the uploaded-row list with the row errors and blocks 수강 등록하기 while errors exist', async () => {
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/enrollments/new');
    expect(await screen.findByText('수강등록 엑셀파일로 등록')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('- 과정코드 [NOPE]를 찾을 수 없습니다.')).toBeInTheDocument());
    expect(screen.getByText('990101-1******')).toBeInTheDocument();
    expect(screen.getByText(/오류 건수가 \[ 1 \]건이 있습니다/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '수강 등록하기' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /선택항목 삭제/ })).toBeDisabled();
  });

  it('주민번호 checksum and member_write.php validation', () => {
    expect(residentNoValid('820304', '1172917')).toBe(false);
    expect(residentNoValid('900101', '1234568')).toBe(true);
    expect(residentNoValid('9001', '1234568')).toBe(false);
    const base = { ID: 'abcd1', Pwd: '1111', Name: '홍', ResNo: '900101-1234568', checkResNo: true, Gender: '', Email: '', Tel: ['', '', ''] as [string, string, string], Mobile: ['010', '1234', '5678'] as [string, string, string], Zipcode: '', Address01: '', Address02: '', NameEng: '', CompanyCode: '', CompanyName: '', Depart: '', Position: '', Etc01: [], Etc02: [], Mailling: true, ACS: true, EduManager: false, UseYN: 'Y' as const, Marketing: 'N', recomId: null };
    expect(validateMemberForm(base, 'new')).toEqual({});
    expect(Object.keys(validateMemberForm({ ...base, ID: 'a!', ResNo: '900101-1234567', Email: 'a@b', Mobile: ['010', '', '1'] }, 'new')).sort()).toEqual(['Email', 'ID', 'Mobile', 'ResNo']);
    expect(validateMemberForm({ ...base, ResNo: '' }, 'edit')).toEqual({});
  });
});
