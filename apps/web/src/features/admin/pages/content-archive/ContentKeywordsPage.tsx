import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminContentArchiveApi as apiX, type KeywordCategory, type KeywordRow } from '../../../../shared/api/endpoints/admin-content-archive';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Card, ConfirmDialog, DataTable, DetailDrawer, FieldRow, YnBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { GrantGate, useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';

const DEFAULTS = { category: '' };

/** contents_keyword.php → contents_keyword_read.php (+ _write / _script) — 컨텐츠 키워드 관리, grant E4. */
export default function ContentKeywordsPage() {
  return <GrantGate grant="E4"><Keywords /></GrantGate>;
}

function Keywords() {
  const [p, setP] = useSearchState(DEFAULTS);
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const cats = useQuery({ queryKey: ['admin', 'content-keywords', 'categories'], queryFn: ({ signal }) => apiX.keywordCategories(signal) });
  const list = useQuery({ queryKey: ['admin', 'content-keywords', p.category], queryFn: ({ signal }) => apiX.keywords(p.category, signal), enabled: !!p.category });
  const inv = [['admin', 'content-keywords']];
  const onErr = (err: unknown) => { if (isAppError(err) && Array.isArray(err.details)) { const e: Record<string, string> = {}; for (const d of err.details as { path?: string | string[]; message?: string }[]) { const k = Array.isArray(d.path) ? d.path.join('.') : d.path; if (k) e[k] = d.message ?? ''; } setErrors(e); } toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); };

  // ordering ("정렬하기" — up/down instead of drag)
  const [order, setOrder] = useState<number[] | null>(null);
  useEffect(() => { setOrder(null); }, [list.data]);
  const rowsById = useMemo(() => new Map((list.data?.items ?? []).map((r) => [r.idx, r])), [list.data]);
  const orderList = order ?? (list.data?.items ?? []).map((r) => r.idx);
  const rows = useMemo(() => orderList.map((idx) => rowsById.get(idx)).filter((r): r is KeywordRow => !!r), [orderList, rowsById]);
  const move = (idx: number, dir: -1 | 1) => { const i = orderList.indexOf(idx); const j = i + dir; if (i < 0 || j < 0 || j >= orderList.length) return; const next = [...orderList]; [next[i], next[j]] = [next[j]!, next[i]!]; setOrder(next); };
  const reorder = useAdminMutation({ fn: (ids: number[]) => apiX.reorderKeywords(p.category, ids), invalidate: inv, success: tr('정렬을 저장했습니다.', 'Order saved.'), onSuccess: () => setOrder(null) });
  /** contents_keyword_read.php "정렬하기": works without moving anything (numbers every row 1..n — new keywords have no OrderByNum yet). */
  const saveOrder = () => {
    if (!orderList.length) { toast(tr('등록된 컨텐츠 키워드가 없습니다.', 'There are no keywords in this category.'), { tone: 'danger' }); return; }
    if (!window.confirm(tr('정렬하시겠습니까?', 'Save this order?'))) return;
    reorder.mutate(orderList);
  };

  // create / edit / delete
  const [edit, setEdit] = useState<{ mode: 'create' } | { mode: 'edit'; row: KeywordRow } | null>(null);
  const [f, setF] = useState({ Keyword: '', UseYN: 'Y' as 'Y' | 'N' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (edit?.mode === 'edit') setF({ Keyword: edit.row.keyword, UseYN: edit.row.useYN === 'N' ? 'N' : 'Y' }); if (edit?.mode === 'create') setF({ Keyword: '', UseYN: 'Y' }); setErrors({}); }, [edit]);
  const create = useAdminMutation({ fn: (b: { Category: string; Keyword: string; UseYN: 'Y' | 'N' }) => apiX.createKeyword(b), invalidate: inv, success: adm.common.created, onSuccess: () => setEdit(null), onError: onErr });
  const patch = useAdminMutation({ fn: (v: { idx: number; body: { Keyword: string; UseYN: 'Y' | 'N' } }) => apiX.patchKeyword(v.idx, v.body), invalidate: inv, success: adm.common.saved, onSuccess: () => setEdit(null), onError: onErr });
  const [del, setDel] = useState<KeywordRow | null>(null);
  const remove = useAdminMutation({ fn: (idx: number) => apiX.deleteKeyword(idx), invalidate: inv, success: adm.common.deleted, onSuccess: () => { setDel(null); setEdit(null); } });
  const submit = () => {
    const kw = f.Keyword.trim();
    if (!kw) { setErrors({ Keyword: tr('키워드를 입력하세요.', 'Enter the keyword.') }); return; }
    // contents_keyword_write.php SubmitOk(): the same confirm for 등록 and 수정
    if (!window.confirm(tr('등록하시겠습니까?', 'Save this keyword?'))) return;
    if (edit?.mode === 'create') create.mutate({ Category: p.category, Keyword: kw, UseYN: f.UseYN }); else if (edit?.mode === 'edit') patch.mutate({ idx: edit.row.idx, body: { Keyword: kw, UseYN: f.UseYN } });
  };

  const catCols: Column<KeywordCategory>[] = [
    { key: 'category', header: tr('번호', 'No.'), align: 'right', width: 60 },
    { key: 'label', header: tr('과정분류', 'Category'), render: (r) => <b>{r.label}</b> },
    // contents_keyword.php: COUNT(Category) — deleted rows included, as the old page shows it; the live count is the tooltip
    { key: 'count', header: tr('키워드개수', 'Keywords'), align: 'right', render: (r) => <span title={tr(`사용 중(삭제 제외) ${r.activeCount}건`, `${r.activeCount} not deleted`)}>{r.count.toLocaleString()}</span> },
  ];
  const kwCols: Column<KeywordRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => i + 1 },
    { key: 'order', header: tr('정렬순서', 'Order'), align: 'right', width: 80, render: (r) => r.order ?? '' },
    { key: 'keyword', header: tr('키워드', 'Keyword'), render: (r) => <a href="#edit" onClick={(e) => { e.preventDefault(); setEdit({ mode: 'edit', row: r }); }}><b>{r.keyword}</b></a> },
    { key: 'useYN', header: tr('사이트노출', 'Visible'), align: 'center', render: (r) => <YnBadge value={r.useYN} yes={tr('사용', 'Yes')} no={tr('미사용', 'No')} /> },
    { key: 'regDate', header: tr('등록일자', 'Registered'), nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'mdfDate', header: tr('수정일자', 'Modified'), nowrap: true, render: (r) => r.mdfDate ?? '' },
    { key: 'idx', header: 'idx', align: 'right', width: 70, render: (r) => <span className="mono">{r.idx}</span> },
    { key: 'move', header: tr('이동', 'Move'), align: 'center', width: 90, render: (r, i) => <span style={{ display: 'inline-flex', gap: 4 }}><AButton size="xs" disabled={!canWrite || i === 0} aria-label={tr('위로', 'Up')} onClick={() => move(r.idx, -1)}>▲</AButton><AButton size="xs" disabled={!canWrite || i === rows.length - 1} aria-label={tr('아래로', 'Down')} onClick={() => move(r.idx, 1)}>▼</AButton></span> },
  ];
  const catLabel = cats.data?.items.find((c) => c.category === p.category)?.label ?? list.data?.label ?? '';
  return (
    <AdminPage title={tr('컨텐츠 키워드 관리', 'Content keywords')} lead={tr('과정분류(직급/직무분야/관심분야/역량)별 키워드를 등록·수정·정렬합니다. 분류를 선택하면 키워드 목록이 열립니다.', 'Keywords per category (직급/직무분야/관심분야/역량). Pick a category to open its list.')}
      actions={p.category ? <AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => setEdit({ mode: 'create' })}>{tr('추가 하기', 'Add keyword')}</AButton> : undefined}>
      <div style={{ display: 'grid', gridTemplateColumns: p.category ? '320px minmax(0,1fr)' : '1fr', gap: 12, alignItems: 'start' }}>
        <Card title={tr('과정분류', 'Categories')}>
          <DataTable columns={catCols} rows={cats.data?.items} rowKey={(r) => r.category} loading={cats.isPending} error={cats.error} onRetry={() => void cats.refetch()} onRowClick={(r) => setP({ category: r.category })} selectedKey={p.category || null} dense />
        </Card>
        {p.category ? (
          <Card title={`${tr('키워드', 'Keywords')} — ${catLabel}`} aside={<AButton size="sm" variant="primary" disabled={!canWrite || list.isPending} title={readOnlyTitle} loading={reorder.isPending} onClick={saveOrder}>{tr('정렬하기', 'Save order')}</AButton>}>
            <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>{tr('"정렬하기"를 누르면 보이는 순서대로 정렬순서(OrderByNum)가 1부터 다시 매겨집니다(새로 추가한 키워드도 번호를 받습니다). ▲▼로 순서를 바꿀 수 있고, 키워드를 누르면 수정합니다.', '"Save order" renumbers OrderByNum from 1 in the order shown (new keywords get a number too). Move rows with ▲▼; click a keyword to edit it.')}</p>
            <DataTable columns={kwCols} rows={rows} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} emptyTitle={tr('등록된 컨텐츠 키워드가 없습니다.', 'No keywords in this category.')} dense />
          </Card>
        ) : null}
      </div>

      <DetailDrawer open={!!edit} onClose={() => setEdit(null)} title={edit?.mode === 'create' ? tr('컨텐츠 키워드 등록', 'New keyword') : tr('컨텐츠 키워드 수정', 'Edit keyword')} subtitle={catLabel}
        footer={<><AButton onClick={() => setEdit(null)}>{adm.common.cancel}</AButton>{edit?.mode === 'edit' ? <AButton variant="danger" disabled={!canWrite} onClick={() => setDel(edit.row)}>{adm.common.delete}</AButton> : null}<AButton variant="primary" loading={create.isPending || patch.isPending} disabled={!canWrite} onClick={submit}>{edit?.mode === 'create' ? adm.common.create : adm.common.save}</AButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldRow label={tr('과정분류', 'Category')}><div style={{ paddingTop: 8 }}><b>{catLabel}</b></div></FieldRow>
          <FieldRow label={tr('키워드', 'Keyword')} htmlFor="kw-name" required error={errors.Keyword}><AInput id="kw-name" value={f.Keyword} onChange={(e) => setF({ ...f, Keyword: e.target.value })} maxLength={100} /></FieldRow>
          <FieldRow label={tr('사용여부', 'Visible')}><ASelect aria-label={tr('사용여부', 'Visible')} value={f.UseYN} onChange={(e) => setF({ ...f, UseYN: e.target.value as 'Y' | 'N' })} options={[{ value: 'Y', label: tr('사용', 'Yes') }, { value: 'N', label: tr('미사용', 'No') }]} /></FieldRow>
        </div>
      </DetailDrawer>
      <ConfirmDialog open={!!del} title={tr('키워드 삭제', 'Delete keyword')} tone="danger" loading={remove.isPending} onCancel={() => setDel(null)} onConfirm={() => del && remove.mutate(del.idx)} body={<p>{tr('삭제 처리(Del=Y)합니다. 행은 남고 목록에서만 사라집니다.', 'Marks the keyword deleted (Del=Y); the row stays in the table.')} <b>{del?.keyword}</b></p>} />
    </AdminPage>
  );
}
