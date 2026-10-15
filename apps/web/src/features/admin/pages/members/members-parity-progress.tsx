import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { adminMembersParityApi } from '../../../../shared/api/endpoints/admin-members-parity';
import { adminStudiesParityApi, type LearningRow } from '../../../../shared/api/endpoints/admin-studies-parity';
import type { ProgressLogRow } from '../../../../shared/api/schemas';
import { AButton, Callout, Card, DataTable, DescList, DetailDrawer, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { useToast } from '../../../../app/providers/ToastProvider';
import { errorMessage } from '../../useAdminMutation';
import { tr } from '../../../../shared/i18n/adminLang';
import { sanitizeLegacyHtml } from '../../../../shared/utils/legacyHtml';

/**
 * progress_info_pop.php opened from 수강생 상세 (진도율 / 진도 로그 · 보기) for staff who have 수강생 관리 (A2) but no
 * 학습관리 (B) grant: the old popup only checked the admin login, so it reads through /admin/members/:id/studies/:seq.
 */

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

const logCols: Column<ProgressLogRow>[] = [
  { key: 'idx', header: 'idx', align: 'right' },
  { key: 'chapterNumber', header: tr('차시', 'Chapter'), render: (r) => `${r.chapterNumber ?? r.chapterSeq}` },
  { key: 'title', header: tr('콘텐츠', 'Content'), render: (r) => r.title ?? `#${r.contentsIdx}` },
  { key: 'progress', header: tr('진도', 'Progress'), align: 'right', render: (r) => `${r.progress}%` },
  { key: 'studyTime', header: tr('학습시간(초)', 'Study time (s)'), align: 'right' },
  { key: 'positionSec', header: tr('재생위치', 'Position'), align: 'right', render: (r) => r.positionSec ?? '' },
  { key: 'ip', header: 'IP', render: (r) => <span className="mono">{r.ip ?? ''}</span> },
  { key: 'at', header: tr('저장 시각', 'Saved at'), nowrap: true, render: (r) => r.at ?? '' },
];

/** progress_info_pop_log.php: the clicked chapter's save ticks; same-minute ticks in red. */
function MemberChapterTicks({ memberId, seq, row }: { memberId: string; seq: number; row: LearningRow }) {
  const q = useQuery({
    queryKey: ['admin', 'member', memberId, 'study', seq, 'chapter-log', row.lectureCode, row.rowStudySeq, row.chapterSeq],
    queryFn: ({ signal }) => adminMembersParityApi.memberChapterLog(memberId, seq, { lectureCode: row.lectureCode, studySeq: row.rowStudySeq, chapterSeq: row.chapterSeq }, signal),
  });
  const d = q.data && q.data.mode === 'ticks' ? q.data : null;
  const rows = useMemo(() => d?.items ?? [], [d]);
  type Tick = (typeof rows)[number];
  const cols: Column<Tick>[] = [
    { key: 'no', header: tr('순번', 'No.'), align: 'right', width: 56 },
    { key: 'progress', header: tr('차시 진도', 'Chapter progress'), align: 'right', render: (r) => `${r.progress}%` },
    { key: 'studyTimeLabel', header: tr('학습시간', 'Study time'), nowrap: true, render: (r) => <span style={r.sameMinute ? { color: 'var(--c-danger)', fontWeight: 700 } : undefined}>{r.studyTimeLabel}</span> },
    { key: 'positionSec', header: tr('재생위치', 'Position'), align: 'right', render: (r) => r.positionSec ?? '-' },
    { key: 'ip', header: tr('수강 IP', 'IP'), render: (r) => <span className="mono">{r.ip ?? ''}</span> },
    { key: 'at', header: tr('수강시간', 'Recorded at'), nowrap: true, render: (r) => <span style={r.sameMinute ? { color: 'var(--c-danger)' } : undefined}>{r.at}</span> },
    { key: 'lastStudy', header: tr('최종 강의 페이지', 'Last page'), render: (r) => r.lastStudy ?? '' },
  ];
  return (
    <div style={{ padding: '6px 0 6px 12px' }}>
      <b style={{ fontSize: 13 }}>{tr(`${d?.chapterNo ?? row.chapterNo}차시 상세 로그`, `Chapter ${d?.chapterNo ?? row.chapterNo} log`)}</b>
      {d && d.sameCount > 0 ? <Callout tone="warn" className="u-mt-8">{tr(`빨간색 ${d.sameCount}행은 같은 분에 다른 차시도 학습시간이 함께 늘어난 기록입니다.`, `${d.sameCount} red row(s): another chapter also gained time in the same minute.`)}</Callout> : null}
      <div className="u-mt-8"><DataTable columns={cols} rows={q.isPending ? undefined : rows} rowKey={(r) => r.idx} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense size={100} emptyTitle={tr('차시 상세 내역이 없습니다.', 'No log rows.')} emptyBody=" " /></div>
    </div>
  );
}

function MemberProgressLog({ memberId, seq }: { memberId: string; seq: number }) {
  const [enabled, setEnabled] = useState(false);
  const q = useInfiniteQuery({
    queryKey: ['admin', 'member', memberId, 'study', seq, 'progress-log'],
    queryFn: ({ pageParam, signal }) => adminMembersParityApi.memberProgressLog(memberId, seq, pageParam, 100, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore && last.nextCursor !== null ? last.nextCursor : undefined),
    enabled,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Card title="ProgressLog" aside={!enabled ? <AButton size="sm" onClick={() => setEnabled(true)}>{tr('불러오기', 'Load')}</AButton> : <span className="muted" style={{ fontSize: 12 }}>{tr(`${rows.length}행`, `${rows.length} rows`)}</span>}>
      {enabled ? (
        <>
          <DataTable columns={logCols} rows={q.isPending ? undefined : rows} rowKey={(r) => r.idx} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense size={500} />
          {q.hasNextPage ? <div className="u-mt-8"><AButton size="sm" onClick={() => void q.fetchNextPage()} loading={q.isFetchingNextPage}>{tr('더 불러오기', 'Load more')}</AButton></div> : null}
        </>
      ) : <p className="muted" style={{ fontSize: 13, margin: 0 }}>{tr('플레이어가 약 1분마다 남긴 원본 저장 기록입니다.', 'Raw save records the player writes about once a minute.')}</p>}
    </Card>
  );
}

/** progress_info_pop.php in a drawer: 수강 정보 header, 학습 내역 (row → chapter ticks), 학습내역 엑셀, raw ProgressLog. */
export function MemberProgressDrawer({ memberId, seq, onClose }: { memberId: string; seq: number | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'member', memberId, 'study', seq], queryFn: ({ signal }) => adminMembersParityApi.memberStudyProgress(memberId, seq!, signal), enabled: seq !== null });
  const d = q.data;
  const [openRow, setOpenRow] = useState<LearningRow | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const excel = async () => { setBusy(true); try { await adminStudiesParityApi.downloadProgressExcel(memberId); } catch (e) { toast(errorMessage(e), { tone: 'danger' }); } finally { setBusy(false); } };
  const key = (r: LearningRow) => `${r.lectureCode}-${r.rowStudySeq}-${r.chapterSeq}`;
  const ph = d?.progressHeader;
  return (
    <DetailDrawer open={seq !== null} onClose={() => { setOpenRow(null); onClose(); }} wide title={tr('학습내역 상세', 'Learning record')} subtitle={seq ? `Seq ${seq}` : undefined}
      footer={<><AButton loading={busy} onClick={() => void excel()}>{tr('학습내역 엑셀 출력', 'Learning record CSV')}</AButton><AButton onClick={() => { setOpenRow(null); onClose(); }}>{tr('닫기', 'Close')}</AButton></>}>
      {q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /> : q.isPending || !d ? <Skeleton lines={6} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card title={tr('수강 정보', 'Enrollment')}>
            <DescList cols={2} items={[
              [tr('과정명', 'Course'), d.courseName], [tr('이름', 'Name'), d.name], ['ID', d.id], [tr('사업주', 'Company'), d.companyName ?? d.companyCode],
              [tr('수강시간(진도율)', 'Study time (progress)'), ph ? `${ph.label} (${ph.percent}%)` : `${d.formatted} (${d.percent}%)`], [tr('수강기간', 'Period'), `${d.period.start} ~ ${d.period.end}`],
              [tr('수료여부', 'Passed'), d.passOk ? <b key="p" style={{ color: '#0284c7' }}>{tr('수료', 'Passed')}</b> : <b key="p" style={{ color: '#ea580c' }}>{tr('미수료', 'Not passed')}</b>], [tr('교·강사', 'Tutor'), d.tutorName ?? d.tutor],
            ]} />
          </Card>
          {d.learning ? (
            <Card title={tr('학습 내역 (차시를 누르면 진도 로그)', 'Learning record (click a chapter for its log)')}>
              <DataTable columns={learningCols} rows={d.learning.items} rowKey={key} dense size={200} onRowClick={(r) => setOpenRow(openRow && key(openRow) === key(r) ? null : r)} selectedKey={openRow ? key(openRow) : null}
                emptyTitle={tr('학습 내역이 없습니다.', 'No learning record.')} emptyBody=" "
                footer={d.learning.items.length ? <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, padding: '6px 4px' }}><span>{tr(`합계 (전체 ${d.learning.sum.chapters}차시 · 15시간=54,000초 기준)`, `Total (${d.learning.sum.chapters} chapters · 15 h = 54,000 s)`)}</span><b>{d.learning.sum.label} ({d.learning.sum.seconds.toLocaleString('ko-KR')}{tr('초', ' s')})</b><StatusBadge tone={d.learning.sum.met ? 'ok' : 'warn'}>{d.learning.sum.met ? tr('수강시간 충족', '15 h met') : tr('수강시간 미달', '15 h not met')}</StatusBadge></div> : undefined} />
              {openRow ? <MemberChapterTicks key={key(openRow)} memberId={memberId} seq={d.studySeq} row={openRow} /> : <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>{tr('행을 누르면 그 차시의 상세 로그(틱)를 펼칩니다.', 'Click a row to open its tick log.')}</p>}
            </Card>
          ) : null}
          <MemberProgressLog memberId={memberId} seq={d.studySeq} />
        </div>
      )}
    </DetailDrawer>
  );
}

/** qna_read.php?idx= (read-only). Answering / 삭제 stay on 1:1 상담문의; the link is shown to staff who hold that menu (F3). */
export function MemberInquiryDrawer({ memberId, idx, canAnswer, onClose }: { memberId: string; idx: number | null; canAnswer: boolean; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'member', memberId, 'inquiry', idx], queryFn: ({ signal }) => adminMembersParityApi.memberInquiry(memberId, idx!, signal), enabled: idx !== null });
  const d = q.data;
  const answerHref = `/admin/counsel?col=ID&q=${encodeURIComponent(memberId)}&open=${idx ?? ''}`;
  return (
    <DetailDrawer open={idx !== null} onClose={onClose} wide title={tr('1:1 상담문의', '1:1 inquiry')} subtitle={idx ? `#${idx}` : undefined}
      footer={<>{canAnswer ? <Link to={answerHref} target="_blank" rel="noopener noreferrer" className="u-link" style={{ alignSelf: 'center', fontSize: 13 }}>{tr('1:1 상담문의에서 답변하기', 'Answer in 1:1 inquiries')}</Link> : null}<AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton></>}>
      {q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /> : q.isPending || !d ? <Skeleton lines={6} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card title={tr('문의', 'Inquiry')}>
            <DescList cols={1} items={[
              ...(d.lectureCode ? [[tr('과정명', 'Course'), d.courseName], [tr('차시명', 'Chapter'), d.contentsTitle]] as [string, string | null | undefined][] : []),
              [tr('문의 제목', 'Title'), d.title], [tr('이름', 'Name'), d.name], [tr('아이디', 'User ID'), d.id], [tr('연락처', 'Phone'), d.mobile], [tr('이메일', 'Email'), d.email],
              [tr('등록일시', 'Registered'), d.regDate], [tr('답변일시', 'Answered'), d.answeredAt ?? '-'],
              [tr('내용', 'Contents'), <div key="c" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: sanitizeLegacyHtml(d.contents) }} />],
              ...(d.studentFile ? [[tr('첨부된 파일', 'Attachment'), d.studentFile]] as [string, string][] : []),
            ]} />
          </Card>
          <Card title={tr('답변', 'Answer')}>
            <DescList cols={1} items={[
              [tr('처리 상태', 'Status'), <StatusBadge key="s" tone={d.status === 'B' ? 'ok' : 'warn'}>{d.statusLabel || '-'}</StatusBadge>], [tr('작성자', 'Answered by'), d.answerName],
              ...d.answerFiles.map((f) => [tr(`첨부파일 ${f.no}`, `File ${f.no}`), f.name] as [string, string]),
              [tr('답변 내용', 'Answer'), d.answer ? <div key="a" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: sanitizeLegacyHtml(d.answer) }} /> : '-'],
            ]} />
          </Card>
        </div>
      )}
    </DetailDrawer>
  );
}
