import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminLearningApi, type CompletionRow } from '../../../../shared/api/endpoints/admin-learning';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, DataTable, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { EXPORT_CONFIRM, PendingHint, StudyLink, TERM_PARAM_DEFAULTS, TermSearchFields, termFromParams, termQuery, termToParams, termValidationError, useCsvDownload, useLearningOptions, type TermForm } from './learningShared';
import { useMemberInfo } from './learningMemberInfo';
import { useToast } from '../../../../app/providers/ToastProvider';

const DEFAULTS = { ...TERM_PARAM_DEFAULTS, openChapter: '', page: 1, go: 0 };
const SIZE = 30;

/** course_data.php — 과정 이수데이터 관리 (B7): Progress rows with 분야/NCS/이수시간/이수율; 엑셀(.xlsx) = 개인별 과정 이수 데이터 양식. */
export default function CompletionDataPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [term, setTerm] = useState(termFromParams(p));
  const [openChapter, setOpenChapter] = useState(p.openChapter);
  const options = useLearningOptions();
  const [exporting, download] = useCsvDownload();
  const filters = useMemo(() => ({ ...termQuery(p), openChapter: p.openChapter || undefined }), [p]);
  const query = useMemo(() => ({ ...filters, page: p.page, size: SIZE }), [filters, p.page]);
  const list = useQuery({ queryKey: ['admin', 'learning', 'completion-data', query], queryFn: ({ signal }) => adminLearningApi.completionData(query, signal), placeholderData: keepPreviousData, enabled: p.go === 1 });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;
  const { toast } = useToast();
  const [memberLink, memberDrawer] = useMemberInfo();
  /** function.js CourseDataSearch(): 사업주명 required in 사업주 검색; 실시회차 digits and ≥ 1. */
  const check = (t: TermForm, oc: string) => {
    const err = termValidationError(t) ?? (oc && !/^\d+$/.test(oc) ? tr('실시회차는 숫자만 입력하세요.', 'Round must be a number.') : oc && Number(oc) < 1 ? tr('실시회차는 1이상 숫자만 입력하세요.', 'Round must be 1 or more.') : null);
    if (err) toast(err, { tone: 'danger' });
    return !err;
  };
  const submit = (t: TermForm = term) => { if (check(t, openChapter)) setP({ ...termToParams(t), openChapter, go: 1 }, true); };
  const commit = (t: TermForm) => { setTerm(t); if (t.searchGubun === 'A' || t.companyName) submit(t); };
  /** Export with the current form values (the PHP posted the form), after its confirm. */
  const exportCsv = () => { if (!check(term, openChapter)) return; if (!EXPORT_CONFIRM()) return; void download(() => adminLearningApi.downloadCompletionXlsx({ ...termQuery(termToParams(term)), openChapter: openChapter || undefined })); };
  const columns: Column<CompletionRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => firstNo - i },
    { key: 'name', header: tr('훈련생명', 'Trainee'), nowrap: true, render: (r) => memberLink(r.id, r.name ?? '') },
    { key: 'id', header: tr('훈련생 아이디', 'Trainee ID'), nowrap: true, render: (r) => memberLink(r.id) },
    { key: 'category1', header: tr('분야', 'Field'), render: (r) => r.category1 ?? '' },
    { key: 'keyword2Name', header: tr('직무분야', 'Job field'), render: (r) => r.keyword2Name ?? '' },
    { key: 'ncsCode', header: tr('NCS분류', 'NCS'), nowrap: true, render: (r) => <span className="mono">{r.ncsCode}</span> },
    { key: 'serviceTypeLabel', header: tr('과정구분', 'Type'), nowrap: true },
    { key: 'lectureCode', header: tr('훈련과정ID', 'Course ID'), nowrap: true, render: (r) => <span className="mono">{r.lectureCode}</span> },
    { key: 'courseName', header: tr('과정명', 'Course') },
    { key: 'contentsTime', header: tr('총 훈련시간(분)', 'Total (min)'), align: 'right', nowrap: true, render: (r) => tr(`${r.contentsTime ?? 0}분`, String(r.contentsTime ?? 0)) },
    { key: 'studyMinutes', header: tr('이수시간(분)', 'Studied (min)'), align: 'right', nowrap: true, render: (r) => tr(`${r.studyMinutes}분`, String(r.studyMinutes)) },
    { key: 'rate', header: tr('이수율', 'Rate'), align: 'right', nowrap: true, render: (r) => `${r.rate}%` },
    { key: 'studySeq', header: 'Seq', align: 'right', render: (r) => <StudyLink seq={r.studySeq} /> },
  ];
  return (
    <AdminPage title={tr('과정 이수데이터 관리', 'Completion data')} lead={tr('훈련생 × 차시(Progress) 단위 이수 데이터입니다. 이수시간 = 저장된 StudyTime(분), 이수율 = 이수시간 / 총 훈련시간. 엑셀 출력은 "개인별 과정 이수 데이터" 양식(훈련생 × 콘텐츠 합계)입니다.', 'Per trainee × chapter rows. Studied minutes = stored StudyTime; rate = minutes / content minutes. The Excel file (.xlsx) follows the per-trainee × content template.')}>
      <FilterBar onSubmit={() => submit()} onReset={() => { setTerm(termFromParams(DEFAULTS)); setOpenChapter(''); reset(); }}
        extra={<AButton onClick={exportCsv} loading={exporting}>{tr('검색 결과 엑셀 출력', 'Export Excel')}</AButton>}>
        <TermSearchFields value={term} onChange={setTerm} onCommit={commit} options={options.data} idPrefix="cd" />
        <FilterField label={tr('실시회차', 'Round')} htmlFor="cd-oc" width={100}><AInput id="cd-oc" value={openChapter} inputMode="numeric" onChange={(e) => setOpenChapter(e.target.value.replace(/\D/g, ''))} /></FilterField>
      </FilterBar>
      {p.go !== 1 ? <PendingHint /> : (
        <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.progressIdx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} emptyTitle={tr('검색된 내용이 없습니다.', 'No results.')} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} dense />
      )}
      {memberDrawer}
    </AdminPage>
  );
}
