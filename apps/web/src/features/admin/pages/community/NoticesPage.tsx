import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminSupportParityApi, type NoticeRow } from '../../../../shared/api/endpoints/admin-support-parity';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Callout, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, FieldRow, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { PHP_PAGE_SIZE, rowNo, toEditorHtml, tooShort } from './support-parity.helpers';
import { SupportRichEditor } from './SupportRichEditor';
import { SupportSubmitConfirm, useSubmitConfirm } from './SupportSubmitConfirm';

const DEFAULTS = { col: 'Title', q: '', page: 1 };
/** include_top.php $page_size = 30. */
const SIZE = PHP_PAGE_SIZE;
const SLOTS = [1, 2, 3, 4, 5] as const;
interface Form { Notice: 'Y' | 'N'; UseYN: 'Y' | 'N'; Title: string; Content: string }
const EMPTY: Form = { Notice: 'N', UseYN: 'Y', Title: '', Content: '' };
const ynMsg = (v: string | null | undefined) => <span style={{ color: v === 'Y' ? 'var(--c-primary)' : 'var(--c-danger)' }}>{v === 'Y' ? tr('사용', 'In use') : tr('미사용', 'Not used')}</span>;

/** notice.php / notice_read.php / notice_write.php / notice_script.php — 커뮤니티관리 > 공지사항 (F1). */
export default function NoticesPage() {
  const { canWrite, readOnlyTitle } = useWriteGate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'notices', query], queryFn: ({ signal }) => adminSupportParityApi.notices(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  const pinnedCount = list.data?.pinned.length ?? 0;
  const rows = useMemo(() => (list.data ? [...list.data.pinned, ...list.data.items] : undefined), [list.data]);

  const [sel, setSel] = useState<number | null>(null);
  const [editing, setEditing] = useState<'new' | 'edit' | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'notice', sel], queryFn: ({ signal }) => adminSupportParityApi.notice(sel!, signal), enabled: sel !== null });
  const d = detail.data;
  const [f, setF] = useState<Form>(EMPTY);
  const [files, setFiles] = useState<Record<number, File | null>>({});
  const [clear, setClear] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (editing === 'new') setF(EMPTY);
    if (editing === 'edit' && d) setF({ Notice: d.pinned ? 'Y' : 'N', UseYN: d.useYN === 'N' ? 'N' : 'Y', Title: d.title, Content: toEditorHtml(d.content) });
    setFiles({}); setClear([]); setErrors({});
  }, [editing, d]);
  const inv = [['admin', 'notices'], ['admin', 'notice'], ['support']];

  /** PHP uploads each file through the popup before saving; here the row is saved first and each chosen file follows (same columns). */
  const uploadChosen = async (idx: number) => {
    const picked = SLOTS.filter((s) => files[s]);
    for (const s of picked) { try { await adminSupportParityApi.uploadNoticeFile(idx, s, files[s]!); } catch (e) { toast(`${tr('첨부파일', 'Attachment')} ${s}: ${isAppError(e) ? e.message : adm.common.failed}`, { tone: 'danger' }); } }
    if (picked.length) for (const k of inv) void qc.invalidateQueries({ queryKey: k });
  };
  const body = () => ({ Notice: f.Notice, UseYN: f.UseYN, Title: f.Title.trim(), Content: f.Content });
  const done = tr('처리되었습니다.', 'Done.');
  const create = useAdminMutation({ fn: async () => { const r = await adminSupportParityApi.createNotice(body()); await uploadChosen(r.idx); return r; }, invalidate: inv, success: done, onSuccess: (r) => { setEditing(null); setSel(r.idx); } });
  const update = useAdminMutation({ fn: async () => { const r = await adminSupportParityApi.updateNotice(sel!, { ...body(), clearFiles: clear }); await uploadChosen(sel!); return r; }, invalidate: inv, success: done, onSuccess: () => setEditing(null) });
  const [delOpen, setDelOpen] = useState(false);
  const remove = useAdminMutation({ fn: () => adminSupportParityApi.deleteNotice(sel!), invalidate: inv, success: done, onSuccess: () => { setDelOpen(false); setSel(null); } });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.Title.trim()) e.Title = tr('제목을 입력하세요.', 'Enter a title.');
    if (tooShort(f.Content)) e.Content = tr('내용을 입력해주세요', 'Enter the content (15+ characters).');
    setErrors(e); if (Object.keys(e).length) return;
    confirmSave.ask(); // notice_write.php SubmitOk(): confirm("등록하시겠습니까?")
  };
  const confirmSave = useSubmitConfirm();
  const doSave = () => (editing === 'new' ? create : update).mutate(undefined as never, { onSettled: confirmSave.close });
  const download = async (idx: number, slot: number, name: string) => { try { await adminSupportParityApi.downloadNoticeFile(idx, slot, name); } catch (e) { toast(isAppError(e) ? e.message : adm.common.failed, { tone: 'danger' }); } };

  const columns: Column<NoticeRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'center', width: 80, render: (r, i) => (r.pinned ? <StatusBadge tone="info">{tr('공지', 'Notice')}</StatusBadge> : rowNo(total, p.page, SIZE, i - pinnedCount)) },
    { key: 'title', header: tr('제목', 'Title'), render: (r) => <b>{r.title}</b> },
    { key: 'realFileName1', header: tr('첨부', 'File'), width: 200, render: (r) => r.realFileName1 ?? '' },
    { key: 'regDate', header: tr('등록일', 'Registered'), width: 150, nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'views', header: tr('조회', 'Views'), align: 'right', width: 80, render: (r) => r.views.toLocaleString('ko-KR') },
    { key: 'useYN', header: tr('사용 유무', 'Active'), align: 'center', width: 80, render: (r) => ynMsg(r.useYN) },
  ];
  const uploadOk = editing === 'new' ? true : d?.uploadEnabled ?? true;
  const newBtn = <AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => { setSel(null); setEditing('new'); }}>{tr('공지 등록', 'New notice')}</AButton>;
  return (
    <AdminPage title={tr('공지사항', 'Notices')} lead={tr('공지글은 검색과 관계없이 항상 위에 표시되고, 검색은 일반글에 적용됩니다(기존과 동일).', 'Pinned notices are always listed first; the search applies to regular posts (as before).')} actions={newBtn}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'Title', q: '' }); reset(); }}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="n-col" width={120}><ASelect id="n-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'Title', label: tr('제목', 'Title') }, { value: 'Content', label: tr('내용', 'Content') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="n-q" width={300}><AInput id="n-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(x) => setP({ page: x })} onRowClick={(r) => { setEditing(null); setSel(r.idx); }} selectedKey={sel} emptyTitle={tr('등록된 내용이 없습니다.', 'Nothing registered.')} dense />

      {/* notice_read.php */}
      <DetailDrawer open={sel !== null && !editing} onClose={() => setSel(null)} title={d ? <>{d.pinned ? <span style={{ color: '#FF3300' }}>[{tr('공지', 'Notice')}] </span> : null}{d.title}</> : tr('공지사항', 'Notice')} wide
        footer={<><AButton variant="danger" disabled={!canWrite || !d} title={readOnlyTitle} onClick={() => setDelOpen(true)}>{tr('삭 제', 'Delete')}</AButton><AButton variant="primary" disabled={!canWrite || !d} title={readOnlyTitle} onClick={() => setEditing('edit')}>{tr('정보 수정', 'Edit')}</AButton><AButton onClick={() => setSel(null)}>{tr('목록', 'List')}</AButton></>}>
        {d ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card>
              <DescList items={[
                [tr('제 목', 'Title'), <span key="t">{d.pinned ? <span style={{ color: '#FF3300' }}>[{tr('공지', 'Notice')}]&nbsp;&nbsp;</span> : null}{d.title}</span>],
                [tr('사용 유무', 'Active'), ynMsg(d.useYN)],
                [tr('조회수', 'Views'), d.views],
                ...SLOTS.map((s): [ReactNode, ReactNode] => { const file = d.files.find((x) => x.slot === s); return [`${tr('첨부 파일', 'File')} ${s}`, file ? <AButton key={s} variant="link" size="sm" onClick={() => void download(d.idx, s, file.realFileName)}>{file.realFileName}</AButton> : null]; }),
                [tr('등록일', 'Registered'), d.regDate],
              ]} />
            </Card>
            <Card title={tr('내 용', 'Content')}><div style={{ lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: d.content ?? '' }} /></Card>
          </div>
        ) : detail.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>

      {/* notice_write.php */}
      <DetailDrawer open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? tr('공지사항 등록', 'New notice') : tr('공지사항 수정', 'Edit notice')} wide
        footer={<><AButton onClick={() => setEditing(null)}>{tr('목록', 'List')}</AButton><AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} loading={create.isPending || update.isPending} onClick={submit}>{editing === 'new' ? tr('등록', 'Create') : tr('수정', 'Save')}</AButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!uploadOk ? <Callout tone="warn">{tr('첨부 파일 저장 폴더(upload/Notice)가 이 서버에 연결되어 있지 않습니다. 글은 저장되지만 파일은 기존 관리자 페이지에서 올려주세요.', 'The attachment folder (upload/Notice) is not available here. Text is saved; upload files on the legacy admin page.')}</Callout> : null}
          <FieldRow label={tr('공지 여부', 'Notice')} htmlFor="nf-notice"><ASelect id="nf-notice" value={f.Notice} onChange={(e) => setF({ ...f, Notice: e.target.value as 'Y' | 'N' })} options={[{ value: 'Y', label: tr('공지글', 'Pinned') }, { value: 'N', label: tr('일반글', 'Regular') }]} disabled={!canWrite} /></FieldRow>
          <FieldRow label={tr('사용 여부', 'Active')} htmlFor="nf-use"><ASelect id="nf-use" value={f.UseYN} onChange={(e) => setF({ ...f, UseYN: e.target.value as 'Y' | 'N' })} options={[{ value: 'N', label: tr('미사용', 'Not used') }, { value: 'Y', label: tr('사용', 'In use') }]} disabled={!canWrite} /></FieldRow>
          <FieldRow label={tr('제목', 'Title')} htmlFor="nf-title" required error={errors.Title}><AInput id="nf-title" value={f.Title} onChange={(e) => setF({ ...f, Title: e.target.value })} maxLength={250} disabled={!canWrite} /></FieldRow>
          {SLOTS.map((s) => {
            const existing = editing === 'edit' ? d?.files.find((x) => x.slot === s) : undefined;
            return (
              <FieldRow key={s} label={`${tr('첨부파일', 'File')} ${s}`} htmlFor={`nf-file-${s}`} help={existing ? <span><AButton variant="link" size="sm" onClick={() => void download(d!.idx, s, existing.realFileName)}><b>{existing.realFileName}</b></AButton> <label style={{ marginLeft: 8 }}><input type="checkbox" checked={clear.includes(s)} onChange={(e) => setClear(e.target.checked ? [...clear, s] : clear.filter((x) => x !== s))} disabled={!canWrite} /> {tr('파일 삭제', 'Delete file')}</label></span> : undefined}>
                <input id={`nf-file-${s}`} type="file" accept=".hwp,.hwpx,.xlsx,.xls,.txt,.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.zip" disabled={!uploadOk || !canWrite} onChange={(e) => setFiles({ ...files, [s]: e.target.files?.[0] ?? null })} />
              </FieldRow>
            );
          })}
          <FieldRow label={tr('내 용', 'Content')} htmlFor="nf-content" required error={errors.Content} help={tr('Editor / HTML / TEXT 모드(기존 스마트에디터와 같음), 15자 이상', 'Editor / HTML / TEXT modes (as SmartEditor), 15+ characters')}><SupportRichEditor id="nf-content" ariaLabel={tr('내 용', 'Content')} value={f.Content} onChange={(html) => setF((x) => ({ ...x, Content: html }))} disabled={!canWrite} invalid={!!errors.Content} /></FieldRow>
        </div>
      </DetailDrawer>
      <SupportSubmitConfirm open={confirmSave.open} loading={create.isPending || update.isPending} onCancel={confirmSave.close} onConfirm={doSave} />
      <ConfirmDialog open={delOpen} title={tr('공지사항 삭제', 'Delete notice')} body={tr('현재 글을 삭제하시겠습니까?', 'Delete this post?')} tone="danger" confirmLabel={tr('삭 제', 'Delete')} loading={remove.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => remove.mutate(undefined as never)} />
    </AdminPage>
  );
}
