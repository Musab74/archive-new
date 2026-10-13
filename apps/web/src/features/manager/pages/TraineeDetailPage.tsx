import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { managerApi } from '../../../shared/api/endpoints/manager';
import type { ChapterProgressRow, DailyRow } from '../../../shared/api/schemas';
import { StateBlock } from '../../../shared/ui/StateBlock';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { AButton, Bar, BoolBadge, Card, DataTable, DescList, StatusBadge, type Column } from '../../../shared/ui/admin';
import { formatMinutes } from '../../../shared/utils/format';
import { mgr } from '../strings';

const secToMin = (s: number | null | undefined) => formatMinutes(Math.round((s ?? 0) / 60));

export const chapterColumns: Column<ChapterProgressRow>[] = [
  { key: 'order', header: mgr.trainee.chapterCols.order, align: 'center', width: 60 },
  { key: 'courseName', header: mgr.trainee.chapterCols.course, render: (r) => r.courseName ?? r.lectureCode ?? '' },
  { key: 'title', header: mgr.trainee.chapterCols.title },
  { key: 'lectureTimeMin', header: mgr.trainee.chapterCols.min, align: 'right', render: (r) => (r.lectureTimeMin != null ? `${r.lectureTimeMin}분` : '—') },
  { key: 'progress', header: mgr.trainee.chapterCols.progress, width: 120, render: (r) => <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Bar value={r.progress ?? 0} tone={(r.progress ?? 0) >= 100 ? 'ok' : undefined} /><span style={{ fontSize: 12, minWidth: 34, textAlign: 'right' }}>{Math.round(r.progress ?? 0)}%</span></div> },
  { key: 'studyTime', header: mgr.trainee.chapterCols.time, align: 'right', render: (r) => secToMin(r.studyTime) },
  { key: 'lastStudiedAt', header: mgr.trainee.chapterCols.last, nowrap: true, render: (r) => r.lastStudiedAt ?? r.lastStudy ?? '—' },
];

export const dailyColumns: Column<DailyRow>[] = [
  { key: 'date', header: mgr.trainee.dailyCols.date, nowrap: true, sortable: true },
  { key: 'seconds', header: mgr.trainee.dailyCols.seconds, align: 'right', sortable: true, render: (r) => secToMin(r.seconds) },
  { key: 'creditedSec', header: mgr.trainee.dailyCols.credited, align: 'right', render: (r) => secToMin(r.creditedSec) },
  { key: 'excessSec', header: mgr.trainee.dailyCols.excess, align: 'right', render: (r) => (r.excessSec ? <span style={{ color: 'var(--c-danger)' }}>{secToMin(r.excessSec)}</span> : '—') },
  { key: 'status', header: mgr.trainee.dailyCols.status, align: 'center', render: (r) => <StatusBadge tone={r.status === 'over' ? 'danger' : r.status === 'cap' ? 'warn' : 'ok'}>{r.statusLabel}</StatusBadge> },
];

export default function TraineeDetailPage() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const studySeq = Number(sp.get('studySeq')) || undefined;
  const q = useQuery({ queryKey: ['manager', 'trainee', id, studySeq], queryFn: ({ signal }) => managerApi.traineeProgress(id, studySeq, signal), enabled: !!id });
  const d = q.data;
  return (
    <div>
      <div className={styles.head}>
        <div><h1>{mgr.trainee.title}{d ? ` · ${d.trainee.name ?? d.trainee.id}` : ''}</h1><p>{d ? `${d.courseName} · ${d.period.start} ~ ${d.period.end}` : ''}</p></div>
        <div className="u-flex u-gap-8"><AButton to="/manager/trainees">{mgr.trainee.back}</AButton>{d ? <AButton variant="primary" to={`/manager/reports/${encodeURIComponent(d.trainee.id)}?studySeq=${d.studySeq}`}>{mgr.trainee.report}</AButton> : null}</div>
      </div>
      {q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /> : q.isPending ? <Skeleton lines={6} /> : d ? (
        <div className="stack">
          <Card>
            <DescList cols={2} items={[
              ['아이디', d.trainee.id], ['이름', d.trainee.name],
              ['과정', <span key="c">{d.courseName} <span className="muted">({d.lectureCode}{d.isPackage ? ` · 패키지 ${d.codes.join(', ')}` : ''})</span></span>], ['수강기간', `${d.period.start} ~ ${d.period.end}`],
              ['학습시간', <span key="t">{d.formatted} <span className="muted">({d.seconds.toLocaleString('ko-KR')}초)</span></span>], ['달성률', <div key="p" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bar value={d.percent} tone={d.percent >= 100 ? 'ok' : undefined} /><b>{d.percent}%</b></div>],
              ['수료', <BoolBadge key="po" value={d.passOk} yes="수료" no={d.studyEnd ? '미수료' : '진행 중'} />], ['수강 마감', <BoolBadge key="se" value={d.studyEnd} yes="마감" no="진행" tone="neutral" />],
            ]} />
          </Card>
          <Card title={mgr.trainee.chapters}><DataTable columns={chapterColumns} rows={d.chapters} rowKey={(r) => r.chapterSeq} dense /></Card>
          <Card title={mgr.trainee.daily}><DataTable columns={dailyColumns} rows={d.daily} rowKey={(r) => r.date} dense size={31} emptyTitle={mgr.trainee.noDaily} emptyBody=" " /></Card>
          <p className="muted" style={{ fontSize: 12 }}><Link to="/manager/trainees">{mgr.trainee.back}</Link></p>
        </div>
      ) : null}
    </div>
  );
}
