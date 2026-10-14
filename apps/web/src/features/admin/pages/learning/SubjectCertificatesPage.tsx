import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminLearningApi, type SubjectCertRow } from '../../../../shared/api/endpoints/admin-learning';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, DataTable, DateField, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { CompanyAutocomplete, MemberLink, PendingHint, StudyLink, useCsvDownload, useLearningOptions } from './learningShared';

const DEFAULTS = { lectureStart: '', lectureEnd: '', companyName: '', companyCode: '', openChapter: '', lectureCode: '', id: '', page: 1, go: 0 };
const SIZE = 10;
type Form = Omit<typeof DEFAULTS, 'page' | 'go'>;
const pick = (p: typeof DEFAULTS): Form => ({ lectureStart: p.lectureStart, lectureEnd: p.lectureEnd, companyName: p.companyName, companyCode: p.companyCode, openChapter: p.openChapter, lectureCode: p.lectureCode, id: p.id });

/** study_end2.php — 과목별 이수증 (B8): 비환급(W) learner × content rows; 이수증 opens the printable certificate page. */
export default function SubjectCertificatesPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState<Form>(pick(p));
  const options = useLearningOptions();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [exporting, download] = useCsvDownload();
  const filters = useMemo(() => ({ lectureStart: p.lectureStart || undefined, lectureEnd: p.lectureEnd || undefined, companyName: p.companyName || undefined, openChapter: p.openChapter || undefined, lectureCode: p.lectureCode || undefined, id: p.id || undefined }), [p]);
  const query = useMemo(() => ({ ...filters, page: p.page, size: SIZE }), [filters, p.page]);
  const list = useQuery({ queryKey: ['admin', 'learning', 'subject-certificates', query], queryFn: ({ signal }) => adminLearningApi.subjectCertificates(query, signal), placeholderData: keepPreviousData, enabled: p.go === 1 });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;
  const submit = () => { if (!form.lectureStart && !form.lectureEnd && !form.companyName && !form.id) { toast(tr('검색 조건을 입력하세요.', 'Enter a search condition.'), { tone: 'danger' }); return; } setP({ ...form, go: 1 }, true); };
  const print = (r: SubjectCertRow) => {
    const q = new URLSearchParams({ kind: 'subject', id: r.id, lectureStart: r.lectureStart, lectureEnd: r.lectureEnd, lectureCode: r.lectureCode });
    if (r.companyName) q.set('companyName', r.companyName);
    navigate(`/admin/learning/certificates/print?${q.toString()}`);
  };
  const courseOptions = useMemo(() => [{ value: '', label: tr('-- 과정 전체 --', '-- all contents --') }, ...(options.data?.childCourses ?? []).map((c) => ({ value: c.lectureCode, label: `${c.name} | ${c.lectureCode}` }))], [options.data]);
  const columns: Column<SubjectCertRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => firstNo - i },
    { key: 'period', header: tr('수강기간', 'Term'), nowrap: true, render: (r) => `${r.lectureStart} ~ ${r.lectureEnd}` },
    { key: 'companyName', header: tr('사업주명', 'Company'), render: (r) => <span title={r.companyCode ?? ''}>{r.companyName ?? ''}</span> },
    { key: 'id', header: tr('훈련생(이름/ID)', 'Trainee (name / ID)'), nowrap: true, render: (r) => <MemberLink id={r.id}>{r.name ?? ''} ({r.id})</MemberLink> },
    { key: 'ctypeLabel', header: tr('과정구분', 'Type'), nowrap: true },
    { key: 'courseName', header: tr('과정명', 'Content'), render: (r) => <span title={r.lectureCode}>{r.courseName}</span> },
    { key: 'cert', header: tr('이수증 출력', 'Certificate'), align: 'center', render: (r) => (r.certOk ? <AButton size="xs" onClick={() => print(r)}>{tr('이수증', 'Certificate')}</AButton> : '-') },
    { key: 'studySeq', header: 'Seq', align: 'right', render: (r) => <StudyLink seq={r.studySeq} /> },
  ];
  return (
    <AdminPage title={tr('과목별 이수증', 'Certificates by course')} lead={tr('비환급과정(법정) 개별 이수증을 출력할 수 있습니다. 이수증 = 수료(PassOK) 또는 해당 콘텐츠 진도 100%. 출력은 인쇄용 화면에서 브라우저 인쇄(PDF 저장)로 합니다.', 'Individual certificates for non-refund (statutory) contents. Printing uses the browser print dialog (save as PDF).')}>
      <FilterBar onSubmit={submit} onReset={() => { setForm(pick(DEFAULTS)); reset(); }}
        extra={<AButton onClick={() => void download(() => adminLearningApi.downloadSubjectCsv(filters))} loading={exporting} disabled={p.go !== 1}>{tr('엑셀(CSV) 다운로드', 'Export CSV')}</AButton>}>
        <FilterField label={tr('수강 시작일', 'Term start')} htmlFor="sc-from"><DateField id="sc-from" value={form.lectureStart} onChange={(v) => setForm({ ...form, lectureStart: v })} /></FilterField>
        <FilterField label={tr('수강 종료일', 'Term end')} htmlFor="sc-to"><DateField id="sc-to" value={form.lectureEnd} min={form.lectureStart || undefined} onChange={(v) => setForm({ ...form, lectureEnd: v })} /></FilterField>
        <FilterField label={tr('사업주명', 'Company')} htmlFor="sc-co" width={260}><CompanyAutocomplete id="sc-co" name={form.companyName} code={form.companyCode} onPick={(v) => setForm({ ...form, companyName: v.name, companyCode: v.code })} /></FilterField>
        <FilterField label={tr('실시회차', 'Round')} htmlFor="sc-oc" width={100}><AInput id="sc-oc" value={form.openChapter} inputMode="numeric" onChange={(e) => setForm({ ...form, openChapter: e.target.value.replace(/\D/g, '') })} /></FilterField>
        <FilterField label={tr('과정명', 'Content')} htmlFor="sc-lc" width={300}><ASelect id="sc-lc" value={form.lectureCode} onChange={(e) => setForm({ ...form, lectureCode: e.target.value })} options={courseOptions} loading={options.isPending} /></FilterField>
        <FilterField label={tr('이름, ID', 'Name / ID')} htmlFor="sc-id" width={160}><AInput id="sc-id" value={form.id} placeholder={tr('훈련생 이름 또는 ID 입력', 'Trainee name or ID')} onChange={(e) => setForm({ ...form, id: e.target.value })} /></FilterField>
      </FilterBar>
      {p.go !== 1 ? <PendingHint /> : (
        <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => `${r.studySeq}|${r.lectureCode}`} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} emptyTitle={tr('검색된 내용이 없습니다.', 'No results.')} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} dense />
      )}
    </AdminPage>
  );
}
