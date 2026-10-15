import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminLearningApi, type SubjectCertRow } from '../../../../shared/api/endpoints/admin-learning';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, DataTable, DateField, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { CompanyAutocomplete, MemberLink, PendingHint, StudyLink, useCertificatePdf, useCsvDownload, useLearningOptions } from './learningShared';
import { SearchableSelect } from './learningPickers';

const DEFAULTS = { lectureStart: '', lectureEnd: '', companyName: '', companyCode: '', openChapter: '', lectureCode: '', id: '', page: 1, go: 0 };
const SIZE = 10;
type Form = Omit<typeof DEFAULTS, 'page' | 'go'>;
const pick = (p: typeof DEFAULTS): Form => ({ lectureStart: p.lectureStart, lectureEnd: p.lectureEnd, companyName: p.companyName, companyCode: p.companyCode, openChapter: p.openChapter, lectureCode: p.lectureCode, id: p.id });

/** study_end2.php — 과목별 이수증 (B8): 비환급(W) learner × content rows; 이수증 buttons produce the PHP certificate PDFs. */
export default function SubjectCertificatesPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState<Form>(pick(p));
  const options = useLearningOptions();
  const { toast } = useToast();
  const [exporting, download] = useCsvDownload();
  const filters = useMemo(() => ({ lectureStart: p.lectureStart || undefined, lectureEnd: p.lectureEnd || undefined, companyName: p.companyName || undefined, openChapter: p.openChapter || undefined, lectureCode: p.lectureCode || undefined, id: p.id || undefined }), [p]);
  const query = useMemo(() => ({ ...filters, page: p.page, size: SIZE }), [filters, p.page]);
  const list = useQuery({ queryKey: ['admin', 'learning', 'subject-certificates', query], queryFn: ({ signal }) => adminLearningApi.subjectCertificates(query, signal), placeholderData: keepPreviousData, enabled: p.go === 1 });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;
  /** function.js StudyEnd2Search / StudyEnd2Excel / StudyEnd2UserPdf checks. */
  const check = (f: Form) => {
    const err = !f.lectureStart && !f.lectureEnd && !f.companyName && !f.id ? tr('검색 조건을 입력하세요.', 'Enter a search condition.')
      : !f.companyName ? tr('사업주명을 선택하세요.', 'Choose the company.')
      : f.lectureStart && f.lectureEnd && f.lectureStart > f.lectureEnd ? tr('수강종료일이 수강시작일보다 이전입니다. 수강기간을 다시 선택하세요.', 'The end date is before the start date.') : null;
    if (err) toast(err, { tone: 'danger' });
    return !err;
  };
  const submit = () => { if (check(form)) setP({ ...form, go: 1 }, true); };
  const [pdfBusy, openPdf] = useCertificatePdf();
  /** Row 이수증 → include/certificate_pdf04.php: the PDF 이수증_<사업주명>.pdf (CompanyCode + term + content + ID). */
  const print = (r: SubjectCertRow) => openPdf('subject-row', { id: r.id, companyCode: r.companyCode ?? '', lectureStart: r.lectureStart, lectureEnd: r.lectureEnd, lectureCode: r.lectureCode });
  /** 이수증(PDF) 일괄 → study_end2_user_pdf.php for one learner with the current form (PDF shown in a new tab). */
  const bulk = () => {
    if (!check(form)) return;
    if (!form.id.trim()) { toast(tr('이름/ID를 입력하세요. 한 사용자만 선택 가능합니다.', 'Enter one learner name / ID.'), { tone: 'danger' }); return; }
    openPdf('subject', { id: form.id.trim(), companyName: form.companyName, lectureStart: form.lectureStart, lectureEnd: form.lectureEnd, openChapter: form.openChapter, lectureCode: form.lectureCode });
  };
  const exportCsv = () => { if (check(form)) void download(() => adminLearningApi.downloadSubjectCsv({ lectureStart: form.lectureStart || undefined, lectureEnd: form.lectureEnd || undefined, companyName: form.companyName || undefined, openChapter: form.openChapter || undefined, lectureCode: form.lectureCode || undefined, id: form.id || undefined })); };
  const courseOptions = useMemo(() => [{ value: '', label: tr('-- 과정 전체 --', '-- all contents --') }, ...(options.data?.subjectCourses ?? options.data?.childCourses ?? []).map((c) => ({ value: c.lectureCode, label: `${c.name} | ${c.lectureCode}` }))], [options.data]);
  const columns: Column<SubjectCertRow>[] = [
    // 번호 / 수강기간 are shown once per (기간, 사업주, 학습자) group like the PHP rowspan
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (r, i) => (r.groupFirst === false ? '' : r.groupNo ?? firstNo - i) },
    { key: 'period', header: tr('수강기간', 'Term'), nowrap: true, render: (r) => (r.groupFirst === false ? '' : `${r.lectureStart} ~ ${r.lectureEnd}`) },
    { key: 'companyName', header: tr('사업주명', 'Company'), render: (r) => <span title={r.companyCode ?? ''}>{r.companyName ?? ''}</span> },
    { key: 'id', header: tr('훈련생(이름/ID)', 'Trainee (name / ID)'), nowrap: true, render: (r) => <MemberLink id={r.id}>{r.name ?? ''} ({r.id})</MemberLink> },
    { key: 'ctypeLabel', header: tr('과정구분', 'Type'), nowrap: true },
    { key: 'courseName', header: tr('과정명', 'Content'), render: (r) => <span title={r.lectureCode}>{r.courseName}</span> },
    { key: 'cert', header: tr('이수증 출력', 'Certificate'), align: 'center', render: (r) => (r.certOk ? <AButton size="xs" loading={pdfBusy} onClick={() => print(r)}>{tr('이수증', 'Certificate')}</AButton> : '-') },
    { key: 'studySeq', header: 'Seq', align: 'right', render: (r) => <StudyLink seq={r.studySeq} /> },
  ];
  return (
    <AdminPage title={tr('과목별 이수증', 'Certificates by course')} lead={tr('비환급과정(법정) 개별 이수증을 출력할 수 있습니다. 이수증 = 수료(PassOK) 또는 해당 콘텐츠 진도 100%. 이수증은 기존과 같은 PDF 파일로 받습니다.', 'Individual certificates for non-refund (statutory) contents, as the same PDF files as before.')}>
      <FilterBar onSubmit={submit} onReset={() => { setForm(pick(DEFAULTS)); reset(); }}
        extra={<><AButton onClick={exportCsv} loading={exporting}>{tr('엑셀(CSV) 다운로드', 'Export CSV')}</AButton><AButton onClick={bulk} loading={pdfBusy}>{tr('이수증(PDF) 일괄', 'Certificates (batch)')}</AButton></>}>
        <FilterField label={tr('수강 시작일', 'Term start')} htmlFor="sc-from"><DateField id="sc-from" value={form.lectureStart} onChange={(v) => setForm({ ...form, lectureStart: v })} /></FilterField>
        <FilterField label={tr('수강 종료일', 'Term end')} htmlFor="sc-to"><DateField id="sc-to" value={form.lectureEnd} min={form.lectureStart || undefined} onChange={(v) => setForm({ ...form, lectureEnd: v })} /></FilterField>
        <FilterField label={tr('사업주명', 'Company')} htmlFor="sc-co" width={260}><CompanyAutocomplete id="sc-co" name={form.companyName} code={form.companyCode} onPick={(v) => setForm({ ...form, companyName: v.name, companyCode: v.code })} /></FilterField>
        <FilterField label={tr('실시회차', 'Round')} htmlFor="sc-oc" width={100}><AInput id="sc-oc" value={form.openChapter} inputMode="numeric" onChange={(e) => setForm({ ...form, openChapter: e.target.value.replace(/\D/g, '') })} /></FilterField>
        <FilterField label={tr('과정명', 'Content')} htmlFor="sc-lc" width={300}><SearchableSelect id="sc-lc" value={form.lectureCode} onChange={(v) => setForm({ ...form, lectureCode: v })} options={courseOptions} loading={options.isPending} /></FilterField>
        <FilterField label={tr('이름, ID', 'Name / ID')} htmlFor="sc-id" width={160}><AInput id="sc-id" value={form.id} placeholder={tr('훈련생 이름 또는 ID 입력', 'Trainee name or ID')} onChange={(e) => setForm({ ...form, id: e.target.value })} /></FilterField>
      </FilterBar>
      {p.go !== 1 ? <PendingHint /> : (
        <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => `${r.studySeq}|${r.lectureCode}`} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} emptyTitle={tr('검색된 내용이 없습니다.', 'No results.')} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} dense />
      )}
    </AdminPage>
  );
}
