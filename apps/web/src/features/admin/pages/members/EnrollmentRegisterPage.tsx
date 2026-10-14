import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { EnrollmentResult, StudyRow } from '../../../../shared/api/schemas';
import { AButton, AdminPage, AInput, ASelect, Callout, Card, DataTable, DateField, FieldRow, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm, studyTime } from '../../strings';

const plusDays = (ymd: string, n: number) => { if (!ymd) return ''; const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
type Form = { lectureStart: string; lectureEnd: string; lectureCode: string; userId: string; tutor: string; serviceType: 'A' | 'W'; progress: string; openChapter: string; salesId: string; nwIno: string };
const empty: Form = { lectureStart: '', lectureEnd: '', lectureCode: '', userId: '', tutor: '', serviceType: 'A', progress: '0', openChapter: '1', salesId: '', nwIno: '' };

/** lecture_reg.php — register one learner on a package course term (same checks and writes as lecture_reg_script.php). */
export default function EnrollmentRegisterPage() {
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const opts = useQuery({ queryKey: ['admin', 'enrollments', 'options'], queryFn: ({ signal }) => adminApi.enrollmentOptions(signal), staleTime: 5 * 60_000 });
  const [f, setF] = useState<Form>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [memberQ, setMemberQ] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const members = useQuery({ queryKey: ['admin', 'enrollments', 'members', memberSearch], queryFn: ({ signal }) => adminApi.enrollmentMembers(memberSearch, signal), enabled: memberSearch.length > 0 });
  const [results, setResults] = useState<EnrollmentResult[]>([]);
  const recent = useQuery({ queryKey: ['admin', 'studies', { page: 1, size: 10, recent: true }], queryFn: ({ signal }) => adminApi.studies({ page: 1, size: 10 }, signal) });
  const register = useAdminMutation({
    fn: (b: Record<string, unknown>) => adminApi.registerEnrollment(b), invalidate: [['admin', 'studies'], ['admin', 'members']],
    success: (r) => tr(`등록되었습니다. (Study Seq ${r.studySeq}${r.termeCreated ? ', 새 회차 생성' : ''})`, `Registered (Study Seq ${r.studySeq}${r.termeCreated ? ', new term created' : ''}).`),
    onSuccess: (r) => { setResults((x) => [r, ...x].slice(0, 20)); setF((cur) => ({ ...cur, userId: '' })); setMemberQ(''); setMemberSearch(''); },
    onError: (err) => { if (isAppError(err) && Array.isArray(err.details)) { const e: Record<string, string> = {}; for (const d of err.details as { path?: string; message?: string }[]) if (d.path) e[d.path] = d.message ?? ''; setErrors(e); } toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); },
  });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.lectureStart) e.lectureStart = tr('수강 시작일을 선택하세요.', 'Choose a start date.');
    if (!f.lectureEnd) e.lectureEnd = tr('수강 종료일을 선택하세요.', 'Choose an end date.');
    if (f.lectureStart && f.lectureEnd && f.lectureEnd < f.lectureStart) e.lectureEnd = tr('종료일이 시작일보다 빠릅니다.', 'End date is before start date.');
    if (!f.lectureCode) e.lectureCode = tr('과정을 선택하세요.', 'Choose a course.');
    if (!f.userId) e.userId = tr('수강생을 선택하세요.', 'Choose a learner.');
    if (!/^\d+$/.test(f.openChapter) || Number(f.openChapter) < 1) e.openChapter = tr('1 이상의 숫자', 'A number ≥ 1');
    setErrors(e); if (Object.keys(e).length) return;
    register.mutate({ lectureStart: f.lectureStart, lectureEnd: f.lectureEnd, lectureCode: f.lectureCode, userId: f.userId, tutor: f.tutor || null, serviceType: f.serviceType, progress: Number(f.progress), openChapter: Number(f.openChapter), salesId: f.salesId || null, nwIno: f.nwIno.trim() || null });
  };
  const courseOptions = useMemo(() => (opts.data?.courses ?? []).map((c) => ({ value: c.lectureCode, label: `${c.name} | ${c.lectureCode}` })), [opts.data]);
  const tutorOptions = useMemo(() => (opts.data?.tutors ?? []).map((t) => ({ value: t.id, label: `${t.name ?? t.id} | ${t.id}${t.team ? ` | ${t.team}` : ''}` })), [opts.data]);
  const salesOptions = useMemo(() => (opts.data?.sales ?? []).map((t) => ({ value: t.id, label: `${t.name ?? t.id} | ${t.id}${t.team ? ` | ${t.team}` : ''}` })), [opts.data]);
  const memberOptions = useMemo(() => (members.data?.items ?? []).map((m) => ({ value: m.id, label: `${m.name ?? ''} | ${m.id} | ${m.companyName ?? m.companyCode ?? ''}` })), [members.data]);
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
                <div style={{ display: 'flex', gap: 6 }}><AInput aria-label={tr('수강생 검색', 'Search learner')} placeholder={tr('아이디 또는 이름', 'ID or name')} value={memberQ} onChange={(e) => setMemberQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setMemberSearch(memberQ.trim()); } }} /><AButton onClick={() => setMemberSearch(memberQ.trim())} disabled={!memberQ.trim()}>{adm.common.search}</AButton></div>
                <ASelect id="er-member" value={f.userId} onChange={(e) => setF({ ...f, userId: e.target.value })} options={memberOptions} placeholder={memberSearch ? (members.isPending ? adm.common.loading : memberOptions.length ? tr(`-- ${memberOptions.length}명 검색됨, 선택하세요 --`, `-- ${memberOptions.length} found, choose --`) : tr('검색된 수강생이 없습니다.', 'No learners found.')) : tr('-- 먼저 검색하세요 --', '-- search first --')} />
              </div>
            </FieldRow>
            <FieldRow label={tr('첨삭 강사', 'Tutor')} htmlFor="er-tutor"><ASelect id="er-tutor" value={f.tutor} onChange={(e) => setF({ ...f, tutor: e.target.value })} options={tutorOptions} placeholder={tr('-- 선택 안 함 --', '-- none --')} /></FieldRow>
            <FieldRow label={tr('영업 담당자', 'Sales rep')} htmlFor="er-sales"><ASelect id="er-sales" value={f.salesId} onChange={(e) => setF({ ...f, salesId: e.target.value })} options={salesOptions} placeholder={tr('-- 선택 안 함 --', '-- none --')} /></FieldRow>
            <FieldRow label={tr('진도율', 'Initial progress')} htmlFor="er-prog"><ASelect id="er-prog" value={f.progress} onChange={(e) => setF({ ...f, progress: e.target.value })} options={(opts.data?.progress ?? [0, 50, 80, 100]).map((n) => ({ value: String(n), label: `${n}%` }))} /></FieldRow>
            <FieldRow label={tr('개설 용도', 'Service type')} htmlFor="er-type"><ASelect id="er-type" value={f.serviceType} onChange={(e) => setF({ ...f, serviceType: e.target.value as 'A' | 'W' })} options={opts.data?.serviceTypes ?? [{ value: 'A', label: '패키지' }, { value: 'W', label: '비환급' }]} /></FieldRow>
            <FieldRow label={tr('실시 회차', 'Session no.')} htmlFor="er-oc" error={errors.openChapter}><AInput id="er-oc" style={{ width: 120 }} inputMode="numeric" value={f.openChapter} onChange={(e) => setF({ ...f, openChapter: e.target.value.replace(/\D/g, '') })} /></FieldRow>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><AButton onClick={() => { setF(empty); setErrors({}); setMemberQ(''); setMemberSearch(''); }}>{tr('다시 작성', 'Reset')}</AButton><AButton variant="primary" loading={register.isPending} disabled={!canWrite} title={readOnlyTitle} onClick={submit}>{tr('등록 하기', 'Register')}</AButton></div>
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
    </AdminPage>
  );
}
