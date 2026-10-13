import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { ProgressLogRow, StudyDetail } from '../../../../shared/api/schemas';
import { AButton, AdminPage, Bar, BoolBadge, Callout, Card, DataTable, DescList, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { chapterColumns, dailyColumns } from '../../../manager/pages/TraineeDetailPage';
import { adm } from '../../strings';

const c = adm.studies.detail;
type Identity = StudyDetail['identity'][number];
type Correction = StudyDetail['corrections'][number];
type OverlapMinute = StudyDetail['overlap']['minutes'][number];

const identityCols: Column<Identity>[] = [
  { key: 'at', header: '인증 시각', nowrap: true, render: (r) => r.at ?? '' },
  { key: 'type', header: '유형', render: (r) => r.type ?? '' },
  { key: 'ok', header: '결과', align: 'center', render: (r) => <BoolBadge value={r.ok} yes="성공" no="실패" /> },
  { key: 'ip', header: 'IP', render: (r) => <span className="mono">{r.ip ?? ''}</span> },
  { key: 'evalCd', header: 'EvalCD', render: (r) => r.evalCd ?? '' },
];
const correctionCols: Column<Correction>[] = [
  { key: 'appliedAt', header: '적용 시각', nowrap: true, render: (r) => r.appliedAt ?? '' },
  { key: 'action', header: '동작', render: (r) => r.action ?? '' },
  { key: 'oldSeconds', header: '이전(초)', align: 'right' },
  { key: 'newSeconds', header: '이후(초)', align: 'right' },
  { key: 'deltaSeconds', header: '변화(초)', align: 'right', render: (r) => <span style={{ color: r.deltaSeconds < 0 ? 'var(--c-danger)' : 'var(--c-ok)' }}>{r.deltaSeconds > 0 ? '+' : ''}{r.deltaSeconds}</span> },
  { key: 'note', header: '메모', render: (r) => r.note ?? '' },
];
const overlapCols: Column<OverlapMinute>[] = [
  { key: 'minute', header: '분(minute)', nowrap: true },
  { key: 'contents', header: '동시 진행 Contents_idx', render: (r) => r.contents.join(', ') },
];
const l = c.logCols;
const logCols: Column<ProgressLogRow>[] = [
  { key: 'idx', header: l.idx, align: 'right' },
  { key: 'chapterNumber', header: l.chapter, render: (r) => `${r.chapterNumber ?? r.chapterSeq}` },
  { key: 'title', header: l.title, render: (r) => r.title ?? `#${r.contentsIdx}` },
  { key: 'progress', header: l.progress, align: 'right', render: (r) => `${r.progress}%` },
  { key: 'studyTime', header: l.studyTime, align: 'right' },
  { key: 'totalProgress', header: l.total, align: 'right', render: (r) => `${r.totalProgress}%` },
  { key: 'positionSec', header: l.position, align: 'right', render: (r) => r.positionSec ?? '' },
  { key: 'ip', header: l.ip, render: (r) => <span className="mono">{r.ip ?? ''}</span> },
  { key: 'at', header: l.at, nowrap: true, render: (r) => r.at ?? '' },
  { key: 'triggerYN', header: l.trigger, align: 'center', render: (r) => r.triggerYN ?? '' },
];

function ProgressLog({ seq }: { seq: number }) {
  const [enabled, setEnabled] = useState(false);
  const q = useInfiniteQuery({
    queryKey: ['admin', 'progress-log', seq],
    queryFn: ({ pageParam, signal }) => adminApi.progressLog(seq, pageParam, 100, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore && last.nextCursor !== null ? last.nextCursor : undefined),
    enabled,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Card title={c.log} aside={!enabled ? <AButton size="sm" onClick={() => setEnabled(true)}>불러오기</AButton> : <span className="muted" style={{ fontSize: 12 }}>{rows.length}행</span>}>
      {enabled ? (
        <>
          <DataTable columns={logCols} rows={q.isPending ? undefined : rows} rowKey={(r) => r.idx} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense />
          <div className="u-mt-8" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {q.hasNextPage ? <AButton size="sm" onClick={() => void q.fetchNextPage()} loading={q.isFetchingNextPage}>{c.loadMore}</AButton> : rows.length ? <span className="muted" style={{ fontSize: 12 }}>{c.noMore}</span> : null}
          </div>
        </>
      ) : <p className="muted" style={{ fontSize: 13, margin: 0 }}>플레이어가 약 1분마다 남긴 원본 저장 기록을 idx 커서로 읽습니다.</p>}
    </Card>
  );
}

export default function StudyDetailPage() {
  const { seq = '' } = useParams();
  const n = Number(seq);
  const q = useQuery({ queryKey: ['admin', 'study', n], queryFn: ({ signal }) => adminApi.study(n, signal), enabled: Number.isFinite(n) && n > 0 });
  const d = q.data;
  const overCount = d?.daily.filter((x) => x.status === 'over').length ?? 0;
  return (
    <AdminPage title={`${c.title} · Seq ${seq}${d ? ` · ${d.name ?? d.id}` : ''}`} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: adm.studies.title, to: '/admin/studies' }, { label: `Seq ${seq}` }]}
      actions={<><AButton to="/admin/studies">{adm.common.back}</AButton>{d ? <AButton to={`/admin/members/${encodeURIComponent(d.id)}`}>회원 상세</AButton> : null}{d ? <AButton to={`/admin/emon/diagnosis?id=${encodeURIComponent(d.id)}&course=${encodeURIComponent(d.lectureCode)}`}>EMON 진단</AButton> : null}</>}>
      {q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /> : q.isPending || !d ? <Skeleton lines={8} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card title={c.info}>
            <DescList cols={2} items={[
              ['아이디', <Link key="id" to={`/admin/members/${encodeURIComponent(d.id)}`}>{d.id}</Link>], ['이름', d.name],
              ['기업', d.companyName ? `${d.companyName} (${d.companyCode})` : d.companyCode], ['과정', <span key="c">{d.courseName} <span className="muted">({d.lectureCode}{d.isPackage ? ` · 패키지 ${d.codes.join(', ')}` : ''})</span></span>],
              ['수강기간', `${d.period.start} ~ ${d.period.end}`], ['회차·유형', `termeIdx ${d.termeIdx ?? '-'} · ServiceType ${d.serviceType ?? '-'}`],
              ['학습시간', <span key="t">{d.formatted} <span className="muted">({d.seconds.toLocaleString('ko-KR')}초{d.packageSeconds !== undefined && d.packageSeconds !== d.seconds ? ` · 패키지 합계 ${d.packageFormatted}` : ''})</span></span>], ['달성률', <div key="p" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Bar value={d.percent} tone={d.over15h ? 'ok' : undefined} /><b>{d.percent}%</b><span className="muted">(저장값 {d.storedProgress}%)</span></div>],
              ['수료', <span key="po" style={{ display: 'inline-flex', gap: 4 }}><BoolBadge value={d.passOk} yes="수료" no={d.studyEnd ? '미수료' : '진행 중'} /><BoolBadge value={d.studyEnd} yes="마감" no="진행" tone="neutral" /></span>], ['실패 사유', d.failReason],
              ['사전/사후', `${d.preDone ? '완료' : '-'} / ${d.postDone ? '완료' : '-'}`], ['최근 학습', d.lastLearning],
              ['가격', d.price ? `${d.price.price.toLocaleString('ko-KR')}원 (환급 ${d.price.refund.toLocaleString('ko-KR')} · 자부담 ${d.price.self.toLocaleString('ko-KR')})` : null], ['영업·강사', [d.salesId, d.tutor].filter(Boolean).join(' · ')],
              ['학습 IP', d.studyIp], ['등록', `${d.inputDate ?? '-'}${d.remark ? ` · ${d.remark}` : ''}`],
            ]} />
          </Card>
          <Card title={c.chapters}><DataTable columns={chapterColumns} rows={d.chapters} rowKey={(r) => r.chapterSeq} dense /></Card>
          <Card title={c.daily} aside={overCount ? <StatusBadge tone="danger">8시간 초과 {overCount}일</StatusBadge> : <StatusBadge tone="ok">초과 없음</StatusBadge>}><DataTable columns={dailyColumns} rows={d.daily} rowKey={(r) => r.date} dense size={31} emptyTitle="학습 기록이 없습니다." emptyBody=" " /></Card>
          <Card title={c.overlap} aside={<StatusBadge tone={d.overlap.sharedMinutes ? 'danger' : 'ok'}>{d.overlap.sharedMinutes}분</StatusBadge>}>
            <Callout tone={d.overlap.sharedMinutes ? 'warn' : 'info'}>{d.overlap.rule}</Callout>
            {d.overlap.minutes.length ? <div className="u-mt-8"><DataTable columns={overlapCols} rows={d.overlap.minutes} rowKey={(r) => r.minute} dense size={50} /></div> : null}
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card title={`${c.identity} (${d.identity.length})`}><DataTable columns={identityCols} rows={d.identity} rowKey={(r) => r.seq} dense emptyTitle="본인인증 이력이 없습니다." emptyBody=" " /></Card>
            <Card title={`${c.corrections} (${d.corrections.length})`}><DataTable columns={correctionCols} rows={d.corrections} rowKey={(r) => r.idx} dense emptyTitle="보정 내역이 없습니다." emptyBody=" " /></Card>
          </div>
          <ProgressLog seq={n} />
        </div>
      )}
    </AdminPage>
  );
}
