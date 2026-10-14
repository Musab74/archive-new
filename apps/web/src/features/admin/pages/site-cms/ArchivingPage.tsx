import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminSiteCmsApi } from '../../../../shared/api/endpoints/admin-site-cms';
import type { ArchivingRow } from '../../../../shared/api/endpoints/admin-site-cms';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, ATextarea, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, FieldRow, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { COUNSEL_STATUS, rowNumber } from './siteCms.helpers';

const DEFAULTS = { col: 'ID', q: '', page: 1 };
const SIZE = 20;

/** archiving.php / archiving_read.php / archiving_script.php — 커뮤니티관리 > 아카이빙 (F5). */
export default function ArchivingPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ q: p.q });
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ col: 'ID', q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'archiving', query], queryFn: ({ signal }) => adminSiteCmsApi.archiving(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  const [sel, setSel] = useState<ArchivingRow | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'archiving-detail', sel?.idx], queryFn: ({ signal }) => adminSiteCmsApi.archivingDetail(sel!.idx, signal), enabled: !!sel });
  const [reply, setReply] = useState<{ Status: 'A' | 'B'; Name2: string; Contents2: string }>({ Status: 'A', Name2: '', Contents2: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { const d = detail.data; if (d) { setReply({ Status: d.status === 'B' ? 'B' : 'A', Name2: d.name2 ?? '', Contents2: d.contents2 ?? '' }); setErrors({}); } }, [detail.data]);
  const inv = [['admin', 'archiving'], ['admin', 'archiving-detail']];
  const save = useAdminMutation({ fn: () => adminSiteCmsApi.archivingReply(sel!.idx, { ...reply, Name2: reply.Name2.trim(), Contents2: reply.Contents2.trim() }), invalidate: inv, success: tr('처리되었습니다.', 'Saved.') });
  const [delOpen, setDelOpen] = useState(false);
  const del = useAdminMutation({ fn: () => adminSiteCmsApi.deleteArchiving(sel!.idx), invalidate: inv, success: adm.common.deleted, onSuccess: () => { setDelOpen(false); setSel(null); } });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!reply.Name2.trim()) e.Name2 = tr('작성자를 입력하세요.', 'Enter the author.');
    if (reply.Contents2.trim().length < 15) e.Contents2 = tr('답변 내용을 15자 이상 입력해주세요', 'Enter at least 15 characters.');
    setErrors(e); if (Object.keys(e).length) return;
    save.mutate(undefined as never);
  };
  const download = async () => {
    const d = detail.data; if (!d) return;
    try { await adminSiteCmsApi.downloadArchivingFile(d.idx, d.realFileName1 || d.fileName1 || 'file'); } catch (err) { toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); }
  };

  const columns: Column<ArchivingRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => rowNumber(total, p.page, SIZE, i) },
    { key: 'id', header: 'ID', nowrap: true, render: (r) => <span className="mono">{r.id ?? ''}</span> },
    { key: 'title', header: tr('제목', 'Title'), render: (r) => <b>{r.title ?? ''}</b> },
    { key: 'regDate', header: tr('등록일', 'Registered'), nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'regDate2', header: tr('처리일', 'Handled'), nowrap: true, render: (r) => r.regDate2 ?? '-' },
    { key: 'status', header: tr('처리상태', 'Status'), align: 'center', render: (r) => <StatusBadge tone={r.status === 'B' ? 'ok' : 'warn'}>{r.statusLabel}</StatusBadge> },
  ];
  const d = detail.data;
  return (
    <AdminPage title={tr('아카이빙', 'Archiving')} lead={tr('아카이빙 문의 목록입니다. 행을 누르면 내용 확인, 답변(처리 상태) 등록, 삭제를 할 수 있습니다.', 'Archiving requests. Click a row to read, answer (status) or delete.')}>
      <FilterBar onSubmit={() => setP({ ...form, col: 'ID' }, true)} onReset={() => { setForm({ q: '' }); reset(); }}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="ar-col" width={130}><ASelect id="ar-col" value="ID" onChange={() => undefined} options={[{ value: 'ID', label: tr('아이디', 'User ID') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="ar-q" width={260}><AInput id="ar-q" value={form.q} onChange={(e) => setForm({ q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={setSel} selectedKey={sel?.idx ?? null} emptyTitle={tr('등록된 내용이 없습니다.', 'Nothing registered.')} dense />

      <DetailDrawer open={!!sel} onClose={() => setSel(null)} title={sel?.title ?? ''} subtitle={sel?.id ?? ''} wide
        footer={<><AButton onClick={() => setSel(null)}>{adm.common.close}</AButton><AButton variant="danger" disabled={!canWrite} title={readOnlyTitle} onClick={() => setDelOpen(true)}>{tr('삭 제', 'Delete')}</AButton><AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} loading={save.isPending} onClick={submit}>{tr('답변 하기', 'Reply')}</AButton></>}>
        {d ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title={tr('문의 내용', 'Request')}>
              <DescList cols={2} items={[[tr('아이디', 'User ID'), d.id], [tr('이름', 'Name'), d.name], [tr('이메일', 'E-mail'), d.email], [tr('연락처', 'Mobile'), d.mobile], [tr('소속', 'Company'), d.companyName], [tr('등록일', 'Registered'), d.regDate], [tr('문의 제목', 'Title'), d.title], [tr('첨부 파일', 'Attachment'), d.fileName1 ? <AButton key="f" variant="link" size="sm" onClick={() => void download()}>{d.realFileName1 || d.fileName1}</AButton> : null]]} />
              <div style={{ marginTop: 12, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: d.contents ?? '' }} />
            </Card>
            <Card title={tr('답변', 'Reply')} aside={d.regDate2 ? <span className="muted">{tr('답변일', 'Replied')}: {d.regDate2}</span> : null}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FieldRow label={tr('처리 상태', 'Status')} htmlFor="ar-status"><ASelect id="ar-status" value={reply.Status} onChange={(e) => setReply({ ...reply, Status: e.target.value as 'A' | 'B' })} options={COUNSEL_STATUS} /></FieldRow>
                <FieldRow label={tr('작성자', 'Author')} htmlFor="ar-name2" required error={errors.Name2}><AInput id="ar-name2" value={reply.Name2} onChange={(e) => setReply({ ...reply, Name2: e.target.value })} maxLength={50} disabled={!canWrite} /></FieldRow>
                <FieldRow label={tr('답변 내용', 'Reply')} htmlFor="ar-contents2" required error={errors.Contents2} help={tr('HTML 사용 가능, 15자 이상', 'HTML allowed, 15+ characters')}><ATextarea id="ar-contents2" rows={12} value={reply.Contents2} onChange={(e) => setReply({ ...reply, Contents2: e.target.value })} disabled={!canWrite} /></FieldRow>
              </div>
            </Card>
          </div>
        ) : detail.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>
      <ConfirmDialog open={delOpen} title={tr('아카이빙 삭제', 'Delete')} tone="danger" loading={del.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => del.mutate(undefined as never)} body={<p>{tr('현재 글을 삭제하시겠습니까? (Del=Y 처리)', 'Delete this post? (Del=Y)')}</p>} />
    </AdminPage>
  );
}
