import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminSiteCmsApi } from '../../../../shared/api/endpoints/admin-site-cms';
import type { LectureEventRow } from '../../../../shared/api/endpoints/admin-site-cms';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, FieldRow, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { COUNSEL_STATUS, LEGACY_PAGE_SIZE, rowNumber } from './siteCms.helpers';

const DEFAULTS = { col: 'ID', q: '', page: 1 };
const SIZE = LEGACY_PAGE_SIZE; // include_top.php $page_size = 30

/** lecture_event.php / _read / _script / _excel — 커뮤니티관리 > 이벤트관리 (F7). */
export default function LectureEventsPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'lecture-events', query], queryFn: ({ signal }) => adminSiteCmsApi.lectureEvents(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  const [sel, setSel] = useState<LectureEventRow | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'lecture-event', sel?.idx], queryFn: ({ signal }) => adminSiteCmsApi.lectureEvent(sel!.idx, signal), enabled: !!sel });
  const [st, setSt] = useState<{ Status: 'A' | 'B'; StatusName: string }>({ Status: 'A', StatusName: '' });
  const [err, setErr] = useState('');
  useEffect(() => { const d = detail.data; if (d) { setSt({ Status: d.status === 'B' ? 'B' : 'A', StatusName: d.statusName ?? '' }); setErr(''); } }, [detail.data]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const save = useAdminMutation({ fn: () => adminSiteCmsApi.setLectureEventStatus(sel!.idx, { ...st, StatusName: st.StatusName.trim() }), invalidate: [['admin', 'lecture-events'], ['admin', 'lecture-event']], success: tr('처리되었습니다.', 'Saved.'), onSuccess: () => setConfirmOpen(false), onError: (e) => { setConfirmOpen(false); toast(isAppError(e) ? e.message : adm.common.failed, { tone: 'danger' }); } });
  const [exporting, setExporting] = useState(false);
  /** *_excel.php: .xlsx with the current search, no row cap; a search with no rows still downloads the header row. */
  const exportXlsx = async () => {
    setExporting(true);
    try { await adminSiteCmsApi.downloadLectureEventsXlsx({ col: query.col, q: query.q }); }
    catch (e) { toast(isAppError(e) ? e.message : adm.common.failed, { tone: 'danger' }); }
    finally { setExporting(false); }
  };

  const columns: Column<LectureEventRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => rowNumber(total, p.page, SIZE, i) },
    { key: 'id', header: tr('아이디', 'User ID'), nowrap: true, render: (r) => <b className="mono">{r.id ?? ''}</b> },
    { key: 'name', header: tr('이름', 'Name'), render: (r) => r.name ?? '' },
    { key: 'mobile', header: tr('전화번호', 'Mobile'), nowrap: true, render: (r) => r.mobile ?? '' },
    { key: 'stage', header: tr('스테이지', 'Stage'), align: 'center', render: (r) => r.stageLabel },
    { key: 'stageCount', header: tr('카운트', 'Count'), align: 'right', render: (r) => r.stageCount ?? '' },
    { key: 'status', header: tr('상태', 'Status'), align: 'center', render: (r) => <StatusBadge tone={r.status === 'B' ? 'ok' : 'warn'}>{r.statusLabel}</StatusBadge> },
  ];
  const d = detail.data;
  return (
    <AdminPage title={tr('이벤트관리', 'Events')} lead={tr('학습 이벤트(스테이지) 참여 내역입니다. 행을 누르면 처리 상태를 변경할 수 있습니다.', 'Learning event (stage) participation. Click a row to change its status.')}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'ID', q: '' }); reset(); }}
        extra={<AButton onClick={() => void exportXlsx()} loading={exporting} disabled={!canWrite} title={readOnlyTitle}>{tr('검색항목 엑셀 출력', 'Export to Excel')}</AButton>}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="le-col" width={130}><ASelect id="le-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'ID', label: tr('아이디', 'User ID') }, { value: 'Name', label: tr('이름', 'Name') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="le-q" width={260}><AInput id="le-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={setSel} selectedKey={sel?.idx ?? null} emptyTitle={tr('등록된 내용이 없습니다.', 'Nothing registered.')} dense />

      <DetailDrawer open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.name ?? ''} (${sel.id ?? ''})` : ''} subtitle={sel?.stageLabel}
        footer={<><AButton onClick={() => setSel(null)}>{adm.common.close}</AButton><AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} loading={save.isPending} onClick={() => { if (!st.StatusName.trim()) { setErr(tr('작성자를 입력하세요.', 'Enter the author.')); return; } setErr(''); setConfirmOpen(true); /* lecture_event_read.php: confirm("등록하시겠습니까?") */ }}>{tr('상태 변경', 'Change status')}</AButton></>}>
        {d ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title={tr('참여 정보', 'Participation')}>
              <DescList cols={2} items={[[tr('아이디', 'User ID'), d.id], [tr('이름', 'Name'), d.name], [tr('스테이지', 'Stage'), d.stageLabel], [tr('카운트', 'Count'), d.stageCount], [tr('전화번호', 'Mobile'), d.mobile], [tr('등록일', 'Registered'), d.regDate]]} />
            </Card>
            <Card title={tr('상태 변경', 'Status')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FieldRow label={tr('처리 상태', 'Status')} htmlFor="le-status"><ASelect id="le-status" value={st.Status} onChange={(e) => setSt({ ...st, Status: e.target.value as 'A' | 'B' })} options={COUNSEL_STATUS} /></FieldRow>
                <FieldRow label={tr('작성자', 'Author')} htmlFor="le-name" required error={err}><AInput id="le-name" value={st.StatusName} onChange={(e) => setSt({ ...st, StatusName: e.target.value })} maxLength={50} disabled={!canWrite} /></FieldRow>
                {d.statusRegDate ? <FieldRow label={tr('상태변경일자', 'Changed at')}><div style={{ paddingTop: 8 }}>{d.statusRegDate}</div></FieldRow> : null}
              </div>
            </Card>
          </div>
        ) : detail.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>
      <ConfirmDialog open={confirmOpen} title={tr('상태 변경', 'Change status')} tone="info" loading={save.isPending} onCancel={() => setConfirmOpen(false)} onConfirm={() => save.mutate(undefined as never)} confirmLabel={tr('등록', 'Save')} body={<p>{tr('등록하시겠습니까?', 'Save this status?')}</p>} />
    </AdminPage>
  );
}
