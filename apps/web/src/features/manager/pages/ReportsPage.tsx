import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { managerApi } from '../../../shared/api/endpoints/manager';
import type { TraineeRow } from '../../../shared/api/schemas';
import { useManager } from '../ManagerContext';
import { useSearchState } from '../../../shared/utils/useSearchState';
import { AButton, AInput, Bar, DataTable, FilterBar, FilterField, type Column } from '../../../shared/ui/admin';
import { StateBlock } from '../../../shared/ui/StateBlock';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { formatDate, formatMinutes } from '../../../shared/utils/format';
import { TRAINEE_PAGE_SIZE } from './TraineesPage';
import { mgr } from '../strings';

const DEFAULTS = { q: '', page: 1 };

/** /manager/reports — per-trainee printable summaries (minimal /my/report style). */
export default function ReportsPage() {
  const { companyCode } = useManager();
  const [params, setParams, reset] = useSearchState(DEFAULTS);
  const navigate = useNavigate();
  const query = useMemo(() => ({ companyCode: companyCode || undefined, q: params.q || undefined, page: params.page, size: TRAINEE_PAGE_SIZE }), [companyCode, params]);
  const list = useQuery({ queryKey: ['manager', 'trainees', query], queryFn: ({ signal }) => managerApi.trainees(query, signal), placeholderData: keepPreviousData });
  const open = (r: TraineeRow) => navigate(`/manager/reports/${encodeURIComponent(r.id)}?studySeq=${r.studySeq}`);
  const columns: Column<TraineeRow>[] = [
    { key: 'name', header: mgr.trainees.cols.name, sortable: true, render: (r) => <b>{r.name ?? '—'}</b> },
    { key: 'id', header: mgr.trainees.cols.id, sortable: true },
    { key: 'courseName', header: mgr.trainees.cols.course },
    { key: 'period', header: mgr.trainees.cols.period, nowrap: true, render: (r) => `${r.period.start} ~ ${r.period.end}` },
    { key: 'seconds', header: mgr.trainees.cols.time, align: 'right', sortable: true, render: (r) => r.formatted },
    { key: 'percent', header: mgr.trainees.cols.percent, sortable: true, width: 120, render: (r) => <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Bar value={r.percent} tone={r.over15h ? 'ok' : undefined} /><span style={{ fontSize: 12, minWidth: 34, textAlign: 'right' }}>{r.percent}%</span></div> },
    { key: 'passOk', header: mgr.trainees.cols.passOk, align: 'center', render: (r) => (r.passOk ? '수료' : r.studyEnd ? '미수료' : '진행') },
    { key: '_open', header: '', render: (r) => <AButton size="xs" variant="primary" onClick={(e) => { e.stopPropagation(); open(r); }}>{mgr.reports.open}</AButton> },
  ];
  return (
    <div>
      <div className={styles.head}><div><h1>{mgr.reports.title}</h1><p>{mgr.reports.lead}</p></div></div>
      <FilterBar onSubmit={() => setParams({ q: params.q }, true)} onReset={reset}>
        <FilterField label={mgr.trainees.search} htmlFor="rp-q" width={220}><AInput id="rp-q" key={params.q} defaultValue={params.q} onChange={(e) => setParams({ q: e.target.value }, true)} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.studySeq} loading={list.isPending} error={list.error} onRetry={() => void list.refetch()} page={params.page} size={TRAINEE_PAGE_SIZE} total={list.data?.total} onPageChange={(p) => setParams({ page: p })} onRowClick={open} />
    </div>
  );
}

/** /manager/reports/:id — print-friendly summary for one enrollment. */
export function TraineeReportPage() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const studySeq = Number(sp.get('studySeq')) || undefined;
  const q = useQuery({ queryKey: ['manager', 'trainee', id, studySeq], queryFn: ({ signal }) => managerApi.traineeProgress(id, studySeq, signal), enabled: !!id });
  const d = q.data;
  const today = formatDate(new Date().toISOString());
  return (
    <div>
      <div className={`${styles.head} ${styles.noPrint}`}>
        <div><h1>{mgr.reports.summary}</h1><p>{mgr.reports.lead}</p></div>
        <div className="u-flex u-gap-8"><AButton to="/manager/reports">{mgr.reports.back}</AButton><AButton variant="primary" onClick={() => window.print()} disabled={!d}>{mgr.reports.print}</AButton></div>
      </div>
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : q.isPending ? <Skeleton lines={8} /> : d ? (
        <article className={styles.report}>
          <h1>{mgr.reports.summary} · {d.trainee.name ?? d.trainee.id}</h1>
          <p className={styles.meta}>{d.courseName} ({d.lectureCode}) · {d.period.start} ~ {d.period.end} · {mgr.reports.generated(today)}</p>
          <table>
            <tbody>
              <tr><th style={{ width: 140 }}>아이디</th><td>{d.trainee.id}</td><th style={{ width: 140 }}>기업코드</th><td>{d.companyCode}</td></tr>
              <tr><th>학습시간</th><td>{d.formatted} ({d.seconds.toLocaleString('ko-KR')}초)</td><th>달성률</th><td>{d.percent}% (15시간 기준)</td></tr>
              <tr><th>수료</th><td>{d.passOk ? '수료' : d.studyEnd ? '미수료' : '진행 중'}</td><th>수강 마감</th><td>{d.studyEnd ? '마감' : '진행'}</td></tr>
            </tbody>
          </table>
          <h2>차시별 진도</h2>
          <table>
            <thead><tr><th>순서</th><th>콘텐츠</th><th>차시</th><th>강의시간</th><th>진도</th><th>학습시간</th><th>최근 학습</th></tr></thead>
            <tbody>{d.chapters.map((ch) => <tr key={ch.chapterSeq}><td>{ch.order ?? ''}</td><td>{ch.courseName ?? ch.lectureCode}</td><td>{ch.title}</td><td>{ch.lectureTimeMin != null ? `${ch.lectureTimeMin}분` : '—'}</td><td>{Math.round(ch.progress ?? 0)}%</td><td>{formatMinutes(Math.round((ch.studyTime ?? 0) / 60))}</td><td>{ch.lastStudiedAt ?? ch.lastStudy ?? '—'}</td></tr>)}</tbody>
          </table>
          <h2>일별 학습시간</h2>
          {d.daily.length ? (
            <table>
              <thead><tr><th>날짜</th><th>학습</th><th>인정</th><th>초과</th><th>상태</th></tr></thead>
              <tbody>{d.daily.map((r) => <tr key={r.date}><td>{r.date}</td><td>{formatMinutes(Math.round(r.seconds / 60))}</td><td>{formatMinutes(Math.round(r.creditedSec / 60))}</td><td>{r.excessSec ? formatMinutes(Math.round(r.excessSec / 60)) : '—'}</td><td>{r.statusLabel}</td></tr>)}</tbody>
            </table>
          ) : <p className="muted" style={{ fontSize: 13 }}>{mgr.trainee.noDaily}</p>}
          <p className="muted" style={{ fontSize: 11, marginTop: 18 }}>개인 진단 답변·AI 대화는 보고서에 포함하지 않습니다. 정형 보고서 반출과 증빙 제출은 기존 LMS에서 진행합니다.</p>
        </article>
      ) : null}
    </div>
  );
}
