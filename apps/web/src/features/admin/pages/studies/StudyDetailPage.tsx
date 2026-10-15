import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import { adminStudiesParityApi, type LearningRow } from '../../../../shared/api/endpoints/admin-studies-parity';
import type { ProgressLogRow, StudyDetail } from '../../../../shared/api/schemas';
import { AButton, Bar, BoolBadge, Callout, DataTable, DetailHeader, DetailPage, DetailTab, DetailTabs, InfoTable, PanelGrid, SectionPanel, StatusBadge, type Column } from '../../../../shared/ui/admin';
import styles from './StudyDetailPage.module.css';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { chapterColumns, dailyColumns } from '../../../manager/pages/TraineeDetailPage';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm, studyTime } from '../../strings';
import { useToast } from '../../../../app/providers/ToastProvider';
import { errorMessage } from '../../useAdminMutation';
import StudyCertificatePrintPage from './StudyCertificatePrintPage';
import { CertificateDialog, ChapterTicks, DayTimeDialog, GrantDialog, PostCellView, PreCellView, PreResumeDialog } from './studies-parity-dialogs';

const c = adm.studies.detail;
type Identity = StudyDetail['identity'][number];
type Correction = StudyDetail['corrections'][number];
type OverlapMinute = StudyDetail['overlap']['minutes'][number];

const identityCols: Column<Identity>[] = [
  { key: 'at', header: tr('인증 시각', 'Verified at'), nowrap: true, render: (r) => r.at ?? '' },
  { key: 'type', header: tr('유형', 'Type'), render: (r) => r.type ?? '' },
  { key: 'ok', header: tr('결과', 'Result'), align: 'center', render: (r) => <BoolBadge value={r.ok} yes={tr('성공', 'Success')} no={tr('실패', 'Failed')} /> },
  { key: 'ip', header: 'IP', render: (r) => <span className="mono">{r.ip ?? ''}</span> },
  { key: 'evalCd', header: 'EvalCD', render: (r) => r.evalCd ?? '' },
];
const correctionCols: Column<Correction>[] = [
  { key: 'appliedAt', header: tr('적용 시각', 'Applied at'), nowrap: true, render: (r) => r.appliedAt ?? '' },
  { key: 'action', header: tr('동작', 'Action'), render: (r) => r.action ?? '' },
  { key: 'oldSeconds', header: tr('이전(초)', 'Before (s)'), align: 'right' },
  { key: 'newSeconds', header: tr('이후(초)', 'After (s)'), align: 'right' },
  { key: 'deltaSeconds', header: tr('변화(초)', 'Change (s)'), align: 'right', render: (r) => <span style={{ color: r.deltaSeconds < 0 ? 'var(--c-danger)' : 'var(--c-ok)' }}>{r.deltaSeconds > 0 ? '+' : ''}{r.deltaSeconds}</span> },
  { key: 'note', header: tr('메모', 'Note'), render: (r) => r.note ?? '' },
];
const overlapCols: Column<OverlapMinute>[] = [
  { key: 'minute', header: tr('분(minute)', 'Minute'), nowrap: true },
  { key: 'contents', header: tr('동시 진행 Contents_idx', 'Concurrent Contents_idx'), render: (r) => r.contents.join(', ') },
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

/** progress_info_pop.php 학습 내역 columns. */
const learningCols: Column<LearningRow>[] = [
  { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56 },
  { key: 'serviceTypeLabel', header: tr('과정구분', 'Type'), align: 'center', nowrap: true },
  { key: 'courseName', header: tr('과정명', 'Course'), render: (r) => <>{r.courseName ?? ''}{r.contentsTitle ? <><br /><span className="muted" style={{ fontSize: 12 }}>└ {r.contentsTitle}</span></> : null}</> },
  { key: 'lectureCode', header: tr('과정코드', 'Code'), align: 'center', render: (r) => <span className="mono">{r.lectureCode}</span> },
  { key: 'chapterNo', header: tr('차시', 'Chapter'), align: 'center', render: (r) => tr(`${r.chapterNo}차시`, `#${r.chapterNo}`) },
  { key: 'progress', header: tr('진도율', 'Progress'), align: 'right', render: (r) => `${r.progress}%` },
  { key: 'studyTimeLabel', header: tr('수강시간', 'Study time'), nowrap: true },
  { key: 'startDate', header: tr('학습시작일', 'First log'), nowrap: true, render: (r) => r.startDate ?? '' },
  { key: 'endDate', header: tr('학습종료일', 'Last log'), nowrap: true, render: (r) => r.endDate ?? '' },
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
    <SectionPanel title={c.log} count={enabled ? rows.length : null}
      note={tr('플레이어가 약 1분마다 남긴 원본 저장 기록을 idx 커서로 읽습니다.', 'Reads the raw save records the player writes about once a minute, using an idx cursor.')}
      toolbar={!enabled ? <AButton size="sm" variant="primary" onClick={() => setEnabled(true)}>{tr('불러오기', 'Load')}</AButton> : undefined}>
      {enabled ? (
        <>
          <DataTable columns={logCols} rows={q.isPending ? undefined : rows} rowKey={(r) => r.idx} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense />
          <div className="u-mt-8" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {q.hasNextPage ? <AButton size="sm" onClick={() => void q.fetchNextPage()} loading={q.isFetchingNextPage}>{c.loadMore}</AButton> : rows.length ? <span className="muted" style={{ fontSize: 12 }}>{c.noMore}</span> : null}
          </div>
        </>
      ) : null}
    </SectionPanel>
  );
}

/**
 * /admin/studies/:seq — progress_info_pop.php. With ?print=certificate it renders the 수료증 1장 (certificate_pdf01.php?Seq=) print page,
 * so CertificateDialog's “수료증 PDF로 출력하기” works on the existing studies/:seq route (the same page also mounts at
 * studies/:seq/certificate/print when that route is wired).
 */
export default function StudyDetailPage() {
  const [params] = useSearchParams();
  return params.get('print') === 'certificate' ? <StudyCertificatePrintPage /> : <StudyDetailView />;
}

function StudyDetailView() {
  const { seq = '' } = useParams();
  const n = Number(seq);
  const q = useQuery({ queryKey: ['admin', 'studies', 'detail', n], queryFn: ({ signal }) => adminStudiesParityApi.detail(n, signal), enabled: Number.isFinite(n) && n > 0 });
  const d = q.data;
  const [openRow, setOpenRow] = useState<LearningRow | null>(null);
  const { toast } = useToast();
  const [xlsBusy, setXlsBusy] = useState<'excel' | 'log' | null>(null);
  const runCsv = async (kind: 'excel' | 'log', run: () => Promise<void>) => { setXlsBusy(kind); try { await run(); } catch (e) { toast(errorMessage(e), { tone: 'danger' }); } finally { setXlsBusy(null); } };
  // Older links (/admin/studies/:seq#learning) land on the 학습 내역 tab.
  const [sp, setSp] = useSearchParams();
  useEffect(() => { if (window.location.hash === '#learning' && !sp.get('tab')) { const next = new URLSearchParams(sp); next.set('tab', 'learning'); setSp(next, { replace: true }); } }, [sp, setSp]);
  const [dayTime, setDayTime] = useState<number | null>(null);
  const [cert, setCert] = useState<number | null>(null);
  const [resume, setResume] = useState<number | null>(null);
  const [grant, setGrant] = useState<{ seq: number; type: 'PRE' | 'POST' } | null>(null);
  if (q.isError) return <DetailPage><StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /></DetailPage>;
  if (q.isPending || !d) return <DetailPage><Skeleton height={140} /><Skeleton lines={8} /></DetailPage>;

  const passView = d.passOk ? <AButton variant="link" size="xs" disabled={!d.certificateLink} onClick={() => setCert(n)}><b style={{ color: '#0284c7' }}>{tr('수료', 'Passed')}</b></AButton> : <b style={{ color: '#ea580c' }}>{tr('미수료', 'Not passed')}</b>;
  const ph = d.progressHeader;
  const overCount = d.daily.filter((x) => x.status === 'over').length;
  const memberLink = <Link to={`/admin/members/${encodeURIComponent(d.id)}`}>{d.id}</Link>;
  const score = (v: number | null | undefined, st?: string | null) => (v === null || v === undefined ? null : `${v}${st ? ` (${st})` : ''})`);
  return (
    <DetailPage>
      <DetailHeader
        icon="book"
        title={d.courseName ?? d.lectureCode}
        subtitle={<>{d.name ?? ''} ({memberLink}){d.companyName ? ` · ${d.companyName}` : ''} · <span className="mono">{d.lectureCode}</span> · Seq {seq}</>}
        badges={<>
          {d.passOk ? <StatusBadge tone="ok">{tr('수료', 'Passed')}</StatusBadge> : <StatusBadge tone="warn">{d.studyEnd ? tr('미수료', 'Not passed') : tr('진행 중', 'In progress')}</StatusBadge>}
          <StatusBadge tone={d.studyEnd ? 'info' : 'neutral'}>{d.studyEnd ? tr('마감완료', 'Closed') : tr('미마감', 'Open')}</StatusBadge>
          {d.serviceTypeLabel ? <StatusBadge tone="neutral">{d.serviceTypeLabel}</StatusBadge> : null}
          {d.isPackage ? <StatusBadge tone="info">{tr('패키지', 'Package')}</StatusBadge> : null}
        </>}
        facts={[
          { label: tr('진도율', 'Progress'), value: `${ph ? ph.percent : d.percent}%`, hint: tr(`저장값 ${d.storedProgress}%`, `stored ${d.storedProgress}%`), tone: d.over15h ? 'ok' : undefined },
          { label: tr('수강시간', 'Study time'), value: ph ? ph.label : studyTime(d.seconds, d.formatted) },
          { label: tr('수강기간', 'Period'), value: `${d.period.start} ~ ${d.period.end}` },
          { label: tr('8시간 초과', 'Over 8 h'), value: tr(`${overCount}일`, `${overCount} days`), tone: overCount ? 'danger' : undefined },
          { label: tr('최근 학습', 'Last study'), value: d.lastLearning ? String(d.lastLearning).slice(0, 16) : null },
        ]}
        back={{ to: '/admin/studies', label: tr('목록', 'List') }}
        actions={<>
          <AButton icon="calendar-clock" onClick={() => setDayTime(n)}>{tr('일자별 수강시간', 'Study time by date')}</AButton>
          <AButton to={`/admin/members/${encodeURIComponent(d.id)}`} icon="user">{tr('회원 상세', 'Member details')}</AButton>
          <AButton to={`/admin/emon/diagnosis?id=${encodeURIComponent(d.id)}&course=${encodeURIComponent(d.lectureCode)}`} icon="activity">{tr('EMON 진단', 'EMON diagnosis')}</AButton>
        </>}
      />

      <DetailTabs>
        <DetailTab id="info" label={tr('수강 정보', 'Enrollment')} icon="info">
          <InfoTable groups={[
            { title: tr('수강', 'Enrollment'), rows: [
              { label: tr('과정명', 'Course'), value: <span>{d.courseName} <span className="muted">({d.lectureCode}{d.isPackage ? tr(` · 패키지 ${d.codes.join(', ')}`, ` · package ${d.codes.join(', ')}`) : ''})</span></span>, wide: true },
              { label: tr('이름', 'Name'), value: d.name }, { label: 'ID', value: memberLink },
              { label: tr('사업주', 'Company'), value: d.companyName ? `${d.companyName} (${d.companyCode})` : d.companyCode }, { label: tr('부서', 'Dept.'), value: d.depart },
              { label: tr('수강기간', 'Period'), value: `${d.period.start} ~ ${d.period.end}` }, { label: tr('수강신청일', 'Enrolled at'), value: d.inputDate },
              { label: tr('개설 용도', 'Purpose'), value: d.serviceTypeLabel }, { label: tr('실시회차', 'Round'), value: d.openChapter ?? null },
              { label: tr('회차·유형', 'Term · type'), value: `termeIdx ${d.termeIdx ?? '-'} · ServiceType ${d.serviceType ?? '-'}` }, { label: tr('교·강사', 'Tutor'), value: d.tutorName ?? d.tutor },
              { label: tr('영업담당자 / 소속', 'Sales rep / team'), value: [d.salesName ?? d.salesId, d.salesTeam].filter(Boolean).join(' / ') }, { label: tr('가격', 'Price'), value: d.price ? tr(`${d.price.price.toLocaleString('ko-KR')}원 (환급 ${d.price.refund.toLocaleString('ko-KR')} · 자부담 ${d.price.self.toLocaleString('ko-KR')})`, `KRW ${d.price.price.toLocaleString('ko-KR')} (refund ${d.price.refund.toLocaleString('ko-KR')} · self-pay ${d.price.self.toLocaleString('ko-KR')})`) : null },
            ] },
            { title: tr('진도 · 수료', 'Progress · completion'), rows: [
              { label: tr('수강시간(진도율)', 'Study time (progress)'), value: ph ? `${ph.label} (${ph.percent}%)` : `${d.formatted} (${d.percent}%)` },
              { label: tr('달성률', 'Progress'), value: <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Bar value={d.percent} tone={d.over15h ? 'ok' : undefined} /><b>{d.percent}%</b><span className="muted">{tr(`(저장값 ${d.storedProgress}%)`, `(stored ${d.storedProgress}%)`)}</span></div> },
              { label: tr('학습시간(초)', 'Study time (s)'), value: <span>{studyTime(d.seconds, d.formatted)} <span className="muted">({tr(`${d.seconds.toLocaleString('ko-KR')}초`, `${d.seconds.toLocaleString('ko-KR')} s`)}{d.packageSeconds !== undefined && d.packageSeconds !== d.seconds ? tr(` · 패키지 합계 ${d.packageFormatted}`, ` · package total ${studyTime(d.packageSeconds ?? 0, d.packageFormatted)}`) : ''})</span></span> },
              { label: tr('수료여부', 'Passed'), value: passView },
              { label: tr('수강마감', 'Closed'), value: <BoolBadge value={d.studyEnd} yes={tr('마감', 'Closed')} no={tr('진행', 'Open')} tone="neutral" /> }, { label: tr('실패 사유', 'Failure reason'), value: d.failReason },
              { label: tr('사전/사후', 'Pre / post'), value: `${d.preDone ? tr('완료', 'Done') : '-'} / ${d.postDone ? tr('완료', 'Done') : '-'}` }, { label: tr('최근 학습', 'Last study'), value: d.lastLearning },
              { label: tr('실명인증 날짜', 'Identity verified'), value: d.certDates.join(', ') }, { label: tr('학습 IP', 'Study IP'), value: d.studyIp ? <span className="mono">{d.studyIp}</span> : null },
              { label: tr('비고', 'Remark'), value: d.remark, wide: true },
            ] },
            ...(d.scores ? [{ title: tr('저장된 평가 점수 (Study)', 'Stored evaluation scores'), aside: <span className="muted" style={{ fontSize: 12 }}>{tr('아카이브 과정은 평가/과제를 쓰지 않아 대부분 비어 있습니다', 'Archive courses do not use these; mostly empty')}</span>, rows: [
              { label: tr('중간평가', 'Mid-term'), value: score(d.scores.midScore, d.scores.midStatus) }, { label: tr('최종평가', 'Final'), value: score(d.scores.testScore, d.scores.testStatus) },
              { label: tr('과제', 'Report'), value: score(d.scores.reportScore, d.scores.reportStatus) }, { label: tr('총점', 'Total'), value: d.scores.totalScore ?? null },
            ] }] : []),
          ]} />
          {d.assessment ? (
            <SectionPanel title={tr('사전 / 사후 역량진단', 'Pre / post assessment')}>
              <PanelGrid>
                <div className={styles.assessBox}><div className="muted" style={{ fontSize: 12 }}>{tr('사전', 'Pre')}</div><PreCellView cell={d.assessment.pre} onResume={() => setResume(n)} onOpen={() => setGrant({ seq: n, type: 'PRE' })} />
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{tr(`공통/리더십 ${d.assessment.counts.commonAnswered}/${d.assessment.counts.commonRequired} · 직급별 ${d.assessment.counts.roleAnswered}/${d.assessment.counts.roleRequired}`, `Common ${d.assessment.counts.commonAnswered}/${d.assessment.counts.commonRequired} · role ${d.assessment.counts.roleAnswered}/${d.assessment.counts.roleRequired}`)}</div></div>
                <div className={styles.assessBox}><div className="muted" style={{ fontSize: 12 }}>{tr('사후', 'Post')}</div><PostCellView cell={d.assessment.post} onOpen={() => setGrant({ seq: n, type: 'POST' })} />
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{tr(`총합 사후 점수 ${d.assessment.counts.postScore}`, `Post total ${d.assessment.counts.postScore}`)}</div></div>
              </PanelGrid>
            </SectionPanel>
          ) : null}
        </DetailTab>

        <DetailTab id="learning" label={tr('학습 내역', 'Learning record')} icon="checklist" count={d.learning?.items.length ?? null} hidden={!d.learning}>
          {d.learning ? (
            <SectionPanel title={tr('학습 내역', 'Learning record')} count={d.learning.items.length}
              note={tr('행을 누르면 그 차시의 상세 로그(틱)를 아래에 펼칩니다.', 'Click a row to open its tick log below.')}
              toolbar={<><AButton size="sm" icon="download" loading={xlsBusy === 'excel'} onClick={() => void runCsv('excel', () => adminStudiesParityApi.downloadProgressExcel(d.id))}>{tr('학습내역 엑셀 출력', 'Learning record CSV')}</AButton><AButton size="sm" icon="download" loading={xlsBusy === 'log'} onClick={() => void runCsv('log', () => adminStudiesParityApi.downloadProgressLogExcel([n]))}>{tr('진도로그 엑셀 출력', 'Progress log Excel')}</AButton></>}>
              <div id="learning">
                <DataTable columns={learningCols} rows={d.learning.items} rowKey={(r) => `${r.lectureCode}-${r.rowStudySeq}-${r.chapterSeq}`} dense size={200} onRowClick={(r) => setOpenRow(openRow && openRow.chapterSeq === r.chapterSeq && openRow.rowStudySeq === r.rowStudySeq ? null : r)} selectedKey={openRow ? `${openRow.lectureCode}-${openRow.rowStudySeq}-${openRow.chapterSeq}` : null}
                  emptyTitle={tr('학습 내역이 없습니다.', 'No learning record.')} emptyBody=" "
                  footer={d.learning.items.length ? <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, padding: '6px 4px' }}><span>{tr(`합계 (전체 ${d.learning.sum.chapters}차시 · 15시간=54,000초 기준)`, `Total (${d.learning.sum.chapters} chapters · 15 h = 54,000 s)`)}</span><b>{d.learning.sum.label} ({d.learning.sum.seconds.toLocaleString('ko-KR')}{tr('초', ' s')})</b><StatusBadge tone={d.learning.sum.met ? 'ok' : 'warn'}>{d.learning.sum.met ? tr('수강시간 충족', '15 h met') : tr('수강시간 미달', '15 h not met')}</StatusBadge></div> : undefined} />
              </div>
              {openRow ? <div className="u-mt-8"><ChapterTicks key={`${openRow.rowStudySeq}-${openRow.chapterSeq}`} seq={n} lectureCode={openRow.lectureCode} studySeq={openRow.rowStudySeq} chapterSeq={openRow.chapterSeq} /></div> : null}
            </SectionPanel>
          ) : null}
        </DetailTab>

        <DetailTab id="chapters" label={tr('차시별 진도', 'Chapters')} icon="layers" count={d.chapters.length}>
          <SectionPanel title={c.chapters} count={d.chapters.length}><DataTable columns={chapterColumns} rows={d.chapters} rowKey={(r) => r.chapterSeq} dense /></SectionPanel>
        </DetailTab>

        <DetailTab id="daily" label={tr('일자별 학습시간', 'By date')} icon="calendar" count={d.daily.length}>
          <SectionPanel title={c.daily} count={d.daily.length} toolbar={overCount ? <StatusBadge tone="danger">{tr(`8시간 초과 ${overCount}일`, `Over 8 h on ${overCount} days`)}</StatusBadge> : <StatusBadge tone="ok">{tr('초과 없음', 'None over')}</StatusBadge>}>
            <DataTable columns={dailyColumns} rows={d.daily} rowKey={(r) => r.date} dense size={31} emptyTitle={tr('학습 기록이 없습니다.', 'No study records.')} emptyBody=" " />
          </SectionPanel>
          <SectionPanel title={c.overlap} toolbar={<StatusBadge tone={d.overlap.sharedMinutes ? 'danger' : 'ok'}>{tr(`${d.overlap.sharedMinutes}분`, `${d.overlap.sharedMinutes} min`)}</StatusBadge>}>
            <Callout tone={d.overlap.sharedMinutes ? 'warn' : 'info'}>{d.overlap.rule}</Callout>
            {d.overlap.minutes.length ? <div className="u-mt-8"><DataTable columns={overlapCols} rows={d.overlap.minutes} rowKey={(r) => r.minute} dense size={50} /></div> : null}
          </SectionPanel>
        </DetailTab>

        <DetailTab id="checks" label={tr('본인인증 · 보정', 'Identity · corrections')} icon="shield" count={d.identity.length + d.corrections.length}>
          <PanelGrid>
            <SectionPanel title={c.identity} count={d.identity.length}><DataTable columns={identityCols} rows={d.identity} rowKey={(r) => r.seq} dense emptyTitle={tr('본인인증 이력이 없습니다.', 'No identity checks.')} emptyBody=" " /></SectionPanel>
            <SectionPanel title={c.corrections} count={d.corrections.length}><DataTable columns={correctionCols} rows={d.corrections} rowKey={(r) => r.idx} dense emptyTitle={tr('보정 내역이 없습니다.', 'No corrections.')} emptyBody=" " /></SectionPanel>
          </PanelGrid>
        </DetailTab>

        <DetailTab id="log" label={tr('진도 로그', 'Progress log')} icon="clock">
          <ProgressLog seq={n} />
        </DetailTab>
      </DetailTabs>

      <DayTimeDialog seq={dayTime} onClose={() => setDayTime(null)} />
      <CertificateDialog seq={cert} onClose={() => setCert(null)} />
      <PreResumeDialog seq={resume} onClose={() => setResume(null)} />
      <GrantDialog target={grant} onClose={() => setGrant(null)} onDone={() => void q.refetch()} />
    </DetailPage>
  );
}
