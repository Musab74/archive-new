import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import { buildEnrollTemplateCsv, ENROLL_KEYS, mapEnrollRows, maskResNo, parseDelimited } from '../features/admin/pages/ruby-ops/enrollmentImport';
import { studyIpUrl } from '../features/admin/pages/ruby-ops/IpMonitoringPage';
import IpMonitoringPage from '../features/admin/pages/ruby-ops/IpMonitoringPage';
import RubyTicketsPage from '../features/admin/pages/ruby-ops/RubyTicketsPage';
import EnrollmentImportPage from '../features/admin/pages/ruby-ops/EnrollmentImportPage';

describe('enrollmentImport helpers', () => {
  it('maps the Korean header row (legacy A..U labels, loose spelling) and keeps empty cells null', () => {
    const m = mapEnrollRows([['강의코드', '과정명', '성명', '주민번호', '사업자 번호', '수강 시작일', '수강 종료일', '서비스 구분', '엉뚱한열'], ['ARC2026', '2026 아카이브', '홍길동', '900101-1234567', '123-45-67890', '2026-03-01', '2026-05-31', 'A', 'x']]);
    expect(m.headerDetected).toBe(true);
    expect(m.unknownHeaders).toEqual(['엉뚱한열']);
    expect(m.rows[0]).toMatchObject({ LectureCode: 'ARC2026', ContentsName: '2026 아카이브', Name: '홍길동', ResNo: '900101-1234567', CompanyCode: '123-45-67890', LectureStart: '2026-03-01', LectureEnd: '2026-05-31', ServiceType: 'A', Tutor: null, UserID: null });
  });
  it('falls back to the A..U order without a header', () => {
    const cells = Array.from({ length: ENROLL_KEYS.length }, (_, i) => `v${i}`);
    const m = mapEnrollRows([cells]);
    expect(m.headerDetected).toBe(false);
    expect(m.rows[0]).toMatchObject({ LectureCode: 'v0', ContentsName: 'v1', Tutor: 'v2', Name: 'v3', ResNo: 'v4', EduManager: 'v20' });
  });
  it('parses Excel clipboard TSV, builds the template, masks resident numbers', () => {
    expect(parseDelimited('강의코드\t성명\r\nARC2026\t홍길동\r\n')).toEqual([['강의코드', '성명'], ['ARC2026', '홍길동']]);
    const t = buildEnrollTemplateCsv(true);
    expect(t.replace('﻿', '').split('\r\n')[0]!.split(',')).toHaveLength(ENROLL_KEYS.length);
    expect(t.split('\r\n').filter(Boolean)).toHaveLength(2);
    expect(maskResNo('900101-1234567')).toBe('900101-1******');
    expect(maskResNo('')).toBe('');
  });
  it('studyIpUrl points at the legacy study_ip.php with ID and ip_addr', () => {
    expect(studyIpUrl('user01', '10.1.1.1')).toMatch(/\/study_ip\.php\?ID=user01&ip_addr=10\.1\.1\.1$/);
    expect(studyIpUrl('user01', '')).toMatch(/\/study_ip\.php\?ID=user01$/);
  });
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const session: AdminSessionState = { phase: 'authed', isAuthed: true, canWrite: true, secondsLeft: 900, admin: { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['A', 'B', 'F'], subGrants: ['A3', 'B1', 'F2'], canWrite: true } as AdminSessionState['admin'], login: async () => { throw new Error('x'); }, logout: async () => {}, extend: async () => true };
const summary = { from: '2026-10-08', to: '2026-10-14', days: 7, counts: { CRIT: 0, HIGH: 2, MED: 1, LOW: 3 }, severityLabels: { CRIT: '긴급', HIGH: '주의', MED: '의심', LOW: '참고' }, companies: [{ code: '1234567890', name: '테스트기업', count: 2 }], issueTypes: [{ code: 'IP_CROSS_COMPANY', label: '② 동일 IP에서 다수 사업장 훈련생이 학습한 경우', severity: 'HIGH', severityLabel: '주의', explain: '설명' }] };
const queue = { from: '2026-10-08', to: '2026-10-14', days: 7, sort: 'severity', limit: 100, items: [{ idx: 1, detectDate: '2026-10-13', detectedAt: '2026-10-13 01:00:00', severity: 'HIGH', severityLabel: '주의', issueCode: 'IP_CROSS_COMPANY', issueLabel: '② 동일 IP에서 다수 사업장 훈련생이 학습한 경우', ip: '10.1.1.1', company: { code: '1234567890', name: '테스트기업', label: '테스트기업' }, id: 'user01', studySeq: 7, lectureCode: 'ARC2026', sample: '같은 IP 10.1.1.1 에서 3명', clarificationKey: 'FRAUD_POST', status: 'new', statusNote: null, statusBy: null, statusAt: null, source: 'dashboard_scan', metric: { StudyIP: '10.1.1.1' } }] };
const tickets = { items: [{ id: 5, sessionId: 's1', userId: null, userName: null, contactName: '홍길동', contactPhone: '010-0000-0000', userMessage: '환급 문의', similarityScore: 0.1234, modelConfidence: 0.5, status: 'new', assignedTo: null, resolvedNote: null, createdAt: '2026-10-13 10:00:00', updatedAt: '2026-10-13 10:00:00' }], page: 1, size: 20, total: 1, byStatus: [{ status: 'new', count: 1 }] };
const dryRun = { mode: 'dryRun', summary: { total: 2, enroll: 1, newMembers: 1, updateMembers: 0, newTerms: 1, error: 1, skip: 0 }, rows: [
  { line: 1, action: 'enroll', userId: 't003900101', name: '홍길동', memberAction: 'create', generatedId: true, lectureCode: 'ARC2026', courseName: '2026 아카이브', companyCode: '1234567890', companyName: '테스트기업', lectureStart: '2026-03-01', lectureEnd: '2026-05-31', serviceType: 'A', openChapter: 1, salesId: 'sales01', termAction: 'create', termeIdx: null, errors: [] },
  { line: 2, action: 'error', userId: 'sleep01', name: '휴면', memberAction: 'blocked', generatedId: false, lectureCode: 'ARC2026', courseName: '2026 아카이브', companyCode: '1234567890', companyName: '테스트기업', lectureStart: '2026-03-01', lectureEnd: '2026-05-31', serviceType: 'A', openChapter: 1, salesId: 'sales01', termAction: 'create', termeIdx: null, errors: ['[계정상태] 미사용/탈퇴/휴면 회원은 수정·수강등록하지 않습니다.'] },
], applied: null };

function apiMock(posted: unknown[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/admin/monitoring/ip/summary')) return json(summary);
    if (url.includes('/admin/monitoring/ip/queue')) return json(queue);
    if (url.includes('/admin/ruby/tickets')) return json(tickets);
    if (url.endsWith('/admin/enrollments/import')) { posted.push(JSON.parse(String(init?.body))); return json(dryRun); }
    return json({ error: { code: 'NOT_FOUND', message: url } }, 404);
  });
}
const mount = (ui: React.ReactNode, path = '/') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><ToastProvider><AdminSessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></AdminSessionContext.Provider></ToastProvider></MotionConfig></QueryClientProvider>);
};

describe('ruby-ops pages', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('IP 모니터링 renders the severity tiles, the legacy columns and the IP조회 link', async () => {
    vi.stubGlobal('fetch', apiMock([]));
    mount(<IpMonitoringPage />);
    expect(await screen.findByRole('heading', { level: 1, name: 'IP 모니터링' })).toBeInTheDocument();
    expect(await screen.findByText('같은 IP 10.1.1.1 에서 3명')).toBeInTheDocument();
    for (const h of ['일자', '등급', '유형', '사업장', '수강생', '과정', '내용', 'IP조회']) expect(screen.getAllByRole('columnheader', { name: h }).length).toBeGreaterThan(0); // the rules table repeats 유형/등급
    expect(screen.getByRole('link', { name: 'IP조회' })).toHaveAttribute('href', expect.stringContaining('study_ip.php?ID=user01&ip_addr=10.1.1.1'));
    expect(screen.getByRole('link', { name: 'user01' })).toHaveAttribute('href', '/admin/members/user01');
  });

  it('Ruby 지원티켓 renders the PHP columns and the per-row status control', async () => {
    vi.stubGlobal('fetch', apiMock([]));
    mount(<RubyTicketsPage />);
    expect(await screen.findByText('환급 문의')).toBeInTheDocument();
    for (const h of ['ID', '상태', '이름', '연락처', '문의', '유사도', '신뢰도', '생성일', '처리']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByText('0.1234')).toBeInTheDocument();
  });

  it('엑셀 일괄 수강등록: pasted rows are posted as dryRun and the plan is rendered', async () => {
    const posted: any[] = [];
    vi.stubGlobal('fetch', apiMock(posted));
    const { getByLabelText, getByRole } = mount(<EnrollmentImportPage />);
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(getByLabelText('붙여넣기'), { target: { value: '강의코드\t성명\t주민번호\t사업자번호\t수강시작일\t수강종료일\nARC2026\t홍길동\t900101-1234567\t1234567890\t2026-03-01\t2026-05-31\nARC2026\t휴면\t\t1234567890\t2026-03-01\t2026-05-31' } });
    fireEvent.click(getByRole('button', { name: '검증하기' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].mode).toBe('dryRun');
    expect(posted[0].rows[0]).toMatchObject({ LectureCode: 'ARC2026', Name: '홍길동', ResNo: '900101-1234567', CompanyCode: '1234567890', LectureStart: '2026-03-01', Tutor: null });
    expect(await screen.findByText('t003900101')).toBeInTheDocument();
    expect(screen.getByText(/\[계정상태\]/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '등록 실행' })).toBeDisabled(); // an error row exists and skipInvalid is off
    fireEvent.click(getByLabelText('오류 행은 제외하고 등록'));
    expect(screen.getByRole('button', { name: '등록 실행' })).toBeEnabled();
  });
});
