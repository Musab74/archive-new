import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import { adminStudiesParityApi, type LearningRow } from '../../../../shared/api/endpoints/admin-studies-parity';
import type { ProgressLogRow, StudyDetail } from '../../../../shared/api/schemas';
import { AButton, AdminPage, Bar, BoolBadge, Callout, Card, DataTable, DescList, StatusBadge, type Column } from '../../../../shared/ui/admin';
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
    <Card title={c.log} aside={!enabled ? <AButton size="sm" onClick={() => setEnabled(true)}>{tr('불러오기', 'Load')}</AButton> : <span className="muted" style={{ fontSize: 12 }}>{tr(`${rows.length}행`, `${rows.length} rows`)}</span>}>
      {enabled ? (
        <>
          <DataTable columns={logCols} rows={q.isPending ? undefined : rows} rowKey={(r) => r.idx} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense />
          <div className="u-mt-8" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {q.hasNextPage ? <AButton size="sm" onClick={() => void q.fetchNextPage()} loading={q.isFetchingNextPage}>{c.loadMore}</AButton> : rows.length ? <span className="muted" style={{ fontSize: 12 }}>{c.noMore}</span> : null}
          </div>
        </>
      ) : <p className="muted" style={{ fontSize: 13, margin: 0 }}>{tr('플레이어가 약 1분마다 남긴 원본 저장 기록을 idx 커서로 읽습니다.', 'Reads the raw save records the player writes about once a minute, using an idx cursor.')}</p>}
    </Card>
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
  // /admin/studies/:seq#learning (from the member page's 진도 로그 button) scrolls to the 학습 내역 block once it renders
  useEffect(() => { if (d && window.location.hash === '#learning') document.getElementById('learning')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [d]);
  const [dayTime, setDayTime] = useState<number | null>(null);
  const [cert, setCert] = useState<number | null>(null);
  const [resume, setResume] = useState<number | null>(null);
  const [grant, setGrant] = useState<{ seq: number; type: 'PRE' | 'POST' } | null>(null);
  const passView = d ? (d.passOk ? <AButton key="pv" variant="link" size="xs" disabled={!d.certificateLink} onClick={() => setCert(n)}><b style={{ color: '#0284c7' }}>{tr('수료', 'Passed')}</b></AButton> : <b key="pv" style={{ color: '#ea580c' }}>{tr('미수료', 'Not passed')}</b>) : null;
  const ph = d?.progressHeader;
  const overCount = d?.daily.filter((x) => x.status === 'over').length ?? 0;
  return (
    <AdminPage title={`${c.title} · Seq ${seq}${d ? ` · ${d.name ?? d.id}` : ''}`} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: adm.studies.title, to: '/admin/studies' }, { label: `Seq ${seq}` }]}
      actions={<><AButton to="/admin/studies">{adm.common.back}</AButton>{d ? <AButton to={`/admin/members/${encodeURIComponent(d.id)}`}>{tr('회원 상세', 'Member details')}</AButton> : null}{d ? <AButton to={`/admin/emon/diagnosis?id=${encodeURIComponent(d.id)}&course=${encodeURIComponent(d.lectureCode)}`}>{tr('EMON 진단', 'EMON diagnosis')}</AButton> : null}</>}>
      {q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /> : q.isPending || !d ? <Skeleton lines={8} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card title={tr('수강 정보', 'Enrollment')} aside={<AButton size="sm" onClick={() => setDayTime(n)}>{tr('일자별 수강시간', 'Study time by date')}</AButton>}>
            <DescList cols={2} items={[
              [tr('과정명', 'Course'), d.courseName], [tr('이름', 'Name'), d.name], ['ID', <Link key="id" to={`/admin/members/${encodeURIComponent(d.id)}`}>{d.id}</Link>], [tr('사업주', 'Company'), d.companyName ?? d.companyCode],
              [tr('수강시간(진도율)', 'Study time (progress)'), ph ? `${ph.label} (${ph.percent}%)` : `${d.formatted} (${d.percent}%)`], [tr('수강기간', 'Period'), `${d.period.start} ~ ${d.period.end}`],
              [tr('수료여부', 'Passed'), passView], [tr('교·강사', 'Tutor'), d.tutorName ?? d.tutor],
              [tr('개설 용도', 'Purpose'), d.serviceTypeLabel], [tr('실시회차', 'Round'), d.openChapter ?? null],
              [tr('영업담당자 / 소속', 'Sales rep / team'), [d.salesName ?? d.salesId, d.salesTeam].filter(Boolean).join(' / ')], [tr('부서', 'Dept.'), d.depart],
              [tr('실명인증 날짜', 'Identity verified'), d.certDates.join(', ')], [tr('수강신청일', 'Enrolled at'), d.inputDate],
            ]} />
          </Card>
          {d.assessment ? (
            <Card title={tr('사전 / 사후 역량진단', 'Pre / post assessment')}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, textAlign: 'center' }}>
                <div><div className="muted" style={{ fontSize: 12 }}>{tr('사전', 'Pre')}</div><PreCellView cell={d.assessment.pre} onResume={() => setResume(n)} onOpen={() => setGrant({ seq: n, type: 'PRE' })} />
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{tr(`공통/리더십 ${d.assessment.counts.commonAnswered}/${d.assessment.counts.commonRequired} · 직급별 ${d.assessment.counts.roleAnswered}/${d.assessment.counts.roleRequired}`, `Common ${d.assessment.counts.commonAnswered}/${d.assessment.counts.commonRequired} · role ${d.assessment.counts.roleAnswered}/${d.assessment.counts.roleRequired}`)}</div></div>
                <div><div className="muted" style={{ fontSize: 12 }}>{tr('사후', 'Post')}</div><PostCellView cell={d.assessment.post} onOpen={() => setGrant({ seq: n, type: 'POST' })} />
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{tr(`총합 사후 점수 ${d.assessment.counts.postScore}`, `Post total ${d.assessment.counts.postScore}`)}</div></div>
              </div>
            </Card>
          ) : null}
          {d.learning ? (
            <div id="learning" style={{ scrollMarginTop: 160 }}><Card title={tr('학습 내역 (차시를 누르면 진도 로그)', 'Learning record (click a chapter for its log)')} aside={<span style={{ display: 'inline-flex', gap: 6 }}><AButton size="sm" loading={xlsBusy === 'excel'} onClick={() => void runCsv('excel', () => adminStudiesParityApi.downloadProgressExcel(d.id))}>{tr('학습내역 엑셀 출력', 'Learning record CSV')}</AButton><AButton size="sm" loading={xlsBusy === 'log'} onClick={() => void runCsv('log', () => adminStudiesParityApi.downloadProgressLogExcel([n]))}>{tr('진도로그 엑셀 출력', 'Progress log Excel')}</AButton></span>}>
              <DataTable columns={learningCols} rows={d.learning.items} rowKey={(r) => `${r.lectureCode}-${r.rowStudySeq}-${r.chapterSeq}`} dense size={200} onRowClick={(r) => setOpenRow(openRow && openRow.chapterSeq === r.chapterSeq && openRow.rowStudySeq === r.rowStudySeq ? null : r)} selectedKey={openRow ? `${openRow.lectureCode}-${openRow.rowStudySeq}-${openRow.chapterSeq}` : null}
                emptyTitle={tr('학습 내역이 없습니다.', 'No learning record.')} emptyBody=" "
                footer={d.learning.items.length ? <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, padding: '6px 4px' }}><span>{tr(`합계 (전체 ${d.learning.sum.chapters}차시 · 15시간=54,000초 기준)`, `Total (${d.learning.sum.chapters} chapters · 15 h = 54,000 s)`)}</span><b>{d.learning.sum.label} ({d.learning.sum.seconds.toLocaleString('ko-KR')}{tr('초', ' s')})</b><StatusBadge tone={d.learning.sum.met ? 'ok' : 'warn'}>{d.learning.sum.met ? tr('수강시간 충족', '15 h met') : tr('수강시간 미달', '15 h not met')}</StatusBadge></div> : undefined} />
              {openRow ? <ChapterTicks key={`${openRow.rowStudySeq}-${openRow.chapterSeq}`} seq={n} lectureCode={openRow.lectureCode} studySeq={openRow.rowStudySeq} chapterSeq={openRow.chapterSeq} /> : <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>{tr('행을 누르면 그 차시의 상세 로그(틱)를 펼칩니다.', 'Click a row to open its tick log.')}</p>}
            </Card></div>
          ) : null}
          {d.scores ? (
            <Card title={tr('저장된 평가 점수 (Study)', 'Stored evaluation scores')}>
              <DescList cols={2} items={[[tr('중간평가', 'Mid-term'), d.scores.midScore === null || d.scores.midScore === undefined ? null : `${d.scores.midScore}${d.scores.midStatus ? ` (${d.scores.midStatus})` : ''}`], [tr('최종평가', 'Final'), d.scores.testScore === null || d.scores.testScore === undefined ? null : `${d.scores.testScore}${d.scores.testStatus ? ` (${d.scores.testStatus})` : ''}`], [tr('과제', 'Report'), d.scores.reportScore === null || d.scores.reportScore === undefined ? null : `${d.scores.reportScore}${d.scores.reportStatus ? ` (${d.scores.reportStatus})` : ''}`], [tr('총점', 'Total'), d.scores.totalScore ?? null]]} />
              <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>{tr('아카이브 과정은 평가/과제를 쓰지 않아 대부분 비어 있습니다(기존 학습관리 목록·엑셀에서도 제외된 칸).', 'Archive courses do not use these; mostly empty (also dropped from the previous list/excel).')}</p>
            </Card>
          ) : null}
          <Card title={c.info}>
            <DescList cols={2} items={[
              [tr('아이디', 'User ID'), <Link key="id" to={`/admin/members/${encodeURIComponent(d.id)}`}>{d.id}</Link>], [tr('이름', 'Name'), d.name],
              [tr('기업', 'Company'), d.companyName ? `${d.companyName} (${d.companyCode})` : d.companyCode], [tr('과정', 'Course'), <span key="c">{d.courseName} <span className="muted">({d.lectureCode}{d.isPackage ? tr(` · 패키지 ${d.codes.join(', ')}`, ` · package ${d.codes.join(', ')}`) : ''})</span></span>],
              [tr('수강기간', 'Period'), `${d.period.start} ~ ${d.period.end}`], [tr('회차·유형', 'Term · type'), `termeIdx ${d.termeIdx ?? '-'} · ServiceType ${d.serviceType ?? '-'}`],
              [tr('학습시간', 'Study time'), <span key="t">{studyTime(d.seconds, d.formatted)} <span className="muted">({tr(`${d.seconds.toLocaleString('ko-KR')}초`, `${d.seconds.toLocaleString('ko-KR')} s`)}{d.packageSeconds !== undefined && d.packageSeconds !== d.seconds ? tr(` · 패키지 합계 ${d.packageFormatted}`, ` · package total ${studyTime(d.packageSeconds ?? 0, d.packageFormatted)}`) : ''})</span></span>], [tr('달성률', 'Progress'), <div key="p" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Bar value={d.percent} tone={d.over15h ? 'ok' : undefined} /><b>{d.percent}%</b><span className="muted">{tr(`(저장값 ${d.storedProgress}%)`, `(stored ${d.storedProgress}%)`)}</span></div>],
              [tr('수료', 'Passed'), <span key="po" style={{ display: 'inline-flex', gap: 4 }}><BoolBadge value={d.passOk} yes={tr('수료', 'Passed')} no={d.studyEnd ? tr('미수료', 'Not passed') : tr('진행 중', 'In progress')} /><BoolBadge value={d.studyEnd} yes={tr('마감', 'Closed')} no={tr('진행', 'Open')} tone="neutral" /></span>], [tr('실패 사유', 'Failure reason'), d.failReason],
              [tr('사전/사후', 'Pre / post'), `${d.preDone ? tr('완료', 'Done') : '-'} / ${d.postDone ? tr('완료', 'Done') : '-'}`], [tr('최근 학습', 'Last study'), d.lastLearning],
              [tr('가격', 'Price'), d.price ? tr(`${d.price.price.toLocaleString('ko-KR')}원 (환급 ${d.price.refund.toLocaleString('ko-KR')} · 자부담 ${d.price.self.toLocaleString('ko-KR')})`, `KRW ${d.price.price.toLocaleString('ko-KR')} (refund ${d.price.refund.toLocaleString('ko-KR')} · self-pay ${d.price.self.toLocaleString('ko-KR')})`) : null], [tr('영업·강사', 'Sales · tutor'), [d.salesId, d.tutor].filter(Boolean).join(' · ')],
              [tr('학습 IP', 'Study IP'), d.studyIp], [tr('등록', 'Registered'), `${d.inputDate ?? '-'}${d.remark ? ` · ${d.remark}` : ''}`],
            ]} />
          </Card>
          <Card title={c.chapters}><DataTable columns={chapterColumns} rows={d.chapters} rowKey={(r) => r.chapterSeq} dense /></Card>
          <Card title={c.daily} aside={overCount ? <StatusBadge tone="danger">{tr(`8시간 초과 ${overCount}일`, `Over 8 h on ${overCount} days`)}</StatusBadge> : <StatusBadge tone="ok">{tr('초과 없음', 'None over')}</StatusBadge>}><DataTable columns={dailyColumns} rows={d.daily} rowKey={(r) => r.date} dense size={31} emptyTitle={tr('학습 기록이 없습니다.', 'No study records.')} emptyBody=" " /></Card>
          <Card title={c.overlap} aside={<StatusBadge tone={d.overlap.sharedMinutes ? 'danger' : 'ok'}>{tr(`${d.overlap.sharedMinutes}분`, `${d.overlap.sharedMinutes} min`)}</StatusBadge>}>
            <Callout tone={d.overlap.sharedMinutes ? 'warn' : 'info'}>{d.overlap.rule}</Callout>
            {d.overlap.minutes.length ? <div className="u-mt-8"><DataTable columns={overlapCols} rows={d.overlap.minutes} rowKey={(r) => r.minute} dense size={50} /></div> : null}
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card title={`${c.identity} (${d.identity.length})`}><DataTable columns={identityCols} rows={d.identity} rowKey={(r) => r.seq} dense emptyTitle={tr('본인인증 이력이 없습니다.', 'No identity checks.')} emptyBody=" " /></Card>
            <Card title={`${c.corrections} (${d.corrections.length})`}><DataTable columns={correctionCols} rows={d.corrections} rowKey={(r) => r.idx} dense emptyTitle={tr('보정 내역이 없습니다.', 'No corrections.')} emptyBody=" " /></Card>
          </div>
          <ProgressLog seq={n} />
        </div>
      )}
      <DayTimeDialog seq={dayTime} onClose={() => setDayTime(null)} />
      <CertificateDialog seq={cert} onClose={() => setCert(null)} />
      <PreResumeDialog seq={resume} onClose={() => setResume(null)} />
      <GrantDialog target={grant} onClose={() => setGrant(null)} onDone={() => void q.refetch()} />
    </AdminPage>
  );
}
