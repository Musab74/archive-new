import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { EnrollmentResult, StudyRow } from '../../../../shared/api/schemas';
import { AButton, AdminPage, AInput, ASelect, Callout, Card, ConfirmDialog, DataTable, DateField, FieldRow, type Column } from '../../../../shared/ui/admin';
import { adminMembersParityApi } from '../../../../shared/api/endpoints/admin-members-parity';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm, studyTime } from '../../strings';
import { StagedUploadList } from './members-parity-staged';

const plusDays = (ymd: string, n: number) => { if (!ymd) return ''; const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
type Form = { lectureStart: string; lectureEnd: string; lectureCode: string; userId: string; tutor: string; serviceType: 'A' | 'W'; progress: string; openChapter: string; salesId: string; nwIno: string };
const empty: Form = { lectureStart: '', lectureEnd: '', lectureCode: '', userId: '', tutor: '', serviceType: 'A', progress: '0', openChapter: '1', salesId: '', nwIno: '' };

/** lecture_reg.php — register one learner on a package course term (same checks and writes as lecture_reg_script.php). */
export default function EnrollmentRegisterPage() {
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const opts = useQuery({ queryKey: ['admin', 'enrollments', 'options', 'parity'], queryFn: ({ signal }) => adminMembersParityApi.enrollmentOptions(signal), staleTime: 5 * 60_000 });
  const [f, setF] = useState<Form>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [memberQ, setMemberQ] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const members = useQuery({ queryKey: ['admin', 'enrollments', 'members', 'parity', memberSearch], queryFn: ({ signal }) => adminMembersParityApi.enrollmentMembers(memberSearch, signal), enabled: memberSearch.length > 0 });
  // lecture_reg.php LectureRegIDSearch(): an empty term is refused with an alert.
  const searchMember = () => { const t = memberQ.trim(); if (!t) { setErrors((e) => ({ ...e, userId: tr('수강생 아이디 또는 이름을 입력하세요.', 'Enter a learner ID or name.') })); return; } setErrors((e) => { const { userId: _u, ...rest } = e; return rest; }); setMemberSearch(t); };
  // salesmanager_search.php: SalesName → Name/ID LIKE (empty allowed). Before a search the full list from options is offered.
  const [salesQ, setSalesQ] = useState('');
  const [salesSearch, setSalesSearch] = useState<string | null>(null);
  const sales = useQuery({ queryKey: ['admin', 'enrollments', 'sales', salesSearch], queryFn: ({ signal }) => adminMembersParityApi.enrollmentSales(salesSearch ?? '', signal), enabled: salesSearch !== null });
  const searchSales = () => { setSalesSearch(salesQ.trim()); setF((cur) => ({ ...cur, salesId: '' })); };
  const [confirmStep, setConfirmStep] = useState<'W' | 'register' | null>(null);
  const [results, setResults] = useState<EnrollmentResult[]>([]);
  const recent = useQuery({ queryKey: ['admin', 'studies', { page: 1, size: 10, recent: true }], queryFn: ({ signal }) => adminApi.studies({ page: 1, size: 10 }, signal) });
  const register = useAdminMutation({
    fn: (b: Record<string, unknown>) => adminApi.registerEnrollment(b), invalidate: [['admin', 'studies'], ['admin', 'members']],
    success: (r) => tr(`등록되었습니다. (Study Seq ${r.studySeq}${r.termeCreated ? ', 새 회차 생성' : ''})`, `Registered (Study Seq ${r.studySeq}${r.termeCreated ? ', new term created' : ''}).`),
    onSuccess: (r) => { setResults((x) => [r, ...x].slice(0, 20)); setF((cur) => ({ ...cur, userId: '' })); setMemberQ(''); setMemberSearch(''); },
    onError: (err) => { if (isAppError(err) && Array.isArray(err.details)) { const e: Record<string, string> = {}; for (const d of err.details as { path?: string; message?: string }[]) if (d.path) e[d.path] = d.message ?? ''; setErrors(e); } toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); },
  });
  // lecture_reg.php SubmitOk(): same checks and alert texts, in the same order; 비환급 asks first, then 등록 하시겠습니까?
  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.lectureStart || !f.lectureEnd) { e.lectureStart = tr('수강기간을 선택하세요.', 'Choose the period.'); }
    else if (f.lectureEnd < f.lectureStart) e.lectureEnd = tr('종료일이 시작일보다 빠릅니다.', 'End date is before start date.');
    if (!f.lectureCode) e.lectureCode = tr('과정을 선택하세요.', 'Choose a course.');
    if (!f.userId) e.userId = tr('수강생을 검색하세요.', 'Search for a learner.');
    if (!f.tutor) e.tutor = tr('첨삭강사를 검색하세요.', 'Search for a tutor.');
    if (!f.salesId) e.salesId = tr('영업담당자를 검색하세요.', 'Search for a sales rep.');
    if (f.openChapter === '') e.openChapter = tr('실시회차를 입력하세요.', 'Enter the session number.');
    else if (!/^\d+$/.test(f.openChapter)) e.openChapter = tr('실시회차는 숫자만 입력하세요.', 'Digits only.');
    setErrors(e); if (Object.keys(e).length) return;
    setConfirmStep(f.serviceType === 'W' ? 'W' : 'register');
  };
  const doRegister = () => {
    setConfirmStep(null);
    register.mutate({ lectureStart: f.lectureStart, lectureEnd: f.lectureEnd, lectureCode: f.lectureCode, userId: f.userId, tutor: f.tutor, serviceType: f.serviceType, progress: Number(f.progress), openChapter: Number(f.openChapter), salesId: f.salesId, nwIno: f.nwIno.trim() || null });
  };
  const courseOptions = useMemo(() => (opts.data?.courses ?? []).map((c) => ({ value: c.lectureCode, label: `${c.name} | ${c.lectureCode}` })), [opts.data]);
  const tutorOptions = useMemo(() => (opts.data?.tutors ?? []).map((t) => ({ value: t.id, label: `${t.name ?? t.id} | ${t.id}${t.team ? ` | ${t.team}` : ''}` })), [opts.data]);
  // salesmanager_search.php option: "성명 | 아이디 | 소속 | 휴대폰" (ordered by ID on the API)
  const salesOptions = useMemo(() => (salesSearch !== null ? sales.data?.items ?? [] : opts.data?.sales ?? []).map((t) => ({ value: t.id, label: t.label ?? `${t.name ?? ''} | ${t.id} | ${t.team ?? ''} | ${t.mobile ?? ''}` })), [opts.data, sales.data, salesSearch]);
  const salesPending = salesSearch !== null ? sales.isPending : opts.isPending;
  // lecture_reg_id_search.php option: "이름 | 아이디 | 소속 사업주"
  const memberOptions = useMemo(() => (members.data?.items ?? []).map((m) => ({ value: m.id, label: m.label ?? `${m.name ?? ''} | ${m.id} | ${m.companyName ?? ''}` })), [members.data]);
  const recentCols: Column<StudyRow>[] = [
    { key: 'studySeq', header: 'Seq', align: 'right', render: (r) => <Link to={`/admin/studies/${r.studySeq}`}>{r.studySeq}</Link> },
    { key: 'name', header: tr('수강생', 'Learner'), render: (r) => <span>{r.name ?? ''} <small className="muted">{r.id}</small></span> },
    { key: 'courseName', header: tr('과정', 'Course'), render: (r) => <span title={r.lectureCode}>{r.courseName}</span> },
    { key: 'period', header: tr('수강기간', 'Period'), nowrap: true, render: (r) => `${r.period.start} ~ ${r.period.end}` },
    { key: 'serviceType', header: tr('구분', 'Type'), align: 'center', render: (r) => r.serviceType ?? '' },
    { key: 'formatted', header: tr('학습시간', 'Study time'), align: 'right', render: (r) => studyTime(r.seconds, r.formatted) },
    { key: 'inputDate', header: tr('등록일', 'Registered'), nowrap: true, render: (r) => r.inputDate ?? '' },
  ];
  return (
    <AdminPage title={tr('수강 등록', 'Register enrollment')} lead={tr('기존 수강 등록과 같은 규칙으로 등록합니다: 회차를 찾거나 새로 만들고, 같은 과정·기간이 겹치면 거부합니다. 복습 기간은 종료일 + 7일.', 'Same rules as the legacy screen: finds or creates the term and rejects overlapping enrollments. Review period = end date + 7 days.')}>
      {!canWrite ? <Callout tone="warn" className="u-mb-8">{adm.readOnly}</Callout> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap: 14, alignItems: 'start' }}>
        <Card title={tr('등록 정보', 'Enrollment')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FieldRow label={tr('수강 기간', 'Period')} required error={errors.lectureStart || errors.lectureEnd}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><DateField aria-label={tr('시작일', 'Start')} value={f.lectureStart} onChange={(v) => setF({ ...f, lectureStart: v })} /> ~ <DateField aria-label={tr('종료일', 'End')} value={f.lectureEnd} onChange={(v) => setF({ ...f, lectureEnd: v })} min={f.lectureStart || undefined} /></div></FieldRow>
            <FieldRow label={tr('복습 기간', 'Review period')}><div style={{ paddingTop: 8, fontSize: 13 }}>{f.lectureEnd ? `${plusDays(f.lectureEnd, 1)} ~ ${plusDays(f.lectureEnd, 7)}` : '—'}</div></FieldRow>
            <FieldRow label={tr('과정 선택', 'Course')} htmlFor="er-course" required error={errors.lectureCode}><ASelect id="er-course" value={f.lectureCode} onChange={(e) => setF({ ...f, lectureCode: e.target.value })} options={courseOptions} placeholder={tr('-- 과정 선택 --', '-- choose --')} loading={opts.isPending} /></FieldRow>
            <FieldRow label={tr('비용수급사업장', 'nwIno')} htmlFor="er-nwino" help={tr('입력하면 회원정보의 비용수급사업장에 저장됩니다.', 'Saved on the member record when given.')}><AInput id="er-nwino" value={f.nwIno} onChange={(e) => setF({ ...f, nwIno: e.target.value })} maxLength={50} /></FieldRow>
            <FieldRow label={tr('수강생', 'Learner')} htmlFor="er-member" required error={errors.userId}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6 }}><AInput aria-label={tr('수강생 검색', 'Search learner')} placeholder={tr('아이디 또는 이름', 'ID or name')} value={memberQ} onChange={(e) => setMemberQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchMember(); } }} /><AButton onClick={searchMember}>{adm.common.search}</AButton></div>
                <ASelect id="er-member" value={f.userId} onChange={(e) => setF({ ...f, userId: e.target.value })} options={memberOptions} placeholder={memberSearch ? (members.isPending ? adm.common.loading : memberOptions.length ? tr(`-- 수강생 선택 (${(members.data?.total ?? memberOptions.length).toLocaleString()}명 검색됨) --`, `-- choose (${memberOptions.length} found) --`) : tr('검색된 수강생이 없습니다.', 'No learners found.')) : tr('-- 먼저 검색하세요 --', '-- search first --')} />
                {members.data?.truncated ? <small className="muted">{tr(`검색 결과가 많아 앞의 ${memberOptions.length.toLocaleString()}명만 보입니다. 검색어를 더 입력하세요.`, `Only the first ${memberOptions.length} are shown; refine the search.`)}</small> : null}
              </div>
            </FieldRow>
            <FieldRow label={tr('첨삭 강사', 'Tutor')} htmlFor="er-tutor" required error={errors.tutor}><ASelect id="er-tutor" value={f.tutor} onChange={(e) => setF({ ...f, tutor: e.target.value })} options={tutorOptions} placeholder={tr('-- 첨삭강사 선택 --', '-- choose a tutor --')} loading={opts.isPending} /></FieldRow>
            <FieldRow label={tr('영업 담당자', 'Sales rep')} htmlFor="er-sales" required error={errors.salesId}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6 }}><AInput id="er-sales-q" aria-label={tr('영업 담당자 이름 또는 아이디', 'Sales rep name or ID')} placeholder={tr('이름 또는 아이디', 'Name or ID')} value={salesQ} maxLength={50} onChange={(e) => setSalesQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchSales(); } }} /><AButton aria-label={tr('영업 담당자 검색', 'Search sales reps')} onClick={searchSales}>{adm.common.search}</AButton></div>
                {!salesPending && salesSearch !== null && !salesOptions.length
                  ? <span id="er-sales" style={{ fontSize: 13 }}>{tr('[ 검색된 영업담당자가 없습니다. ]', '[ No sales reps found. ]')}</span>
                  : <ASelect id="er-sales" value={f.salesId} onChange={(e) => setF({ ...f, salesId: e.target.value })} options={salesOptions} placeholder={tr(`-- ${salesOptions.length}건이 검색되었습니다. 영업담당자를 선택하세요. --`, `-- ${salesOptions.length} found, choose a sales rep --`)} loading={salesPending} />}
              </div>
            </FieldRow>
            <FieldRow label={tr('진도율', 'Initial progress')} htmlFor="er-prog"><ASelect id="er-prog" value={f.progress} onChange={(e) => setF({ ...f, progress: e.target.value })} options={(opts.data?.progress ?? [0, 50, 80, 100]).map((n) => ({ value: String(n), label: `${n}%` }))} /></FieldRow>
            <FieldRow label={tr('개설 용도', 'Service type')} htmlFor="er-type"><ASelect id="er-type" value={f.serviceType} onChange={(e) => setF({ ...f, serviceType: e.target.value as 'A' | 'W' })} options={opts.data?.serviceTypes ?? [{ value: 'A', label: '패키지' }, { value: 'W', label: '비환급' }]} /></FieldRow>
            <FieldRow label={tr('실시 회차', 'Session no.')} htmlFor="er-oc" required error={errors.openChapter}><AInput id="er-oc" style={{ width: 120 }} inputMode="numeric" maxLength={3} value={f.openChapter} onChange={(e) => setF({ ...f, openChapter: e.target.value.trim() })} /></FieldRow>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><AButton onClick={() => { setF(empty); setErrors({}); setMemberQ(''); setMemberSearch(''); setSalesQ(''); setSalesSearch(null); }}>{tr('다시 작성', 'Reset')}</AButton><AButton variant="primary" loading={register.isPending} disabled={!canWrite} title={readOnlyTitle} onClick={submit}>{register.isPending ? tr('처리중입니다...', 'Working…') : tr('등록 하기', 'Register')}</AButton></div>
          </div>
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {results.length ? <Card title={tr('이번에 등록한 내역', 'Registered now')}><ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>{results.map((r) => <li key={r.studySeq}><Link to={`/admin/studies/${r.studySeq}`}>Seq {r.studySeq}</Link> · {r.member.name} ({r.member.id}) · {r.course.name} · {tr('복습', 'review')} ~{r.reStudyUntil}{r.termeCreated ? ` · ${tr('새 회차', 'new term')} #${r.termeIdx}` : ''}</li>)}</ul></Card> : null}
          <Card title={tr('최근 등록된 수강 (Study 최신 10건)', 'Latest 10 enrollments')} aside={<Link to="/admin/studies" style={{ fontSize: 12 }}>{tr('학습관리 전체 보기 →', 'Open 학습관리 →')}</Link>}>
            <DataTable columns={recentCols} rows={recent.data?.items} rowKey={(r) => r.studySeq} loading={recent.isPending} error={recent.error} onRetry={() => void recent.refetch()} dense />
          </Card>
          <Callout>{tr('여러 명을 한 번에 등록하려면 ', 'To register many learners at once use ')}<Link to="/admin/enrollments/import">{tr('엑셀 일괄 수강등록', 'Bulk enrolment (Excel)')}</Link>{tr(' 화면을 사용하세요 (회원 생성 포함).', ' (it also creates missing member accounts).')}</Callout>
        </div>
      </div>
      <div style={{ marginTop: 14 }}><StagedUploadList /></div>
      <ConfirmDialog open={confirmStep === 'W'} title={tr('개설 용도 확인', 'Service type')} body={<p>{tr('개설용도가 비환급으로 설정되어 있습니다.', 'The service type is set to 비환급 (non-refund).')}<br />{tr('맞습니까?', 'Is that right?')}</p>} onCancel={() => setConfirmStep(null)} onConfirm={() => setConfirmStep('register')} />
      <ConfirmDialog open={confirmStep === 'register'} tone="info" title={tr('수강 등록', 'Register enrollment')} body={<p>{tr('등록 하시겠습니까?', 'Register this enrollment?')}</p>} loading={register.isPending} onCancel={() => setConfirmStep(null)} onConfirm={doRegister} />
    </AdminPage>
  );
}
