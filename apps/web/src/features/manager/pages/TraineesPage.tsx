import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { downloadText, managerApi, type TraineeStatus } from '../../../shared/api/endpoints/manager';
import type { TraineeRow } from '../../../shared/api/schemas';
import { useManager } from '../ManagerContext';
import { useSearchState } from '../../../shared/utils/useSearchState';
import { useToast } from '../../../app/providers/ToastProvider';
import { AButton, AInput, ASelect, Bar, BoolBadge, DataTable, FilterBar, FilterField, type Column } from '../../../shared/ui/admin';
import { mgr } from '../strings';

const DEFAULTS = { q: '', status: 'all', page: 1 };
export const TRAINEE_PAGE_SIZE = 20;

export function traineeColumns(onOpen?: (r: TraineeRow) => void): Column<TraineeRow>[] {
  const c = mgr.trainees.cols;
  return [
    { key: 'name', header: c.name, sortable: true, render: (r) => <b>{r.name ?? '—'}</b> },
    { key: 'id', header: c.id, sortable: true, nowrap: true },
    { key: 'depart', header: c.depart, render: (r) => [r.depart, r.position].filter(Boolean).join(' · ') },
    { key: 'courseName', header: c.course, render: (r) => <span title={r.lectureCode}>{r.courseName}</span> },
    { key: 'period', header: c.period, nowrap: true, sortValue: (r) => r.period.start, sortable: true, render: (r) => `${r.period.start} ~ ${r.period.end}` },
    { key: 'seconds', header: c.time, align: 'right', sortable: true, nowrap: true, render: (r) => r.formatted },
    { key: 'percent', header: c.percent, sortable: true, width: 120, render: (r) => <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Bar value={r.percent} tone={r.over15h ? 'ok' : undefined} /><span style={{ fontSize: 12, minWidth: 34, textAlign: 'right' }}>{r.percent}%</span></div> },
    { key: 'passOk', header: c.passOk, align: 'center', sortable: true, render: (r) => <BoolBadge value={r.passOk} yes="수료" no={r.studyEnd ? '미수료' : '진행'} /> },
    { key: 'preDone', header: c.pre, align: 'center', render: (r) => <BoolBadge value={r.preDone} yes="완료" no="-" /> },
    { key: 'postDone', header: c.post, align: 'center', render: (r) => <BoolBadge value={r.postDone} yes="완료" no="-" /> },
    { key: 'lastLearning', header: c.last, nowrap: true, sortable: true, render: (r) => r.lastLearning ?? '—' },
    { key: 'certCount', header: c.cert, align: 'right', sortable: true },
    ...(onOpen ? [{ key: '_open', header: '', render: (r: TraineeRow) => <AButton size="xs" onClick={(e) => { e.stopPropagation(); onOpen(r); }}>{mgr.trainees.detail}</AButton> } as Column<TraineeRow>] : []),
  ];
}

export default function TraineesPage() {
  const { companyCode } = useManager();
  const [params, setParams, reset] = useSearchState(DEFAULTS);
  const [q, setQ] = useState(params.q);
  const [status, setStatus] = useState(params.status);
  const navigate = useNavigate();
  const { toast } = useToast();
  const query = useMemo(() => ({ companyCode: companyCode || undefined, q: params.q || undefined, status: (params.status || 'all') as TraineeStatus, page: params.page, size: TRAINEE_PAGE_SIZE }), [companyCode, params]);
  const list = useQuery({ queryKey: ['manager', 'trainees', query], queryFn: ({ signal }) => managerApi.trainees(query, signal), placeholderData: keepPreviousData });
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const csv = await managerApi.exportTraineesCsv({ companyCode: companyCode || undefined, q: params.q || undefined });
      downloadText(csv, `trainees${companyCode ? `-${companyCode}` : ''}.csv`);
      toast(mgr.trainees.exportDone, { tone: 'ok' });
    } catch { toast(mgr.trainees.exportFail, { tone: 'danger' }); } finally { setExporting(false); }
  };

  const open = (r: TraineeRow) => navigate(`/manager/trainees/${encodeURIComponent(r.id)}?studySeq=${r.studySeq}`);
  const columns = useMemo(() => traineeColumns(open), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className={styles.head}><div><h1>{mgr.trainees.title}</h1><p>{mgr.trainees.lead}</p></div></div>
      <FilterBar onSubmit={() => setParams({ q: q.trim(), status }, true)} onReset={() => { setQ(''); setStatus('all'); reset(); }}
        extra={<AButton onClick={() => void exportCsv()} loading={exporting}>{mgr.trainees.export}</AButton>}>
        <FilterField label={mgr.trainees.search} htmlFor="tr-q" width={220}><AInput id="tr-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={mgr.trainees.search} /></FilterField>
        <FilterField label={mgr.trainees.status} htmlFor="tr-status" width={150}><ASelect id="tr-status" value={status} onChange={(e) => setStatus(e.target.value)} options={mgr.trainees.statuses} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.studySeq} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()}
        page={params.page} size={TRAINEE_PAGE_SIZE} total={list.data?.total} onPageChange={(p) => setParams({ page: p })} onRowClick={open}
        emptyTitle={mgr.trainees.empty.title} emptyBody={mgr.trainees.empty.body} />
    </div>
  );
}
