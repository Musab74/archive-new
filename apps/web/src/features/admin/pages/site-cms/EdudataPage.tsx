import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminSiteCmsApi } from '../../../../shared/api/endpoints/admin-site-cms';
import type { EdudataRow } from '../../../../shared/api/endpoints/admin-site-cms';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, ACheckbox, AdminPage, AInput, ASelect, ATextarea, Callout, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, FieldRow, FilterBar, FilterField, StatusBadge, YnBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { rowNumber } from './siteCms.helpers';

const DEFAULTS = { col: 'Title', q: '', page: 1 };
const SIZE = 20;
const SLOTS = [1, 2, 3, 4, 5] as const;
interface Form { Notice: 'Y' | 'N'; UseYN: 'Y' | 'N'; Category: string; Title: string; Content: string }
const EMPTY: Form = { Notice: 'N', UseYN: 'Y', Category: 'A', Title: '', Content: '' };
type Row = EdudataRow & { pinned?: boolean };

/** edudata.php / _read / _write / _script — 커뮤니티관리 > 학습자료실 (F7). */
export default function EdudataPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const { toast } = useToast();
  const qc = useQueryClient();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'edudata', query], queryFn: ({ signal }) => adminSiteCmsApi.edudata(query, signal), placeholderData: keepPreviousData });
  const meta = useQuery({ queryKey: ['admin', 'edudata', 'meta'], queryFn: ({ signal }) => adminSiteCmsApi.edudataMeta(signal), staleTime: 5 * 60_000 });
  const total = list.data?.total ?? 0;
  const rows: Row[] | undefined = useMemo(() => list.data ? [...list.data.notices.map((n) => ({ ...n, pinned: true })), ...list.data.items] : undefined, [list.data]);
  const firstIdx = list.data?.notices.length ?? 0;

  const [sel, setSel] = useState<Row | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'edudata-detail', sel?.idx], queryFn: ({ signal }) => adminSiteCmsApi.edudataDetail(sel!.idx, signal), enabled: !!sel });
  const [editOpen, setEditOpen] = useState<'create' | 'edit' | null>(null);
  const [f, setF] = useState<Form>(EMPTY);
  const [files, setFiles] = useState<Record<number, File | null>>({});
  const [clear, setClear] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (editOpen === 'create') setF(EMPTY);
    if (editOpen === 'edit' && detail.data) setF({ Notice: detail.data.notice === 'Y' ? 'Y' : 'N', UseYN: detail.data.useYN === 'N' ? 'N' : 'Y', Category: detail.data.category ?? 'A', Title: detail.data.title ?? '', Content: detail.data.content ?? '' });
    setFiles({}); setClear([]); setErrors({});
  }, [editOpen, detail.data]);
  const inv = [['admin', 'edudata'], ['admin', 'edudata-detail']];

  /** PHP posts text + up to 5 files in one request; here the row is saved first and each chosen file follows (same columns). */
  const uploadChosen = async (idx: number) => {
    const picked = SLOTS.filter((s) => files[s]);
    let failed = 0;
    for (const s of picked) { try { await adminSiteCmsApi.uploadEdudataFile(idx, s, files[s]!); } catch (e) { failed++; toast(`${tr('첨부', 'Attachment')} ${s}: ${isAppError(e) ? e.message : adm.common.failed}`, { tone: 'danger' }); } }
    if (picked.length) for (const k of inv) void qc.invalidateQueries({ queryKey: k });
    return failed;
  };
  const body = () => ({ Notice: f.Notice, UseYN: f.UseYN, Category: f.Category, Title: f.Title.trim(), Content: f.Content });
  const create = useAdminMutation({ fn: async () => { const r = await adminSiteCmsApi.createEdudata(body()); await uploadChosen(r.idx); return r; }, invalidate: inv, success: adm.common.created, onSuccess: () => setEditOpen(null) });
  const patch = useAdminMutation({ fn: async () => { const r = await adminSiteCmsApi.patchEdudata(sel!.idx, { ...body(), clearFiles: clear }); await uploadChosen(sel!.idx); return r; }, invalidate: inv, success: adm.common.saved, onSuccess: () => setEditOpen(null) });
  const [delOpen, setDelOpen] = useState(false);
  const del = useAdminMutation({ fn: () => adminSiteCmsApi.deleteEdudata(sel!.idx), invalidate: inv, success: adm.common.deleted, onSuccess: () => { setDelOpen(false); setSel(null); } });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.Title.trim()) e.Title = tr('제목을 입력하세요.', 'Enter a title.');
    if (f.Content.length < 15) e.Content = tr('내용을 15자 이상 입력해주세요', 'Enter at least 15 characters.');
    setErrors(e); if (Object.keys(e).length) return;
    if (editOpen === 'create') create.mutate(undefined as never); else patch.mutate(undefined as never);
  };
  const download = async (idx: number, slot: number, name: string) => { try { await adminSiteCmsApi.downloadEdudataFile(idx, slot, name); } catch (e) { toast(isAppError(e) ? e.message : adm.common.failed, { tone: 'danger' }); } };

  const columns: Column<Row>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (r, i) => r.pinned ? <StatusBadge tone="info">{tr('공지', 'Notice')}</StatusBadge> : rowNumber(total, p.page, SIZE, i - firstIdx) },
    { key: 'categoryLabel', header: tr('분류', 'Category'), nowrap: true },
    { key: 'title', header: tr('제목', 'Title'), render: (r) => <b>{r.title ?? ''}</b> },
    { key: 'firstFile', header: tr('첨부', 'File'), render: (r) => r.files.length ? <span title={r.files.map((x) => x.realFileName).join(', ')}>{r.firstFile}{r.files.length > 1 ? ` 외 ${r.files.length - 1}` : ''}</span> : '' },
    { key: 'regDate', header: tr('등록일', 'Registered'), nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'viewCount', header: tr('조회', 'Views'), align: 'right', render: (r) => r.viewCount.toLocaleString('ko-KR') },
    { key: 'useYN', header: tr('사용 유무', 'Active'), align: 'center', render: (r) => <YnBadge value={r.useYN} /> },
  ];
  const categories = meta.data?.categories ?? [{ value: 'A', label: '공통역량' }, { value: 'B', label: '직무역량' }, { value: 'C', label: '리더십' }, { value: 'D', label: 'HRDe++' }, { value: 'E', label: '기타' }];
  const uploadOk = meta.data?.uploadEnabled ?? true;
  const d = detail.data;
  const newBtn = <AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => { setSel(null); setEditOpen('create'); }}>{tr('자료 등록', 'New resource')}</AButton>;
  return (
    <AdminPage title={tr('학습자료실', 'Learning resources')} lead={tr('공지글은 항상 위에 고정되고, 검색은 일반글에만 적용됩니다(기존과 동일).', 'Notices stay pinned on top; the search applies to regular posts only (as before).')} actions={newBtn}>
      {meta.data && !meta.data.uploadEnabled ? <Callout tone="warn">{tr(`첨부 파일 저장 폴더(${meta.data.uploadDir}/StudyPDS)가 이 서버에 연결되어 있지 않습니다. 글 내용은 여기서 수정할 수 있지만 파일은 기존 관리자 페이지에서 올려주세요.`, `The attachment folder (${meta.data.uploadDir}/StudyPDS) is not available on this server. Text can be edited here; upload files on the legacy admin page.`)}</Callout> : null}
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'Title', q: '' }); reset(); }}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="ed-col" width={130}><ASelect id="ed-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'Title', label: tr('제목', 'Title') }, { value: 'Content', label: tr('내용', 'Content') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="ed-q" width={260}><AInput id="ed-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={setSel} selectedKey={sel?.idx ?? null} emptyTitle={tr('등록된 내용이 없습니다.', 'Nothing registered.')} dense />

      <DetailDrawer open={!!sel && !editOpen} onClose={() => setSel(null)} title={sel ? <>{sel.notice === 'Y' ? <span style={{ color: 'var(--c-danger)' }}>[{tr('공지', 'Notice')}] </span> : null}{sel.title}</> : ''} subtitle={sel?.categoryLabel} wide
        footer={<><AButton onClick={() => setSel(null)}>{adm.common.close}</AButton><AButton variant="danger" disabled={!canWrite} title={readOnlyTitle} onClick={() => setDelOpen(true)}>{tr('삭 제', 'Delete')}</AButton><AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => setEditOpen('edit')}>{tr('정보 수정', 'Edit')}</AButton></>}>
        {d ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title={tr('자료 정보', 'Resource')}>
              <DescList cols={2} items={[[tr('제 목', 'Title'), d.title], [tr('분 류', 'Category'), d.categoryLabel], [tr('사용 유무', 'Active'), <YnBadge key="u" value={d.useYN} />], [tr('조회수', 'Views'), d.viewCount], [tr('등록일', 'Registered'), d.regDate], [tr('공지 여부', 'Notice'), d.notice === 'Y' ? tr('공지글', 'Notice') : tr('일반글', 'Regular')],
                ...SLOTS.map((s): [string, ReactNode] => { const file = d.files.find((x) => x.slot === s); return [`${tr('첨부 파일', 'File')} ${s}`, file ? <AButton key={s} variant="link" size="sm" onClick={() => void download(d.idx, s, file.realFileName || file.fileName || 'file')}>{file.realFileName || file.fileName}</AButton> : null]; })]} />
            </Card>
            <Card title={tr('내 용', 'Content')}><div style={{ lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: d.content ?? '' }} /></Card>
          </div>
        ) : detail.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>

      <DetailDrawer open={!!editOpen} onClose={() => setEditOpen(null)} title={editOpen === 'create' ? tr('학습자료실 등록', 'New resource') : tr('학습자료실 수정', 'Edit resource')} wide
        footer={<><AButton onClick={() => setEditOpen(null)}>{adm.common.cancel}</AButton><AButton variant="primary" loading={create.isPending || patch.isPending} disabled={!canWrite} onClick={submit}>{editOpen === 'create' ? tr('등록', 'Create') : tr('수정', 'Save')}</AButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldRow label={tr('공지 여부', 'Notice')}><ASelect aria-label={tr('공지 여부', 'Notice')} value={f.Notice} onChange={(e) => setF({ ...f, Notice: e.target.value as 'Y' | 'N' })} options={[{ value: 'Y', label: tr('공지글', 'Notice') }, { value: 'N', label: tr('일반글', 'Regular') }]} /></FieldRow>
          <FieldRow label={tr('사용 여부', 'Active')}><ASelect aria-label={tr('사용 여부', 'Active')} value={f.UseYN} onChange={(e) => setF({ ...f, UseYN: e.target.value as 'Y' | 'N' })} options={[{ value: 'Y', label: tr('사용', 'Yes') }, { value: 'N', label: tr('미사용', 'No') }]} /></FieldRow>
          <FieldRow label={tr('분류', 'Category')} htmlFor="ef-cat"><ASelect id="ef-cat" value={f.Category} onChange={(e) => setF({ ...f, Category: e.target.value })} options={categories} /></FieldRow>
          <FieldRow label={tr('제목', 'Title')} htmlFor="ef-title" required error={errors.Title}><AInput id="ef-title" value={f.Title} onChange={(e) => setF({ ...f, Title: e.target.value })} maxLength={250} /></FieldRow>
          {SLOTS.map((s) => {
            const existing = editOpen === 'edit' ? d?.files.find((x) => x.slot === s) : undefined;
            return (
              <FieldRow key={s} label={`${tr('첨부파일', 'File')} ${s}`} htmlFor={`ef-file-${s}`} help={existing ? <span>{tr('첨부된 파일', 'Current')}: {existing.realFileName} <ACheckbox label={tr('현재 파일 삭제', 'Remove current file')} checked={clear.includes(s)} onChange={(e) => setClear(e.target.checked ? [...clear, s] : clear.filter((x) => x !== s))} /></span> : undefined}>
                <input id={`ef-file-${s}`} type="file" accept=".hwp,.hwpx,.xlsx,.xls,.txt,.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.zip" disabled={!uploadOk || !canWrite} onChange={(e) => setFiles({ ...files, [s]: e.target.files?.[0] ?? null })} />
              </FieldRow>
            );
          })}
          <FieldRow label={tr('내 용', 'Content')} htmlFor="ef-content" required error={errors.Content} help={tr('HTML 사용 가능 (기존 에디터 내용 그대로 저장), 15자 이상', 'HTML allowed (saved as-is), 15+ characters')}><ATextarea id="ef-content" rows={14} value={f.Content} onChange={(e) => setF({ ...f, Content: e.target.value })} /></FieldRow>
        </div>
      </DetailDrawer>
      <ConfirmDialog open={delOpen} title={tr('학습자료 삭제', 'Delete resource')} tone="danger" loading={del.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => del.mutate(undefined as never)} body={<p>{tr('현재 글을 삭제하시겠습니까? (Del=Y 처리)', 'Delete this post? (Del=Y)')}</p>} />
    </AdminPage>
  );
}
