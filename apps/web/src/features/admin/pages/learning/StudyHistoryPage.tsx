import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminLearningApi, type StudyHistoryRow } from '../../../../shared/api/endpoints/admin-learning';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, DataTable, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { MemberLink, PendingHint, SERVICE_TYPE_OPTIONS, StudyLink, TERM_PARAM_DEFAULTS, TermSearchFields, YN_OPTIONS, termFromParams, termQuery, termToParams, useCsvDownload, useLearningOptions } from './learningShared';

const DEFAULTS = { ...TERM_PARAM_DEFAULTS, openChapter: '', serviceType: '', id: '', salesId: '', progress1: '', progress2: '', tutorStatus: '', lectureCode: '', eduManager: '', tutor: '', passOk: '', certCount: '', size: 30, page: 1, go: 0 };
const SIZES = [10, 30, 50, 70, 100].map((n) => ({ value: String(n), label: tr(`${n}개`, `${n} rows`) }));

/** study2.php — 학습내역관리 (B5): learner × content rows with stored progress / study seconds. */
export default function StudyHistoryPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [term, setTerm] = useState(termFromParams(p));
  const [form, setForm] = useState({ openChapter: p.openChapter, serviceType: p.serviceType, id: p.id, salesId: p.salesId, progress1: p.progress1, progress2: p.progress2, tutorStatus: p.tutorStatus, lectureCode: p.lectureCode, eduManager: p.eduManager, tutor: p.tutor, passOk: p.passOk, certCount: p.certCount, size: String(p.size) });
  const options = useLearningOptions();
  const { admin } = useAdminSession();
  const [exporting, download] = useCsvDownload();
  const filters = useMemo(() => ({ ...termQuery(p), openChapter: p.openChapter || undefined, serviceType: p.serviceType || undefined, id: p.id || undefined, salesId: p.salesId || undefined, progress1: p.progress1 || undefined, progress2: p.progress2 || undefined, tutorStatus: p.tutorStatus || undefined, lectureCode: p.lectureCode || undefined, eduManager: p.eduManager || undefined, tutor: p.tutor || undefined, passOk: p.passOk || undefined, certCount: p.certCount || undefined }), [p]);
  const query = useMemo(() => ({ ...filters, page: p.page, size: p.size }), [filters, p.page, p.size]);
  const list = useQuery({ queryKey: ['admin', 'learning', 'history', query], queryFn: ({ signal }) => adminLearningApi.history(query, signal), placeholderData: keepPreviousData, enabled: p.go === 1 });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * p.size;
  const submit = () => setP({ ...termToParams(term), ...form, size: Number(form.size) || 30, go: 1 }, true);
  const courseOptions = useMemo(() => [{ value: '', label: tr('-- 과정 전체 --', '-- all courses --') }, ...(options.data?.packageCourses ?? []).map((c) => ({ value: c.lectureCode, label: `${c.name} | ${c.lectureCode}` }))], [options.data]);
  const tutorOptions = useMemo(() => [{ value: '', label: adm.common.all }, ...(options.data?.tutors ?? []).map((t) => ({ value: t.id, label: `${t.name} | ${t.id}` }))], [options.data]);

  const columns: Column<StudyHistoryRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => firstNo - i },
    { key: 'serviceTypeLabel', header: tr('과정구분', 'Type'), nowrap: true },
    { key: 'courseName', header: tr('과정명', 'Course'), render: (r) => <span title={r.lectureCode}>{r.courseName}</span> },
    { key: 'progress', header: tr('진도율', 'Progress'), align: 'right', nowrap: true, render: (r) => `${r.progress}%` },
    { key: 'formatted', header: tr('수강시간', 'Study time'), nowrap: true },
    { key: 'startDate', header: tr('학습시작일', 'First study'), nowrap: true, render: (r) => r.startDate ?? '' },
    { key: 'endDate', header: tr('학습종료일', 'Last study'), nowrap: true, render: (r) => r.endDate ?? '' },
    { key: 'id', header: tr('학습자', 'Learner'), nowrap: true, render: (r) => <MemberLink id={r.id}>{r.name ?? ''} ({r.id})</MemberLink> },
    { key: 'studySeq', header: 'Seq', align: 'right', render: (r) => <StudyLink seq={r.studySeq} /> },
  ];
  return (
    <AdminPage title={tr('학습내역관리', 'Study history')} lead={tr('아카이브 패키지/비패키지 과정 세부 수강 데이터를 확인합니다. 수강시간 = 저장된 Progress.StudyTime 합계.', 'Per-learner, per-content study records. Study time = stored Progress.StudyTime sum.')}>
      <FilterBar onSubmit={submit} onReset={() => { setTerm(termFromParams(DEFAULTS)); setForm({ openChapter: '', serviceType: '', id: '', salesId: '', progress1: '', progress2: '', tutorStatus: '', lectureCode: '', eduManager: '', tutor: '', passOk: '', certCount: '', size: '30' }); reset(); }}
        extra={<AButton onClick={() => void download(() => adminLearningApi.downloadHistoryCsv(filters))} loading={exporting} disabled={!list.data || total === 0}>{tr('검색 결과 엑셀(CSV) 출력', 'Export CSV')}</AButton>}>
        <TermSearchFields value={term} onChange={setTerm} options={options.data} idPrefix="sh" />
        <FilterField label={tr('실시회차', 'Round')} htmlFor="sh-oc" width={100}><AInput id="sh-oc" value={form.openChapter} inputMode="numeric" onChange={(e) => setForm({ ...form, openChapter: e.target.value.replace(/\D/g, '') })} /></FilterField>
        <FilterField label={tr('개설용도', 'Purpose')} htmlFor="sh-st" width={150}><ASelect id="sh-st" value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} options={SERVICE_TYPE_OPTIONS} /></FilterField>
        <FilterField label={tr('이름, ID', 'Name / ID')} htmlFor="sh-id" width={150}><AInput id="sh-id" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} /></FilterField>
        <FilterField label={tr('영업자 이름, ID', 'Sales rep')} htmlFor="sh-sales" width={150}><AInput id="sh-sales" value={form.salesId} onChange={(e) => setForm({ ...form, salesId: e.target.value })} /></FilterField>
        <FilterField label={tr('진도율 (%)', 'Progress (%)')} width={180}><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><AInput aria-label={tr('진도율 시작', 'Progress from')} value={form.progress1} inputMode="numeric" style={{ width: 64 }} onChange={(e) => setForm({ ...form, progress1: e.target.value.replace(/\D/g, '') })} /> ~ <AInput aria-label={tr('진도율 끝', 'Progress to')} value={form.progress2} inputMode="numeric" style={{ width: 64 }} onChange={(e) => setForm({ ...form, progress2: e.target.value.replace(/\D/g, '') })} /></div></FilterField>
        <FilterField label={tr('첨삭정렬', 'Tutoring')} htmlFor="sh-ts" width={150}><ASelect id="sh-ts" value={form.tutorStatus} onChange={(e) => setForm({ ...form, tutorStatus: e.target.value })} options={[{ value: '', label: adm.common.all }, { value: 'N', label: tr('미첨삭만 보기', 'Not yet closed') }]} /></FilterField>
        <FilterField label={tr('과정명', 'Course')} htmlFor="sh-lc" width={300}><ASelect id="sh-lc" value={form.lectureCode} onChange={(e) => setForm({ ...form, lectureCode: e.target.value })} options={courseOptions} loading={options.isPending} /></FilterField>
        <FilterField label={tr('교육담당자 여부', 'Training manager')} htmlFor="sh-em" width={140}><ASelect id="sh-em" value={form.eduManager} onChange={(e) => setForm({ ...form, eduManager: e.target.value })} options={[{ value: '', label: adm.common.all }, { value: 'Y', label: tr('교육담당자', 'Manager') }, { value: 'N', label: tr('일반회원', 'Member') }]} /></FilterField>
        {admin?.dept === 'A' || admin?.dept === 'B' ? <FilterField label={tr('교강사', 'Tutor')} htmlFor="sh-tutor" width={160}><ASelect id="sh-tutor" value={form.tutor} onChange={(e) => setForm({ ...form, tutor: e.target.value })} options={tutorOptions} /></FilterField> : null}
        <FilterField label={tr('수료여부', 'Passed')} htmlFor="sh-po" width={130}><ASelect id="sh-po" value={form.passOk} onChange={(e) => setForm({ ...form, passOk: e.target.value })} options={[{ value: '', label: adm.common.all }, { value: 'Y', label: tr('수료', 'Passed') }, { value: 'N', label: tr('미수료', 'Not passed') }]} /></FilterField>
        <FilterField label={tr('실명인증 여부', 'Identity check')} htmlFor="sh-cert" width={130}><ASelect id="sh-cert" value={form.certCount} onChange={(e) => setForm({ ...form, certCount: e.target.value })} options={[{ value: '', label: adm.common.all }, { value: 'Y', label: tr('인증 완료', 'Verified') }, { value: 'N', label: tr('미인증', 'Not verified') }]} /></FilterField>
        <FilterField label={tr('페이징 설정', 'Rows')} htmlFor="sh-size" width={110}><ASelect id="sh-size" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} options={SIZES} /></FilterField>
      </FilterBar>
      {p.go !== 1 ? <PendingHint /> : (
        <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => `${r.studySeq}-${r.lectureCode}-${r.id}`} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} emptyTitle={tr('검색된 내용이 없습니다.', 'No results.')}
          page={p.page} size={p.size} total={total} onPageChange={(n) => setP({ page: n })} dense />
      )}
      <datalist id="yn-opts">{YN_OPTIONS.map((o) => <option key={o.value} value={o.value} />)}</datalist>
    </AdminPage>
  );
}
