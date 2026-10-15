import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminSupportParityApi, FAQ_CATEGORIES, type FaqRow } from '../../../../shared/api/endpoints/admin-support-parity';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, FieldRow, FilterBar, FilterField, TabStrip, type Column } from '../../../../shared/ui/admin';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { PHP_PAGE_SIZE, rowNo, toEditorHtml, tooShort } from './support-parity.helpers';
import { SupportRichEditor } from './SupportRichEditor';
import { SupportSubmitConfirm, useSubmitConfirm } from './SupportSubmitConfirm';

const DEFAULTS = { col: 'Title', q: '', category: '', page: 1 };
/** include_top.php $page_size = 30. */
const SIZE = PHP_PAGE_SIZE;
interface Form { UseYN: 'Y' | 'N'; OrderByNum: string; Category: string; Title: string; Content: string }
const ynMsg = (v: string | null | undefined) => <span style={{ color: v === 'Y' ? 'var(--c-primary)' : 'var(--c-danger)' }}>{v === 'Y' ? tr('사용', 'In use') : tr('미사용', 'Not used')}</span>;

/** faq.php / faq_read.php / faq_write.php / faq_script.php — 커뮤니티관리 > 자주 묻는 질문 (F2). */
export default function FaqsPage() {
  const { canWrite, readOnlyTitle } = useWriteGate();
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, category: p.category || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'faqs', query], queryFn: ({ signal }) => adminSupportParityApi.faqs(query, signal), placeholderData: keepPreviousData });
  const meta = useQuery({ queryKey: ['admin', 'faqs', 'meta'], queryFn: ({ signal }) => adminSupportParityApi.faqMeta(signal) });
  const categories = meta.data?.categories ?? FAQ_CATEGORIES;
  const total = list.data?.total ?? 0;

  const [sel, setSel] = useState<number | null>(null);
  const [editing, setEditing] = useState<'new' | 'edit' | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'faq', sel], queryFn: ({ signal }) => adminSupportParityApi.faq(sel!, signal), enabled: sel !== null });
  const d = detail.data;
  const [f, setF] = useState<Form>({ UseYN: 'Y', OrderByNum: '', Category: 'A', Title: '', Content: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (editing === 'new') setF({ UseYN: 'Y', OrderByNum: String(meta.data?.nextOrder ?? ''), Category: categories[0]?.value ?? 'A', Title: '', Content: '' });
    if (editing === 'edit' && d) setF({ UseYN: d.useYN === 'N' ? 'N' : 'Y', OrderByNum: String(d.order || ''), Category: d.category ?? 'A', Title: d.title, Content: toEditorHtml(d.content) });
    setErrors({});
  }, [editing, d]); // categories/meta only seed the new form
  const inv = [['admin', 'faqs'], ['admin', 'faq'], ['support']];
  const body = () => ({ UseYN: f.UseYN, OrderByNum: Number(f.OrderByNum) || 0, Category: f.Category, Title: f.Title.trim(), Content: f.Content });
  const done = tr('처리되었습니다.', 'Done.');
  const create = useAdminMutation({ fn: () => adminSupportParityApi.createFaq(body()), invalidate: inv, success: done, onSuccess: (r) => { setEditing(null); setSel(r.idx); } });
  const update = useAdminMutation({ fn: () => adminSupportParityApi.updateFaq(sel!, body()), invalidate: inv, success: done, onSuccess: () => setEditing(null) });
  const [delOpen, setDelOpen] = useState(false);
  const remove = useAdminMutation({ fn: () => adminSupportParityApi.deleteFaq(sel!), invalidate: inv, success: done, onSuccess: () => { setDelOpen(false); setSel(null); } });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.Title.trim()) e.Title = tr('제목을 입력하세요.', 'Enter a title.');
    if (tooShort(f.Content)) e.Content = tr('내용을 15자 이상 입력해주세요', 'Enter at least 15 characters.');
    if (f.OrderByNum && !/^\d+$/.test(f.OrderByNum)) e.OrderByNum = tr('숫자만 입력하세요.', 'Digits only.');
    setErrors(e); if (Object.keys(e).length) return;
    confirmSave.ask(); // faq_write.php SubmitOk(): confirm("등록하시겠습니까?")
  };
  const confirmSave = useSubmitConfirm();
  const doSave = () => (editing === 'new' ? create : update).mutate(undefined as never, { onSettled: confirmSave.close });

  const columns: Column<FaqRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'center', width: 80, render: (_r, i) => rowNo(total, p.page, SIZE, i) },
    { key: 'order', header: tr('정렬 순서', 'Order'), align: 'center', width: 80 },
    { key: 'categoryLabel', header: tr('구분', 'Category'), width: 120, render: (r) => r.categoryLabel || r.category || '' },
    { key: 'title', header: tr('제목', 'Title'), render: (r) => <b>{r.title}</b> },
    { key: 'regDate', header: tr('등록일', 'Registered'), width: 150, nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'useYN', header: tr('사용 유무', 'Active'), align: 'center', width: 80, render: (r) => ynMsg(r.useYN) },
  ];
  const newBtn = <AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => { setSel(null); setEditing('new'); }}>{tr('신규 등록', 'New')}</AButton>;
  return (
    <AdminPage title={tr('자주 묻는 질문', 'FAQ')} actions={newBtn}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'Title', q: '' }); reset(); }}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="fq-col" width={120}><ASelect id="fq-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'Title', label: tr('제목', 'Title') }, { value: 'Content', label: tr('내용', 'Content') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="fq-q" width={300}><AInput id="fq-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <TabStrip label={tr('구분', 'Category')} value={p.category || 'ALL'} onChange={(k) => setP({ category: k === 'ALL' ? '' : k }, true)} items={[{ key: 'ALL', label: tr('전체', 'All') }, ...categories.map((c) => ({ key: c.value, label: c.label }))]} />
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(x) => setP({ page: x })} onRowClick={(r) => { setEditing(null); setSel(r.idx); }} selectedKey={sel} emptyTitle={tr('등록된 내용이 없습니다.', 'Nothing registered.')} dense />

      {/* faq_read.php */}
      <DetailDrawer open={sel !== null && !editing} onClose={() => setSel(null)} title={d?.title ?? tr('자주 묻는 질문', 'FAQ')} wide
        footer={<><AButton variant="danger" disabled={!canWrite || !d} title={readOnlyTitle} onClick={() => setDelOpen(true)}>{tr('삭 제', 'Delete')}</AButton><AButton variant="primary" disabled={!canWrite || !d} title={readOnlyTitle} onClick={() => setEditing('edit')}>{tr('정보 수정', 'Edit')}</AButton><AButton onClick={() => setSel(null)}>{tr('목록', 'List')}</AButton></>}>
        {d ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card><DescList items={[[tr('제목', 'Title'), d.title], [tr('분류', 'Category'), d.categoryLabel], [tr('정렬 순서', 'Order'), d.order], [tr('사용 유무', 'Active'), ynMsg(d.useYN)], [tr('등록일', 'Registered'), d.regDate]]} /></Card>
            <Card title={tr('내용', 'Content')}><div style={{ lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: d.content ?? '' }} /></Card>
          </div>
        ) : detail.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>

      {/* faq_write.php */}
      <DetailDrawer open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? tr('자주 묻는 질문 등록', 'New FAQ') : tr('자주 묻는 질문 수정', 'Edit FAQ')} wide
        footer={<><AButton onClick={() => setEditing(null)}>{tr('목록', 'List')}</AButton><AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} loading={create.isPending || update.isPending} onClick={submit}>{editing === 'new' ? tr('등록', 'Create') : tr('수정', 'Save')}</AButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldRow label={tr('사용 여부', 'Active')} htmlFor="ff-use"><ASelect id="ff-use" value={f.UseYN} onChange={(e) => setF({ ...f, UseYN: e.target.value as 'Y' | 'N' })} options={[{ value: 'N', label: tr('미사용', 'Not used') }, { value: 'Y', label: tr('사용', 'In use') }]} disabled={!canWrite} /></FieldRow>
          <FieldRow label={tr('정렬 순서', 'Order')} htmlFor="ff-order" error={errors.OrderByNum} help={tr('비우면 마지막 순서(MAX+1)로 저장됩니다.', 'Empty = last (MAX+1).')}><AInput id="ff-order" inputMode="numeric" value={f.OrderByNum} onChange={(e) => setF({ ...f, OrderByNum: e.target.value })} style={{ width: 100 }} disabled={!canWrite} /></FieldRow>
          <FieldRow label={tr('분류', 'Category')} htmlFor="ff-cat"><ASelect id="ff-cat" value={f.Category} onChange={(e) => setF({ ...f, Category: e.target.value })} options={categories} disabled={!canWrite} /></FieldRow>
          <FieldRow label={tr('제목', 'Title')} htmlFor="ff-title" required error={errors.Title}><AInput id="ff-title" value={f.Title} onChange={(e) => setF({ ...f, Title: e.target.value })} maxLength={250} disabled={!canWrite} /></FieldRow>
          <FieldRow label={tr('내용', 'Content')} htmlFor="ff-content" required error={errors.Content} help={tr('Editor / HTML / TEXT 모드(기존 스마트에디터와 같음), 15자 이상', 'Editor / HTML / TEXT modes (as SmartEditor), 15+ characters')}><SupportRichEditor id="ff-content" ariaLabel={tr('내용', 'Content')} value={f.Content} onChange={(html) => setF((x) => ({ ...x, Content: html }))} disabled={!canWrite} invalid={!!errors.Content} /></FieldRow>
        </div>
      </DetailDrawer>
      <SupportSubmitConfirm open={confirmSave.open} loading={create.isPending || update.isPending} onCancel={confirmSave.close} onConfirm={doSave} />
      <ConfirmDialog open={delOpen} title={tr('FAQ 삭제', 'Delete FAQ')} body={tr('현재 글을 삭제하시겠습니까?', 'Delete this post?')} tone="danger" confirmLabel={tr('삭 제', 'Delete')} loading={remove.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => remove.mutate(undefined as never)} />
    </AdminPage>
  );
}
