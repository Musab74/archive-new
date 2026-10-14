import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminLearningApi, type NegativeRow } from '../../../../shared/api/endpoints/admin-learning';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, ATextarea, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, FieldRow, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';

const DEFAULTS = { col: 'CompanyName', q: '', page: 1 };
const SIZE = 30;

/** negative_training.php — 리포트 부정훈련 (B4): list, detail, create (CompanyCode + Content), edit (Content), soft delete. */
export default function NegativeTrainingPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'learning', 'negative-trainings', query], queryFn: ({ signal }) => adminLearningApi.negatives(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;

  const [sel, setSel] = useState<NegativeRow | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'learning', 'negative-training', sel?.idx], queryFn: ({ signal }) => adminLearningApi.negative(sel!.idx, signal), enabled: !!sel });
  const [mode, setMode] = useState<'create' | 'edit' | null>(null);
  const [f, setF] = useState({ CompanyCode: '', Content: '' });
  const [err, setErr] = useState('');
  useEffect(() => { if (mode === 'create') setF({ CompanyCode: '', Content: '' }); if (mode === 'edit' && sel) setF({ CompanyCode: sel.companyCode, Content: detail.data?.content ?? sel.content }); setErr(''); }, [mode, sel, detail.data]);
  const inv = [['admin', 'learning', 'negative-trainings']];
  const create = useAdminMutation({ fn: (b: { CompanyCode: string; Content: string }) => adminLearningApi.createNegative(b), invalidate: inv, success: tr('처리되었습니다.', 'Saved.'), onSuccess: () => setMode(null) });
  const patch = useAdminMutation({ fn: (b: { Content: string }) => adminLearningApi.patchNegative(sel!.idx, b), invalidate: [...inv, ['admin', 'learning', 'negative-training', sel?.idx]], success: tr('처리되었습니다.', 'Saved.'), onSuccess: () => setMode(null) });
  const [delOpen, setDelOpen] = useState(false);
  const del = useAdminMutation({ fn: () => adminLearningApi.deleteNegative(sel!.idx), invalidate: inv, success: tr('처리되었습니다.', 'Deleted.'), onSuccess: () => { setDelOpen(false); setSel(null); } });
  const submit = () => {
    if (mode === 'create' && !f.CompanyCode.trim()) { setErr(tr('사업주 ID를 입력하세요.', 'Enter the company ID.')); return; }
    if (mode === 'create') create.mutate({ CompanyCode: f.CompanyCode.trim(), Content: f.Content }); else patch.mutate({ Content: f.Content });
  };

  const columns: Column<NegativeRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => firstNo - i },
    { key: 'companyName', header: tr('사업주', 'Company'), nowrap: true, render: (r) => <span title={r.companyCode}>{r.companyName ?? r.companyCode}</span> },
    { key: 'content', header: tr('내용', 'Content'), render: (r) => <span className="u-clamp-2">{r.content}</span> },
    { key: 'regDate', header: tr('등록일', 'Registered'), nowrap: true, width: 170, render: (r) => r.regDate ?? '' },
  ];
  const d = detail.data ?? sel;
  return (
    <AdminPage title={tr('리포트 부정훈련', 'Misconduct report')} lead={tr('사업주별 부정훈련 리포트 메모(NegativeTraining)입니다. 행을 누르면 상세가 열립니다.', 'Per-company misconduct report notes (NegativeTraining). Click a row for details.')}
      actions={<AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => { setSel(null); setMode('create'); }}>{tr('신규 등록', 'New')}</AButton>}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'CompanyName', q: '' }); reset(); }}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="nt-col" width={130}><ASelect id="nt-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'CompanyName', label: tr('사업주명', 'Company') }, { value: 'Content', label: tr('내용', 'Content') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="nt-q" width={260}><AInput id="nt-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} emptyTitle={tr('등록된 내용이 없습니다.', 'No records.')} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={setSel} selectedKey={sel?.idx ?? null} dense />

      <DetailDrawer open={!!sel && !mode} onClose={() => setSel(null)} title={tr('리포트 부정훈련', 'Misconduct report')} subtitle={d?.companyName ?? ''}
        footer={<><AButton variant="danger" disabled={!canWrite} title={readOnlyTitle} onClick={() => setDelOpen(true)}>{tr('삭 제', 'Delete')}</AButton><AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => setMode('edit')}>{tr('정보 수정', 'Edit')}</AButton><AButton onClick={() => setSel(null)}>{tr('목록', 'List')}</AButton></>}>
        {d ? (<Card><DescList items={[[tr('사업주 명', 'Company'), d.companyName], [tr('사업주 ID', 'Company ID'), <span key="c" className="mono">{d.companyCode}</span>], [tr('등록일', 'Registered'), d.regDate], [tr('내용', 'Content'), <div key="t" style={{ whiteSpace: 'pre-wrap' }}>{d.content}</div>]]} /></Card>) : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>

      <DetailDrawer open={!!mode} onClose={() => setMode(null)} title={mode === 'create' ? tr('리포트 부정훈련 등록', 'New misconduct report') : tr('리포트 부정훈련 수정', 'Edit misconduct report')}
        footer={<><AButton onClick={() => setMode(null)}>{tr('목록', 'List')}</AButton><AButton variant="primary" loading={create.isPending || patch.isPending} disabled={!canWrite} onClick={submit}>{mode === 'create' ? tr('등록', 'Create') : tr('수정', 'Save')}</AButton></>}>
        <div style={{ display: 'grid', gap: 10 }}>
          <FieldRow label={tr('사업주 ID', 'Company ID')} htmlFor="nt-cc" required={mode === 'create'} error={err}>{mode === 'create' ? <AInput id="nt-cc" value={f.CompanyCode} maxLength={20} onChange={(e) => setF({ ...f, CompanyCode: e.target.value })} /> : <div style={{ paddingTop: 8 }}><b className="mono">{f.CompanyCode}</b></div>}</FieldRow>
          <FieldRow label={tr('내용', 'Content')} htmlFor="nt-content"><ATextarea id="nt-content" rows={8} value={f.Content} onChange={(e) => setF({ ...f, Content: e.target.value })} /></FieldRow>
        </div>
      </DetailDrawer>
      <ConfirmDialog open={delOpen} tone="danger" title={tr('현재 글을 삭제하시겠습니까?', 'Delete this report?')} body={tr('목록에서 제외됩니다(Del=Y). 행은 남습니다.', 'Hidden from the list (Del=Y); the row is kept.')} loading={del.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => del.mutate(undefined as never)} />
    </AdminPage>
  );
}
