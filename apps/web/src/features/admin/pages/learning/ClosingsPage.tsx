import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminLearningApi, type ClosingRow } from '../../../../shared/api/endpoints/admin-learning';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Callout, ConfirmDialog, DataTable, DateField, FilterBar, FilterField, StatusBadge, toIsoDate, type Column } from '../../../../shared/ui/admin';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { CompanyAutocomplete, SERVICE_TYPE_OPTIONS, legacyAdminHref, legacySiteHref, openLegacy, useLearningOptions, PendingHint } from './learningShared';

const DEFAULTS = { termBasis: 'start', lectureStart: '', lectureEnd: '', companyCode: '', companyName: '', openChapter: '', serviceType: '', endStatus: '', lectureCode: '', page: 1, go: 0 };
const SIZE = 15;
type Form = Omit<typeof DEFAULTS, 'page' | 'go'>;
const pick = (p: typeof DEFAULTS): Form => ({ termBasis: p.termBasis, lectureStart: p.lectureStart, lectureEnd: p.lectureEnd, companyCode: p.companyCode, companyName: p.companyName, openChapter: p.openChapter, serviceType: p.serviceType, endStatus: p.endStatus, lectureCode: p.lectureCode });

/** 빠른검색: this month / last month / last 3 months / this year (개강일 기준). */
function quickTerm(kind: string): { lectureStart: string; lectureEnd: string } | null {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
  const last = (yy: number, mm: number) => new Date(yy, mm + 1, 0);
  if (kind === 'thisMonth') return { lectureStart: toIsoDate(new Date(y, m, 1)), lectureEnd: toIsoDate(last(y, m)) };
  if (kind === 'lastMonth') return { lectureStart: toIsoDate(new Date(y, m - 1, 1)), lectureEnd: toIsoDate(last(y, m - 1)) };
  if (kind === 'last3Month') return { lectureStart: toIsoDate(new Date(y, m - 2, 1)), lectureEnd: toIsoDate(last(y, m)) };
  if (kind === 'thisYear') return { lectureStart: `${y}-01-01`, lectureEnd: `${y}-12-31` };
  return null;
}
const fileParams = (r: ClosingRow) => ({ CompanyCode: r.companyCode, LectureStart: r.lectureStart, LectureEnd: r.lectureEnd, LectureCode: r.lectureCode, ServiceType: r.serviceType === 'A' || r.serviceType === 'W' ? r.serviceType : undefined, OpenChapter: r.openChapter ?? undefined });

/** study_end.php — 수강마감 (B6). */
export default function ClosingsPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState<Form>(pick(p));
  const [quick, setQuick] = useState('');
  const options = useLearningOptions();
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const navigate = useNavigate();
  const query = useMemo(() => ({ termBasis: p.termBasis, lectureStart: p.lectureStart || undefined, lectureEnd: p.lectureEnd || undefined, companyCode: p.companyCode || undefined, companyName: p.companyName || undefined, openChapter: p.openChapter || undefined, serviceType: p.serviceType || undefined, endStatus: p.endStatus || undefined, lectureCode: p.lectureCode || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'learning', 'closings', query], queryFn: ({ signal }) => adminLearningApi.closings(query, signal), placeholderData: keepPreviousData, enabled: p.go === 1 });
  const total = list.data?.total ?? 0; const firstNo = (p.page - 1) * SIZE + 1;
  const inv = [['admin', 'learning', 'closings']];

  const submit = () => {
    if (!form.lectureStart && !form.lectureEnd && !form.companyName && !form.companyCode) { toast(tr('검색 조건을 입력하세요.', 'Enter a search condition.'), { tone: 'danger' }); return; }
    if ((form.lectureStart && !form.lectureEnd) || (!form.lectureStart && form.lectureEnd)) { toast(tr('조회 시작일과 종료일을 모두 선택하세요.', 'Choose both dates.'), { tone: 'danger' }); return; }
    if (form.lectureStart && form.lectureEnd && form.lectureStart > form.lectureEnd) { toast(tr('조회 종료일이 조회 시작일보다 이전입니다.', 'End date is before start date.'), { tone: 'danger' }); return; }
    setP({ ...form, go: 1 }, true);
  };

  const [closing, setClosing] = useState<ClosingRow | null>(null);
  const complete = useAdminMutation({ fn: (r: ClosingRow) => adminLearningApi.completeClosing({ companyCode: r.companyCode, lectureStart: r.lectureStart, lectureEnd: r.lectureEnd }), invalidate: inv, success: (d) => tr(`교육종료 처리가 완료되었습니다. (수강 ${d.studies}건, 마감 ${d.ended}건)`, `Closed ${d.ended} of ${d.studies} enrollments.`), onSuccess: () => setClosing(null) });
  const deposit = useAdminMutation({ fn: (v: { r: ClosingRow; status: 'P' | 'C' }) => adminLearningApi.setDepositStatus({ companyCode: v.r.companyCode, lectureStart: v.r.lectureStart, lectureEnd: v.r.lectureEnd, depositStatus: v.status }), invalidate: inv, success: tr('입금 상태가 저장되었습니다.', 'Deposit status saved.') });
  const [mail, setMail] = useState<{ r: ClosingRow; kind: 'certificate' | 'report' } | null>(null);
  const sendMail = useAdminMutation({
    fn: (v: { r: ClosingRow; kind: 'certificate' | 'report' }) => (v.kind === 'certificate' ? adminLearningApi.sendCertMail(fileParams(v.r)) : adminLearningApi.sendReportMail(fileParams(v.r))).then((res) => ({ ...res })),
    onSuccess: (res) => { setMail(null); toast(res.ok ? tr('발송되었습니다.', 'Sent.') : tr(`메일 발송은 아직 새 콘솔에서 지원되지 않습니다. (수신: ${res.to}) 기존 사이트에서 발송해 주세요.`, `Mail sending is not configured yet (to: ${res.to}). Use the previous site.`), { tone: res.ok ? 'ok' : 'danger' }); },
  });
  const printCert = (r: ClosingRow) => {
    if (!r.certificatePrintOk && !window.confirm(tr('아직 전원 마감되지 않았습니다. 그래도 수료증을 출력하시겠습니까?', 'Not every learner is closed yet. Print anyway?'))) return;
    const q = new URLSearchParams({ kind: 'completion', companyCode: r.companyCode, lectureStart: r.lectureStart, lectureEnd: r.lectureEnd, lectureCode: r.lectureCode, serviceTypeYN: 'N' });
    if (r.serviceType === 'A' || r.serviceType === 'W') q.set('serviceType', r.serviceType);
    if (r.openChapter !== null && r.openChapter !== undefined) q.set('openChapter', String(r.openChapter));
    navigate(`/admin/learning/certificates/print?${q.toString()}`);
  };
  const resultsReport = (r: ClosingRow) => {
    let author = window.prompt(tr('교육결과보고서 작성자 성명을 입력해 주세요.', 'Author name for the results report:'), '');
    if (author === null) return;
    author = author.replace(/[\r\n\t]+/g, ' ').trim();
    if (!author) { toast(tr('작성자 성명을 입력해 주세요.', 'Enter the author name.'), { tone: 'danger' }); return; }
    if (author.length > 30) { toast(tr('작성자 성명은 30자 이내로 입력해 주세요.', 'Author name must be 30 chars or less.'), { tone: 'danger' }); return; }
    openLegacy(legacySiteHref('public/mypage/education_results_report_v2.php', { ...fileParams(r), AuthorName: author }));
  };

  const courseOptions = useMemo(() => [{ value: '', label: tr('-- 과정 전체 --', '-- all courses --') }, ...(options.data?.packageCourses ?? []).map((c) => ({ value: c.lectureCode, label: `${c.name} | ${c.lectureCode}` }))], [options.data]);
  const btn = (label: string, onClick: () => void, extra?: Partial<React.ComponentProps<typeof AButton>>) => <AButton size="xs" onClick={onClick} {...extra}>{label}</AButton>;
  const columns: Column<ClosingRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => firstNo + i },
    { key: 'period', header: tr('수강기간', 'Term'), nowrap: true, render: (r) => `${r.lectureStart} ~ ${r.lectureEnd}` },
    { key: 'openChapter', header: tr('실시회차', 'Round'), align: 'center', render: (r) => r.openChapter ?? '-' },
    { key: 'companyName', header: tr('사업주명', 'Company'), render: (r) => <span title={r.companyCode}>{r.companyName ?? r.companyCode}</span> },
    { key: 'courseName', header: tr('과정명', 'Course'), render: (r) => <span title={r.lectureCode}>{r.courseName}</span> },
    { key: 'serviceTypeLabel', header: tr('환급여부', 'Refund'), align: 'center', nowrap: true },
    { key: 'studyCount', header: tr('수강생', 'Learners'), align: 'center', nowrap: true, render: (r) => tr(`${r.studyCount}명`, String(r.studyCount)) },
    { key: 'status', header: tr('교육종료', 'Closing'), render: (r) => (
      <div style={{ display: 'grid', gap: 4, fontSize: 12.5 }}>
        {r.status === 'N' ? btn(tr('수강마감', 'Close'), () => setClosing(r), { disabled: !canWrite, title: readOnlyTitle ?? tr('해당 기간/사업주의 수강을 StudyEnd=Y로 마감합니다. 메일은 발송되지 않습니다. 취소할 수 없습니다.', 'Sets StudyEnd=Y for this company/term. No mail. Irreversible.') }) : null}
        {r.status === 'P' ? <><StatusBadge tone="danger">{tr(`부분마감 ${r.endedCount}/${r.studyCount}명`, `Partial ${r.endedCount}/${r.studyCount}`)}</StatusBadge>{r.processedBy || r.processedAt ? <span>{tr('처리자', 'By')} : {r.processedBy}<br />{tr('처리일', 'At')} : {r.processedAt}</span> : null}{btn(tr('잔여 수강마감', 'Close remaining'), () => setClosing(r), { disabled: !canWrite, title: readOnlyTitle })}</> : null}
        {r.status === 'Y' ? (r.processedBy || r.processedAt ? <span><StatusBadge tone="ok">{tr('마감완료', 'Closed')}</StatusBadge><br />{tr('처리자', 'By')} : {r.processedBy}<br />{tr('처리일', 'At')} : {r.processedAt}</span> : <span><StatusBadge tone="ok">{tr('마감완료', 'Closed')}</StatusBadge><br /><span className="muted">{tr('(처리이력 없음)', '(no processing record)')}</span></span>) : null}
        {r.status === '-' ? '-' : null}
      </div>) },
    { key: 'deposit', header: tr('수납', 'Payment'), render: (r) => r.courseExists ? (
      <div style={{ display: 'grid', gap: 6 }}>
        {btn(tr('수납 확인서', 'Receipt sheet'), () => openLegacy(legacyAdminHref('receipt_confirm_excel.php', fileParams(r))))}
        {canWrite ? <ASelect aria-label={tr('입금 상태', 'Deposit status')} value={r.depositStatus} onChange={(e) => deposit.mutate({ r, status: e.target.value as 'P' | 'C' })} options={[{ value: 'P', label: tr('입금대기', 'Pending') }, { value: 'C', label: tr('입금완료', 'Paid') }]} /> : <StatusBadge tone={r.depositStatus === 'C' ? 'ok' : 'warn'}>{r.depositStatus === 'C' ? tr('입금완료', 'Paid') : tr('입금대기', 'Pending')}</StatusBadge>}
      </div>) : null },
    { key: 'cert', header: tr('수료증 출력', 'Certificates'), render: (r) => <div style={{ display: 'grid', gap: 4 }}>{btn(tr('수료증', 'Certificates'), () => printCert(r))}{btn(tr('수료증 메일발송', 'E-mail certificates'), () => setMail({ r, kind: 'certificate' }), { disabled: !canWrite, title: readOnlyTitle })}</div> },
    { key: 'report', header: tr('보고서', 'Reports'), render: (r) => r.courseExists ? (
      <div style={{ display: 'grid', gap: 4 }}>
        {btn(tr('훈련진행보고서', 'Progress report'), () => openLegacy(legacySiteHref('public/mypage/training_progress_report.php', fileParams(r))))}
        {btn(tr('훈련진행보고서 메일발송', 'E-mail progress report'), () => setMail({ r, kind: 'report' }), { disabled: !canWrite, title: readOnlyTitle })}
        {btn(tr('교육결과보고서', 'Results report'), () => resultsReport(r))}
        {btn(tr('훈련진행보고서(new)', 'Progress report (new)'), () => openLegacy(legacySiteHref('public/mypage/training_progress_report_v2.php', fileParams(r))), { variant: 'primary' })}
      </div>) : null },
  ];

  return (
    <AdminPage title={tr('수강마감', 'Close enrollments')} lead={tr('마감을 통해 수강생에게 결과를 통보하거나 최종결과를 확정짓습니다. 패키지 과정(PackageYN=Y) 기준, 한 줄 = 수강기간 × 사업주 × 과정.', 'Finalise a term: one row = term × company × course (package courses).')}>
      <Callout tone="info">{tr('수료증·보고서 메일 발송과 수납 확인서/보고서(PHP) 열기는 아직 기존 사이트(hrd_manager)에서 실행됩니다. 새 콘솔의 메일 버튼은 수신자와 템플릿만 확인하고 발송하지 않습니다.', 'E-mail sending and the PHP receipt/report pages still run on the previous site; the mail buttons here only validate the recipient and template.')}</Callout>
      <FilterBar onSubmit={submit} onReset={() => { setForm(pick(DEFAULTS)); setQuick(''); reset(); }}>
        <FilterField label={tr('수강기간 기준', 'Term basis')} htmlFor="cl-basis" width={150}><ASelect id="cl-basis" value={form.termBasis} onChange={(e) => setForm({ ...form, termBasis: e.target.value })} options={[{ value: 'start', label: tr('수강시작일 기준', 'By start date') }, { value: 'end', label: tr('수강종료일 기준', 'By end date') }]} /></FilterField>
        <FilterField label={tr('시작일', 'From')} htmlFor="cl-from"><DateField id="cl-from" value={form.lectureStart} onChange={(v) => { setForm({ ...form, lectureStart: v }); setQuick(''); }} /></FilterField>
        <FilterField label={tr('종료일', 'To')} htmlFor="cl-to"><DateField id="cl-to" value={form.lectureEnd} min={form.lectureStart || undefined} onChange={(v) => { setForm({ ...form, lectureEnd: v }); setQuick(''); }} /></FilterField>
        <FilterField label={tr('빠른검색', 'Quick range')} htmlFor="cl-quick" width={150}><ASelect id="cl-quick" value={quick} onChange={(e) => { setQuick(e.target.value); const r = quickTerm(e.target.value); if (r) setForm({ ...form, ...r, termBasis: 'start' }); }} options={[{ value: '', label: '' }, { value: 'thisMonth', label: tr('이번달 개강', 'Starts this month') }, { value: 'lastMonth', label: tr('지난달 개강', 'Started last month') }, { value: 'last3Month', label: tr('최근 3개월 개강', 'Last 3 months') }, { value: 'thisYear', label: tr('올해 개강', 'This year') }]} /></FilterField>
        <FilterField label={tr('사업주명', 'Company')} htmlFor="cl-co" width={260}><CompanyAutocomplete id="cl-co" name={form.companyName} code={form.companyCode} onPick={(v) => setForm({ ...form, companyName: v.name, companyCode: v.code })} /></FilterField>
        <FilterField label={tr('실시회차', 'Round')} htmlFor="cl-oc" width={100}><AInput id="cl-oc" value={form.openChapter} inputMode="numeric" onChange={(e) => setForm({ ...form, openChapter: e.target.value.replace(/\D/g, '') })} /></FilterField>
        <FilterField label={tr('환급여부', 'Refund')} htmlFor="cl-st" width={150}><ASelect id="cl-st" value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} options={SERVICE_TYPE_OPTIONS} /></FilterField>
        <FilterField label={tr('수강마감 여부', 'Closing status')} htmlFor="cl-es" width={140}><ASelect id="cl-es" value={form.endStatus} onChange={(e) => setForm({ ...form, endStatus: e.target.value })} options={[{ value: '', label: adm.common.all }, { value: 'N', label: tr('미마감', 'Open') }, { value: 'Y', label: tr('마감완료', 'Closed') }, { value: 'P', label: tr('부분마감', 'Partial') }]} /></FilterField>
        <FilterField label={tr('과정명', 'Course')} htmlFor="cl-lc" width={300}><ASelect id="cl-lc" value={form.lectureCode} onChange={(e) => setForm({ ...form, lectureCode: e.target.value })} options={courseOptions} loading={options.isPending} /></FilterField>
      </FilterBar>
      {p.go !== 1 ? <PendingHint /> : (
        <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => `${r.lectureStart}|${r.lectureEnd}|${r.companyCode}|${r.lectureCode}|${r.serviceType}|${r.openChapter ?? ''}`} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} emptyTitle={tr('검색된 내용이 없습니다.', 'No results.')}
          page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} dense />
      )}
      <ConfirmDialog open={!!closing} tone="danger" title={tr('교육종료(수강마감) 처리', 'Close enrollments')} confirmLabel={tr('마감 처리', 'Close')} loading={complete.isPending} onCancel={() => setClosing(null)} onConfirm={() => closing && complete.mutate(closing)}
        body={closing ? <div style={{ display: 'grid', gap: 6 }}><b>{closing.companyName} · {closing.lectureStart} ~ {closing.lectureEnd}</b><span>{tr('해당 기간/사업주의 수강이 모두 마감(StudyEnd=Y)됩니다. 기존 학습이력은 삭제되지 않으며, 마감 후 같은 과정의 신규 수강등록이 가능합니다.', 'Every enrollment of this company/term is set to StudyEnd=Y. Learning history is kept; new enrollments of the same course become possible.')}</span><span>{tr('※ 수료증 메일은 발송되지 않습니다. 교육종료 처리는 취소할 수 없습니다. 재수강 중인 수강생이 없는지 먼저 확인하세요.', 'No certificate mail is sent. This cannot be undone. Check that nobody is re-taking the course.')}</span></div> : null} />
      <ConfirmDialog open={!!mail} title={mail?.kind === 'certificate' ? tr('수료증·교육결과보고서 메일발송', 'E-mail certificates and results report') : tr('훈련진행보고서 메일발송', 'E-mail progress report')} confirmLabel={tr('발송', 'Send')} loading={sendMail.isPending} onCancel={() => setMail(null)} onConfirm={() => mail && sendMail.mutate(mail)}
        body={mail ? <div style={{ display: 'grid', gap: 6 }}><b>[{mail.r.companyName}] {tr('교육담당자에게 발송합니다.', 'To the training manager.')}</b><span className="muted">{tr('현재 새 콘솔은 메일 발송 설정이 없어 수신자·템플릿 확인까지만 수행합니다. 실제 발송은 기존 사이트의 같은 버튼을 사용하세요.', 'The new console has no mail provider yet; this only validates the recipient and template.')}</span></div> : null} />
    </AdminPage>
  );
}
