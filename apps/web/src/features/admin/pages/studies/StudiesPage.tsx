import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminStudiesParityApi, type BatchKind, type StudyManageRow } from '../../../../shared/api/endpoints/admin-studies-parity';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Callout, ConfirmDialog, DataTable, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { PendingHint, SERVICE_TYPE_OPTIONS, TERM_PARAM_DEFAULTS, TermSearchFields, termFromParams, termQuery, termToParams, useCsvDownload } from '../learning/learningShared';
import { BatchDialog, CertificateDialog, DayTimeDialog, GrantDialog, MemberLinkCell, PostCellView, PreCellView, PreResumeDialog } from './studies-parity-dialogs';

/** hrd_manager study.php + study_search_result.php — 학습관리 (B5). Same filters, columns, buttons and popups as the PHP page. */

const DEFAULTS = {
  ...TERM_PARAM_DEFAULTS, openChapter: '', serviceType: '', id: '', salesId: '', progress1: '', progress2: '', tutorStatus: '', size: 30, abilityYN: '', abilityAfterYN: '',
  lectureCode: '', eduManager: '', tutor: '', passOk: '', certCount: '', page: 1, go: 0,
};
type FormState = { openChapter: string; serviceType: string; id: string; salesId: string; progress1: string; progress2: string; tutorStatus: string; size: string; abilityYN: string; abilityAfterYN: string; lectureCode: string; eduManager: string; tutor: string; passOk: string; certCount: string };
const EMPTY_FORM: FormState = { openChapter: '', serviceType: '', id: '', salesId: '', progress1: '', progress2: '', tutorStatus: '', size: '30', abilityYN: '', abilityAfterYN: '', lectureCode: '', eduManager: '', tutor: '', passOk: '', certCount: '' };
const YN_ALL = [{ value: '', label: adm.common.all }, { value: 'Y', label: 'Y' }, { value: 'N', label: 'N' }];
const SEND_MAX = 200; const LOG_MAX = 50;

type Pending = { kind: 'delete' | 'kakao' | 'mail'; seqs: number[] } | null;

export default function StudiesPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [term, setTerm] = useState(termFromParams(p));
  const [form, setForm] = useState<FormState>({ openChapter: p.openChapter, serviceType: p.serviceType, id: p.id, salesId: p.salesId, progress1: p.progress1, progress2: p.progress2, tutorStatus: p.tutorStatus, size: String(p.size), abilityYN: p.abilityYN, abilityAfterYN: p.abilityAfterYN, lectureCode: p.lectureCode, eduManager: p.eduManager, tutor: p.tutor, passOk: p.passOk, certCount: p.certCount });
  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [exporting, download] = useCsvDownload();
  const options = useQuery({ queryKey: ['admin', 'studies', 'manage-options'], queryFn: ({ signal }) => adminStudiesParityApi.manageOptions(signal), staleTime: 5 * 60_000 });
  const opt = options.data;

  const filters = useMemo(() => ({
    ...termQuery(p), openChapter: p.openChapter || undefined, serviceType: p.serviceType || undefined, id: p.id || undefined, salesId: p.salesId || undefined, progress1: p.progress1 || undefined, progress2: p.progress2 || undefined,
    tutorStatus: p.tutorStatus || undefined, lectureCode: p.lectureCode || undefined, eduManager: p.eduManager || undefined, tutor: p.tutor || undefined, passOk: p.passOk || undefined, certCount: p.certCount || undefined,
    abilityYN: p.abilityYN || undefined, abilityAfterYN: p.abilityAfterYN || undefined,
  }), [p]);
  const query = useMemo(() => ({ ...filters, page: p.page, size: p.size }), [filters, p.page, p.size]);
  const list = useQuery({ queryKey: ['admin', 'studies', 'manage', query], queryFn: ({ signal }) => adminStudiesParityApi.manage(query, signal), placeholderData: keepPreviousData, enabled: p.go === 1 });
  const rows = list.data?.items;
  const total = list.data?.total ?? 0;
  const firstNo = total - (p.page - 1) * p.size;
  const canWrite = !!(list.data?.canWrite ?? opt?.canWrite);

  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [dayTime, setDayTime] = useState<number | null>(null);
  const [cert, setCert] = useState<number | null>(null);
  const [resume, setResume] = useState<number | null>(null);
  const [grant, setGrant] = useState<{ seq: number; type: 'PRE' | 'POST' } | null>(null);
  const [batch, setBatch] = useState<BatchKind | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['admin', 'studies'] }); };

  const submit = () => { setChecked(new Set()); setP({ ...termToParams(term), ...form, size: Number(form.size) || 30, go: 1 }, true); };
  const checkedSeqs = () => [...checked];
  const requireChecked = (msg: string) => {
    if (!rows?.length) { toast(tr('검색된 학습현황이 없습니다.', 'No search results.'), { tone: 'warn' }); return null; }
    const seqs = checkedSeqs();
    if (!seqs.length) { toast(msg, { tone: 'warn' }); return null; }
    return seqs;
  };
  const doPending = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === 'delete') {
        const r = await adminStudiesParityApi.deleteStudies(pending.seqs);
        toast(tr(`${r.deleted}건 삭제했습니다. (진도 ${r.progressDeleted}행, 회차 ${r.termsDeleted}건 정리, 백업 ${r.backedUp}건)`, `Deleted ${r.deleted} (progress rows ${r.progressDeleted}, terms ${r.termsDeleted}, backups ${r.backedUp}).`), { tone: 'ok' });
        setChecked(new Set()); refresh();
      } else {
        const r = pending.kind === 'kakao' ? await adminStudiesParityApi.sendStartKakao(pending.seqs) : await adminStudiesParityApi.sendEduManagerMail(pending.seqs);
        toast(tr(`발송 로그 ${r.logged}건을 기록했습니다. 새 콘솔에는 발송 설정이 없어 실제 전송은 되지 않았습니다(${r.code}).`, `${r.logged} log row(s) written; nothing was transmitted (${r.code}).`), { tone: 'warn' });
      }
    } catch (e) { toast(isAppError(e) ? e.message : tr('처리중 문제가 발생했습니다.', 'Something went wrong.'), { tone: 'danger' }); }
    finally { setBusy(false); setPending(null); }
  };
  const exportLog = () => {
    const seqs = requireChecked(tr('진도로그를 출력할 체크 항목을 선택하세요.', 'Check the rows to export.'));
    if (!seqs) return;
    const members = new Set((rows ?? []).filter((r) => checked.has(r.studySeq)).map((r) => r.id)).size;
    if (members > LOG_MAX) { toast(tr(`진도로그 엑셀은 한 번에 최대 ${LOG_MAX}명까지 출력할 수 있습니다. 선택: ${members}명 (${seqs.length}건)`, `At most ${LOG_MAX} learners per export (selected ${members}).`), { tone: 'warn' }); return; }
    void download(() => adminStudiesParityApi.downloadProgressLogCsv(seqs));
  };

  const pageSeqs = useMemo(() => [...new Set((rows ?? []).map((r) => r.studySeq))], [rows]);
  const columns: Column<StudyManageRow>[] = [
    { key: 'chk', header: <input type="checkbox" aria-label={tr('전체 선택', 'Select all')} checked={pageSeqs.length > 0 && pageSeqs.every((s) => checked.has(s))} onChange={(e) => setChecked(e.target.checked ? new Set(pageSeqs) : new Set())} />, width: 34, align: 'center',
      render: (r) => <input type="checkbox" aria-label={`Seq ${r.studySeq}`} checked={checked.has(r.studySeq)} onChange={(e) => { const n = new Set(checked); if (e.target.checked) n.add(r.studySeq); else n.delete(r.studySeq); setChecked(n); }} onClick={(e) => e.stopPropagation()} /> },
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => firstNo - i },
    { key: 'serviceTypeLabel', header: tr('개설 용도', 'Purpose'), align: 'center', nowrap: true },
    { key: 'id', header: <>{tr('이름', 'Name')}<br />ID</>, align: 'center', render: (r) => <MemberLinkCell id={r.id} name={r.name} /> },
    { key: 'courseName', header: <>{tr('과정명', 'Course')}<br />{tr('수강기간', 'Period')}</>, align: 'center', render: (r) => <><Link to={`/admin/studies/${r.studySeq}`}><b>{r.courseName}</b></Link><br /><span style={{ whiteSpace: 'nowrap' }}>{r.lectureStart} ~ {r.lectureEnd}</span></> },
    { key: 'seconds', header: tr('수강시간', 'Study time'), align: 'center', nowrap: true, render: (r) => <AButton variant="link" size="xs" onClick={() => setDayTime(r.studySeq)}>{r.studyTimeLabel}</AButton> },
    { key: 'percent', header: tr('진도율', 'Progress'), align: 'center', render: (r) => <Link to={`/admin/studies/${r.studySeq}`} title={tr(`저장값 Study.Progress ${r.storedProgress}%`, `stored ${r.storedProgress}%`)}>{r.percent}%</Link> },
    { key: 'passOk', header: tr('수료여부', 'Passed'), align: 'center', render: (r) => r.passOk === 'Y' ? (r.certificateLink ? <AButton variant="link" size="xs" onClick={() => setCert(r.studySeq)}><b style={{ color: '#0284c7' }}>{tr('수료', 'Passed')}</b></AButton> : <b style={{ color: '#0284c7' }}>{tr('수료', 'Passed')}</b>) : r.passOk === 'N' ? <b style={{ color: '#ea580c' }}>{tr('미수료', 'Not passed')}</b> : '' },
    { key: 'tutorName', header: <>{tr('교·강사', 'Tutor')}<br />{tr('영업담당자', 'Sales rep')}<br />{tr('영업담당자 소속', 'Sales team')}</>, align: 'center', render: (r) => <>{r.tutorName ?? ''}<br />{r.salesName ?? ''}<br />{r.salesTeam ?? ''}</> },
    { key: 'companyName', header: <>{tr('사업주', 'Company')}<br />{tr('부서', 'Dept.')}</>, align: 'center', render: (r) => <>{r.companyCode ? <Link to={`/admin/companies?q=${encodeURIComponent(r.companyCode)}`} title={r.companyCode}>{r.companyName ?? r.companyCode}</Link> : r.companyName}{r.depart ? <><br />{tr(`부서 : ${r.depart}`, `Dept: ${r.depart}`)}</> : null}</> },
    { key: 'certDate', header: <>{tr('실명인증', 'Identity')}<br />{tr('날짜', 'date')}</>, align: 'center', nowrap: true, render: (r) => r.certDate ?? '' },
    { key: 'openChapter', header: tr('실시회차', 'Round'), align: 'center', render: (r) => r.openChapter ?? '' },
    { key: 'inputDate', header: tr('수강신청일', 'Enrolled at'), align: 'center', render: (r) => r.inputDate ?? '' },
    { key: 'pre', header: tr('사전', 'Pre'), align: 'center', render: (r) => <PreCellView cell={r.pre} onResume={() => setResume(r.studySeq)} onOpen={() => setGrant({ seq: r.studySeq, type: 'PRE' })} /> },
    { key: 'post', header: tr('사후', 'Post'), align: 'center', render: (r) => <PostCellView cell={r.post} onOpen={() => setGrant({ seq: r.studySeq, type: 'POST' })} /> },
    { key: 'ai', header: tr('AI 분석', 'AI analysis'), align: 'center', render: (r) => <AButton size="xs" to={`/admin/learning/ai-analysis?col=ID&q=${encodeURIComponent(r.id)}`}>{tr('AI 분석', 'AI')}</AButton> },
  ];

  const courseOptions = useMemo(() => [{ value: '', label: tr('-- 과정 전체 --', '-- all courses --') }, ...(opt?.packageCourses ?? []).map((c) => ({ value: c.lectureCode, label: `${c.name} | ${c.lectureCode}` }))], [opt]);
  const tutorOptions = useMemo(() => [{ value: '', label: adm.common.all }, ...(opt?.tutors ?? []).map((t) => ({ value: t.id, label: `${t.name} | ${t.id}` }))], [opt]);
  const sizeOptions = (opt?.pageSizes ?? [10, 30, 50, 70, 100]).map((n) => ({ value: String(n), label: tr(`${n}개`, `${n} rows`) }));
  const learningOptions = opt ? { packageCourses: opt.packageCourses, childCourses: [], tutors: opt.tutors, years: opt.years, thisYear: opt.thisYear, serviceTypes: [] } : undefined;
  const hasRows = !!rows?.length;

  return (
    <AdminPage title={tr('학습관리', 'Study management')} lead={tr('수강시간 = 저장된 Progress.StudyTime 합계(패키지는 하위과정 포함), 진도율 = 15시간(54,000초) 대비 비율, 수료여부 = 저장된 Study.PassOK.', 'Study time = stored Progress.StudyTime (package children included); progress = share of 15 h (54,000 s); passed = stored Study.PassOK.')}>
      <FilterBar onSubmit={submit} onReset={() => { setTerm(termFromParams(DEFAULTS)); setForm(EMPTY_FORM); setChecked(new Set()); reset(); }}>
        <TermSearchFields value={term} onChange={setTerm} options={learningOptions} idPrefix="sm" />
        <FilterField label={tr('실시회차', 'Round')} htmlFor="sm-oc" width={100}><AInput id="sm-oc" value={form.openChapter} inputMode="numeric" onChange={(e) => set({ openChapter: e.target.value.replace(/\D/g, '') })} /></FilterField>
        <FilterField label={tr('개설용도', 'Purpose')} htmlFor="sm-st" width={150}><ASelect id="sm-st" value={form.serviceType} onChange={(e) => set({ serviceType: e.target.value })} options={SERVICE_TYPE_OPTIONS} /></FilterField>
        <FilterField label={tr('이름,ID', 'Name / ID')} htmlFor="sm-id" width={150}><AInput id="sm-id" value={form.id} onChange={(e) => set({ id: e.target.value })} /></FilterField>
        <FilterField label={tr('영업자 이름,ID', 'Sales rep')} htmlFor="sm-sales" width={150}><AInput id="sm-sales" value={form.salesId} onChange={(e) => set({ salesId: e.target.value })} /></FilterField>
        <FilterField label={tr('진도율 (%)', 'Progress (%)')} width={180}><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><AInput aria-label={tr('진도율 시작', 'Progress from')} value={form.progress1} inputMode="numeric" style={{ width: 64 }} onChange={(e) => set({ progress1: e.target.value.replace(/\D/g, '') })} /> ~ <AInput aria-label={tr('진도율 끝', 'Progress to')} value={form.progress2} inputMode="numeric" style={{ width: 64 }} onChange={(e) => set({ progress2: e.target.value.replace(/\D/g, '') })} /></div></FilterField>
        <FilterField label={tr('첨삭정렬', 'Tutoring')} htmlFor="sm-ts" width={150}><ASelect id="sm-ts" value={form.tutorStatus} onChange={(e) => set({ tutorStatus: e.target.value })} options={[{ value: '', label: adm.common.all }, { value: 'N', label: tr('미첨삭만 보기', 'Not yet closed') }]} /></FilterField>
        <FilterField label={tr('페이징 설정', 'Rows')} htmlFor="sm-size" width={110}><ASelect id="sm-size" value={form.size} onChange={(e) => set({ size: e.target.value })} options={sizeOptions} /></FilterField>
        <FilterField label={tr('사전', 'Pre')} htmlFor="sm-pre" width={110}><ASelect id="sm-pre" value={form.abilityYN} onChange={(e) => set({ abilityYN: e.target.value })} options={YN_ALL} /></FilterField>
        <FilterField label={tr('사후', 'Post')} htmlFor="sm-post" width={110}><ASelect id="sm-post" value={form.abilityAfterYN} onChange={(e) => set({ abilityAfterYN: e.target.value })} options={YN_ALL} /></FilterField>
        <FilterField label={tr('과정명', 'Course')} htmlFor="sm-lc" width={300}><ASelect id="sm-lc" value={form.lectureCode} onChange={(e) => set({ lectureCode: e.target.value })} options={courseOptions} loading={options.isPending} /></FilterField>
        <FilterField label={tr('교육담당자 여부', 'Training manager')} htmlFor="sm-em" width={140}><ASelect id="sm-em" value={form.eduManager} onChange={(e) => set({ eduManager: e.target.value })} options={[{ value: '', label: adm.common.all }, { value: 'Y', label: tr('교육담당자', 'Manager') }, { value: 'N', label: tr('일반회원', 'Member') }]} /></FilterField>
        {opt?.showTutorFilter ? <FilterField label={tr('교강사', 'Tutor')} htmlFor="sm-tutor" width={160}><ASelect id="sm-tutor" value={form.tutor} onChange={(e) => set({ tutor: e.target.value })} options={tutorOptions} /></FilterField> : null}
        <FilterField label={tr('수료여부', 'Passed')} htmlFor="sm-po" width={130}><ASelect id="sm-po" value={form.passOk} onChange={(e) => set({ passOk: e.target.value })} options={[{ value: '', label: adm.common.all }, { value: 'Y', label: tr('수료', 'Passed') }, { value: 'N', label: tr('미수료', 'Not passed') }]} /></FilterField>
        <FilterField label={tr('실명인증 여부', 'Identity check')} htmlFor="sm-cert" width={130}><ASelect id="sm-cert" value={form.certCount} onChange={(e) => set({ certCount: e.target.value })} options={[{ value: '', label: adm.common.all }, { value: 'Y', label: tr('인증 완료', 'Verified') }, { value: 'N', label: tr('미인증', 'Not verified') }]} /></FilterField>
      </FilterBar>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '4px 0 8px' }}>
        <AButton onClick={() => { if (!hasRows) { toast(tr('검색된 학습현황이 없습니다.', 'No search results.'), { tone: 'warn' }); return; } void download(() => adminStudiesParityApi.downloadManageCsv(filters)); }} loading={exporting}>{tr('검색 결과 엑셀(CSV) 출력', 'Export results (CSV)')}</AButton>
        {canWrite ? (<>
          <AButton onClick={() => { const s = requireChecked(tr('발송하려는 항목을 선택하세요.', 'Check the rows to send to.')); if (!s) return; if (s.length > SEND_MAX) { toast(tr(`한 번에 최대 ${SEND_MAX}명까지 발송할 수 있습니다. 선택: ${s.length}명`, `At most ${SEND_MAX} per batch.`), { tone: 'warn' }); return; } setPending({ kind: 'kakao', seqs: s }); }}>{tr('체크 항목 개강1일전문자보내기', 'Send day-before SMS')}</AButton>
          <AButton onClick={() => { const s = requireChecked(tr('발송하려는 항목을 선택하세요.', 'Check the rows to send to.')); if (!s) return; if (s.length > SEND_MAX) { toast(tr(`한 번에 최대 ${SEND_MAX}건까지 처리할 수 있습니다.`, `At most ${SEND_MAX} per batch.`), { tone: 'warn' }); return; } setPending({ kind: 'mail', seqs: s }); }}>{tr('체크 항목 교육담당자 안내 메일 발송', 'Mail training managers')}</AButton>
          <AButton variant="danger" onClick={() => { if (requireChecked(tr('변경하려는 항목을 선택하세요.', 'Check rows first.'))) setBatch('term'); }}>{tr('체크 항목 수강기간변경하기', 'Change study period')}</AButton>
          <AButton onClick={exportLog}>{tr('체크 항목 진도로그 엑셀 출력', 'Export progress log')}</AButton>
          <AButton variant="danger" onClick={() => { const s = requireChecked(tr('삭제하려는 항목을 선택하세요.', 'Check the rows to delete.')); if (s) setPending({ kind: 'delete', seqs: s }); }}>{tr('체크 항목 삭제', 'Delete checked')}</AButton>
          {opt?.canChangeServiceType ? <AButton onClick={() => { if (!p.serviceType) { toast(tr('개설용도를 선택하세요.', 'Choose the purpose filter first.'), { tone: 'warn' }); return; } if (!p.lectureCode) { toast(tr('변경하려는 과정을 선택하세요.', 'Choose a course filter first.'), { tone: 'warn' }); return; } if (!hasRows) { toast(tr('검색된 학습현황이 없습니다.', 'No search results.'), { tone: 'warn' }); return; } setBatch('serviceType'); }}>{tr('현재 검색 조건으로 개설용도 변경', 'Change purpose (current search)')}</AButton> : null}
          <AButton onClick={() => { if (!hasRows) { toast(tr('검색된 학습현황이 없습니다.', 'No search results.'), { tone: 'warn' }); return; } setBatch('openChapter'); }}>{tr('현재 검색 조건으로 실시회차 변경', 'Change round (current search)')}</AButton>
          <AButton onClick={() => { if (!hasRows) { toast(tr('검색된 학습현황이 없습니다.', 'No search results.'), { tone: 'warn' }); return; } setBatch('sales'); }}>{tr('현재 검색 조건으로 영업담당 변경', 'Change sales rep (current search)')}</AButton>
        </>) : null}
      </div>
      {canWrite ? <Callout className="u-mb-8">{tr('문자/메일 발송은 새 콘솔에 발송 설정이 없어 발송 로그만 기록됩니다. 실제 발송은 기존 관리자 사이트에서 진행하세요.', 'SMS / e-mail: only the log rows are written here (no provider configured). Send from the previous admin site.')}</Callout> : null}

      {p.go !== 1 ? <PendingHint /> : (
        <>
          <div style={{ fontSize: 13, margin: '6px 0' }}>{tr('검색 결과 총 ', 'Total ')}<strong>{total.toLocaleString('ko-KR')}</strong>{tr('건 (엑셀 출력 시 전체 건수가 다운로드됩니다)', ' rows (the export downloads all of them)')}{checked.size ? <span className="muted"> · {tr(`선택 ${checked.size}건`, `${checked.size} checked`)}</span> : null}</div>
          <DataTable columns={columns} rows={rows} rowKey={(r, i) => `${r.studySeq}-${i}`} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} emptyTitle={tr('검색된 내용이 없습니다.', 'No results.')}
            page={p.page} size={p.size} total={total} onPageChange={(n) => { setChecked(new Set()); setP({ page: n }); }} dense />
        </>
      )}

      <DayTimeDialog seq={dayTime} onClose={() => setDayTime(null)} />
      <CertificateDialog seq={cert} onClose={() => setCert(null)} />
      <PreResumeDialog seq={resume} onClose={() => setResume(null)} />
      <GrantDialog target={grant} onClose={() => setGrant(null)} onDone={refresh} />
      <BatchDialog kind={batch} filters={filters} options={opt} onClose={() => setBatch(null)} onDone={refresh} />
      <ConfirmDialog open={!!pending} tone={pending?.kind === 'delete' ? 'danger' : 'warn'} loading={busy} onCancel={() => setPending(null)} onConfirm={() => void doPending()}
        title={pending?.kind === 'delete' ? tr('체크 항목 삭제', 'Delete checked') : pending?.kind === 'kakao' ? tr('개강1일전 문자 보내기', 'Day-before SMS') : tr('교육담당자 안내 메일 발송', 'Mail training managers')}
        confirmLabel={pending?.kind === 'delete' ? tr('삭제', 'Delete') : tr('발송', 'Send')}
        body={pending?.kind === 'delete'
          ? <p>{tr(`선택한 ${pending.seqs.length}건을 정말 삭제하시겠습니까? 진도 기록(Progress)도 함께 삭제되며 삭제 후에는 되돌릴 수 없습니다.`, `Delete ${pending.seqs.length} enrollment(s)? Their Progress rows are deleted too; this cannot be undone.`)}</p>
          : <p>{tr(`선택한 ${pending?.seqs.length ?? 0}건에 발송합니다. 현재는 발송 로그만 기록되고 실제 전송은 되지 않습니다.`, `Send to ${pending?.seqs.length ?? 0} row(s). Only log rows are written; nothing is transmitted.`)}</p>} />
    </AdminPage>
  );
}
