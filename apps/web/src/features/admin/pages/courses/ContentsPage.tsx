import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminCoursesParityApi as cp, type CpContentsRow } from '../../../../shared/api/endpoints/admin-courses-parity';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, DataTable, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useWriteGate } from '../../GrantGate';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';
import { useRememberListSearch } from './courses-parity.shared';
import { AnyGrantGate, G } from './courses-parity.grants';

const DEFAULTS = { gubun: '', col: 'ContentsTitle', q: '', page: 1 };
/** include_top.php $page_size = 30 (contents.php). */
export const SIZE = 30;

/** contents.php — 기초차시 관리 목록 (차시구분 / 검색 항목 / 검색어, Gubun ASC · idx ASC). */
function ContentsPageBody() {
  const [p, setP] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ gubun: p.gubun, col: p.col, q: p.q });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const [exporting, setExporting] = useState(false);
  useRememberListSearch('contents');
  const opts = useQuery({ queryKey: ['admin', 'contents-options', '', ''], queryFn: ({ signal }) => cp.contentsOptions({}, signal), staleTime: 5 * 60_000 });
  const filter = useMemo(() => ({ gubun: p.gubun || undefined, col: p.q ? p.col : undefined, q: p.q || undefined }), [p]);
  const query = useMemo(() => ({ ...filter, page: p.page, size: SIZE }), [filter, p.page]);
  const list = useQuery({ queryKey: ['admin', 'contents', query], queryFn: ({ signal }) => cp.contents(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  const columns: Column<CpContentsRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'center', width: 70, render: (_r, i) => total - (p.page - 1) * SIZE - i },
    { key: 'gubun', header: tr('차시 구분', '차시 구분'), width: 300, render: (r) => r.gubun ?? '' },
    { key: 'title', header: tr('차시명', 'Title'), render: (r) => <b>{r.title}</b> },
    { key: 'lectureTimeMin', header: tr('수강시간(분)', 'Minutes'), align: 'center', width: 100, render: (r) => (r.lectureTimeMin ?? '') as number | string },
    { key: 'regDate', header: tr('등록일', 'Registered'), nowrap: true, width: 150, render: (r) => r.regDate ?? '' },
    { key: 'detailCount', header: tr('하부 컨텐츠수', 'Pages'), align: 'center', width: 110 },
    { key: 'idx', header: <span style={{ color: 'var(--danger, #c00)' }}>idx</span>, align: 'center', width: 80, render: (r) => <span className="mono" style={{ color: 'var(--danger, #c00)' }}>{r.idx}</span> },
  ];
  const download = async () => { setExporting(true); try { await cp.downloadContentsCsv(filter); } catch { toast(adm.companies.actions.exportFailed, { tone: 'danger' }); } finally { setExporting(false); } };
  return (
    <AdminPage title={tr('기초차시 관리', 'Base contents')} lead={tr('차시구분과 검색 항목(차시명/차시목표/훈련내용/학습활동)으로 찾습니다. 행을 누르면 상세 구성으로 이동합니다.', 'Filter by 차시 구분 and field. Click a row for its page composition.')}
      actions={<>
        <AButton onClick={() => void download()} loading={exporting}>{tr('검색항목 엑셀 출력', 'Export search result')}</AButton>
        <AButton disabled={!canWrite} title={readOnlyTitle} onClick={() => navigate('/admin/contents/excel')}>{tr('엑셀로 기초차시 등록', 'Register from Excel')}</AButton>
        <AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => navigate('/admin/contents/new')}>{tr('신규 등록', 'New')}</AButton>
      </>}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ gubun: '', col: 'ContentsTitle', q: '' }); setP({ gubun: '', col: 'ContentsTitle', q: '' }, true); }}>
        <FilterField label={tr('차시구분', '차시 구분')} htmlFor="ct-g" width={320}><ASelect id="ct-g" value={form.gubun} onChange={(e) => setForm({ ...form, gubun: e.target.value })} options={[{ value: '', label: tr('-- 차시구분 선택 --', '-- all --') }, ...(opts.data?.gubuns ?? []).map((g) => ({ value: g, label: g }))]} /></FilterField>
        <FilterField label={tr('검색 항목', 'Field')} htmlFor="ct-col" width={140}><ASelect id="ct-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'ContentsTitle', label: tr('차시명', 'Title') }, { value: 'Expl01', label: tr('차시목표', 'Goals') }, { value: 'Expl02', label: tr('훈련내용', 'Training') }, { value: 'Expl03', label: tr('학습활동', 'Activities') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Search')} htmlFor="ct-q" width={300}><AInput id="ct-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={list.data?.total} onPageChange={(n) => setP({ page: n })} onRowClick={(r) => navigate(`/admin/contents/${r.idx}`)} emptyTitle={tr('등록된 기초차시가 없습니다.', 'No base contents.')} dense />
    </AdminPage>
  );
}

/** 기초차시 관리 (contents.php): menu D2. */
export default function ContentsPage() {
  return <AnyGrantGate grants={G.contents}><ContentsPageBody /></AnyGrantGate>;
}
