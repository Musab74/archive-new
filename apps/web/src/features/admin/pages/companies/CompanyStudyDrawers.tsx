import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AButton, Callout, DataTable, DescList, DetailDrawer, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { formatNumber } from '../../../../shared/utils/format';
import { tr } from '../../../../shared/i18n/adminLang';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { adm } from '../../strings';
import { companiesApi, type CompanyChapterLog, type CompanyStudyProgress } from './companiesApi';

type LearningItem = CompanyStudyProgress['learning']['items'][number];
type TickItem = Extract<CompanyChapterLog, { mode: 'ticks' }>['items'][number];

/** progress_info_pop.php 학습 내역 columns: 번호, 과정구분, 과정명, 과정코드, 차시, 진도율, 수강시간, 학습시작일, 학습종료일. */
const learningCols: Column<LearningItem>[] = [
  { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 52 },
  { key: 'serviceTypeLabel', header: tr('과정구분', 'Type'), nowrap: true },
  { key: 'courseName', header: tr('과정명', 'Course'), render: (r) => r.courseName ?? r.lectureCode },
  { key: 'lectureCode', header: tr('과정코드', 'Course code'), nowrap: true, render: (r) => <span className="mono">{r.lectureCode}</span> },
  { key: 'chapterNo', header: tr('차시', 'Chapter'), align: 'right', render: (r) => <span title={r.contentsTitle ?? ''}>{r.chapterNo}{r.contentsTitle ? <small className="muted"> {r.contentsTitle}</small> : null}</span> },
  { key: 'progress', header: tr('진도율', 'Progress'), align: 'right', render: (r) => `${r.progress}%` },
  { key: 'studyTimeLabel', header: tr('수강시간', 'Study time'), nowrap: true },
  { key: 'startDate', header: tr('학습시작일', 'Started'), nowrap: true, render: (r) => r.startDate ?? '' },
  { key: 'endDate', header: tr('학습종료일', 'Last study'), nowrap: true, render: (r) => r.endDate ?? '' },
];
const tickCols: Column<TickItem>[] = [
  { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 52 },
  { key: 'at', header: tr('기록 시각', 'Saved at'), nowrap: true, render: (r) => <span style={r.sameMinute ? { color: 'var(--c-danger)', fontWeight: 700 } : undefined}>{r.at}</span> },
  { key: 'positionSec', header: tr('재생 위치(초)', 'Position (s)'), align: 'right', render: (r) => (r.positionSec === null ? '' : formatNumber(r.positionSec)) },
  { key: 'studyTimeLabel', header: tr('인정 시간', 'Credited'), nowrap: true },
  { key: 'progress', header: tr('진도', 'Progress'), align: 'right', render: (r) => `${r.progress}%` },
  { key: 'ip', header: 'IP', nowrap: true, render: (r) => r.ip ?? '' },
];

/**
 * ProgressInfo() (progress_info_pop.php) inside 사업주 상세: 수강시간(진도율) header + 학습 내역 per chapter; clicking a chapter
 * opens its tick log (progress_info_pop_log.php, same-minute ticks in red). Served by the companies API, so 사업주 관리(A1) is enough.
 */
export function ProgressDrawer({ companyIdx, seq, onClose, canOpenStudy }: { companyIdx: number; seq: number | null; onClose: () => void; canOpenStudy: boolean }) {
  const q = useQuery({ queryKey: ['admin', 'company', companyIdx, 'study', seq, 'progress'], queryFn: ({ signal }) => companiesApi.studyProgress(companyIdx, seq!, signal), enabled: seq !== null });
  const [chapter, setChapter] = useState<LearningItem | null>(null);
  const log = useQuery({
    queryKey: ['admin', 'company', companyIdx, 'study', seq, 'chapter', chapter?.lectureCode, chapter?.rowStudySeq, chapter?.chapterSeq],
    queryFn: ({ signal }) => companiesApi.chapterLog(companyIdx, seq!, { lectureCode: chapter!.lectureCode, studySeq: chapter!.rowStudySeq, chapterSeq: chapter!.chapterSeq }, signal),
    enabled: seq !== null && !!chapter,
  });
  const d = q.data;
  const close = () => { setChapter(null); onClose(); };
  // 학습내역 엑셀 출력 (StudyProgressExcel(ID) → study_progress_excel.php)
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const exportExcel = async () => {
    if (seq === null) return;
    setExporting(true);
    try { await companiesApi.downloadStudyProgressExcel(companyIdx, seq); }
    catch (err) { toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); }
    finally { setExporting(false); }
  };
  return (
    <DetailDrawer open={seq !== null} onClose={close} wide title={tr('학습내역 상세 정보', 'Learning history detail')} subtitle={d ? `${d.study.name ?? ''} (${d.study.id}) · ${d.study.courseName}` : ''}
      footer={<>{canOpenStudy && seq !== null ? <AButton to={`/admin/studies/${seq}`}>{tr('학습관리에서 열기', 'Open in study management')}</AButton> : null}<AButton onClick={close}>{tr('닫기', 'Close')}</AButton></>}>
      {q.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void q.refetch()} /> : !d ? <Skeleton lines={8} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontSize: 14, margin: 0 }}>{tr('수강 정보', 'Enrollment')}</h3>
          <DescList cols={2} items={[
            [tr('과정명', 'Course'), d.study.courseName], [tr('이름', 'Name'), d.study.name], [tr('ID', 'ID'), d.study.id], [tr('사업주', 'Company'), d.study.companyName],
            [tr('수강시간(진도율)', 'Study time (progress)'), `${d.header.label} (${d.header.percent}%)`], [tr('수강기간', 'Period'), `${d.study.period.start} ~ ${d.study.period.end}`],
            [tr('수료여부', 'Completion'), d.study.passOkLabel ? <StatusBadge key="p" tone={d.study.passOk === 'Y' ? 'ok' : 'warn'}>{d.study.passOkLabel}</StatusBadge> : ''], [tr('교·강사', 'Tutor'), d.study.tutorName],
          ]} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 0' }}>
            <h3 style={{ fontSize: 14, margin: 0 }}>{tr('학습 내역', 'Learning history')}</h3>
            <AButton size="xs" loading={exporting} onClick={() => void exportExcel()}>{tr('학습내역 엑셀 출력', 'Export learning history')}</AButton>
          </div>
          <DataTable columns={learningCols} rows={d.learning.items} rowKey={(r) => `${r.lectureCode}:${r.rowStudySeq}:${r.chapterSeq}`} onRowClick={setChapter} selectedKey={chapter ? `${chapter.lectureCode}:${chapter.rowStudySeq}:${chapter.chapterSeq}` : null} emptyTitle={tr('학습 내역이 없습니다.', 'No learning history.')} dense
            footer={<span>{tr('합계', 'Total')}: {d.learning.sum.chapters}{tr('개 차시', ' chapters')} · {d.learning.sum.label} · <StatusBadge tone={d.learning.sum.met ? 'ok' : 'warn'}>{d.learning.sum.judge}</StatusBadge></span>} />
          {chapter ? (
            <div>
              <h3 style={{ fontSize: 14, margin: '8px 0 4px' }}>{tr(`${chapter.chapterNo}차시 진도 로그`, `Chapter ${chapter.chapterNo} progress log`)}</h3>
              {log.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void log.refetch()} /> : !log.data ? <Skeleton lines={4} /> : log.data.mode === 'ticks' ? (
                <>
                  {log.data.sameCount ? <Callout tone="warn" className="u-mb-8">{tr(`같은 분에 다른 차시와 겹친 기록 ${log.data.sameCount}건 (빨간색)`, `${log.data.sameCount} tick(s) share a minute with another chapter (red)`)}</Callout> : null}
                  <DataTable columns={tickCols} rows={log.data.items} rowKey={(r) => r.idx} size={50} emptyTitle={tr('진도 로그가 없습니다.', 'No progress log.')} dense />
                </>
              ) : <Callout>{tr('차시 로그가 없습니다.', 'No chapter log.')}</Callout>}
            </div>
          ) : <p className="muted" style={{ fontSize: 12, margin: 0 }}>{tr('차시 행을 누르면 진도 로그를 볼 수 있습니다.', 'Click a chapter row to see its progress log.')}</p>}
        </div>
      )}
    </DetailDrawer>
  );
}

const won = (v: number | null) => `${formatNumber(v ?? 0)} 원`;

/** CourseInfo() (course_info_pop.php): read-only 과정 상세 정보 for a LectureCode. */
export function CourseInfoDrawer({ lectureCode, onClose, canOpenCourse }: { lectureCode: string | null; onClose: () => void; canOpenCourse: boolean }) {
  const q = useQuery({ queryKey: ['admin', 'companies', 'course-info', lectureCode], queryFn: ({ signal }) => companiesApi.courseInfo(lectureCode!, signal), enabled: !!lectureCode, staleTime: 60_000 });
  const c = q.data;
  return (
    <DetailDrawer open={!!lectureCode} onClose={onClose} wide title={tr(`${c?.serviceTypeLabel ?? ''} 컨텐츠 상세 정보`.trim(), 'Course detail')} subtitle={c?.contentsName ?? lectureCode ?? ''}
      footer={<>{canOpenCourse && c?.courseIdx ? <AButton to={`/admin/courses/${c.courseIdx}`}>{tr('과정 관리에서 열기', 'Open in course management')}</AButton> : null}<AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton></>}>
      {q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} onRetry={() => void q.refetch()} /> : !c ? <Skeleton lines={10} /> : (
        <DescList items={[
          [tr('등급 / 과정코드', 'Grade / code'), <span key="g">{c.classGradeLabel} / <b className="mono">{c.lectureCode}</b></span>],
          [tr('사이트노출 / 컨텐츠 경로', 'Visible / content path'), `${c.useYNLabel} / ${c.contentsURLSelect === 'B' ? tr('예비 경로', 'backup path') : c.contentsURLSelect === 'A' ? tr('주 경로', 'main path') : ''}`],
          [tr('패키지 콘텐츠 과정코드', 'Package course codes'), c.packageLectureCode], [tr('원격훈련일련번호', 'HRD sequence no.'), c.hrdSeq],
          [tr('과정 분류', 'Category'), c.category], [tr('서비스 구분', 'Service type'), c.serviceTypeLabel], [tr('교육시간', 'Duration'), c.contentsTime === null ? '' : `${c.contentsTime} 분`],
          [tr('과정명', 'Course name'), c.contentsName], [tr('조회수', 'Views'), c.views === null ? '' : `${formatNumber(c.views)}회`],
          [tr('난이도(직급)', 'Level'), c.keyword1], [tr('직무분야', 'Job field'), c.keyword2], [tr('관심분야', 'Interest'), c.keyword3], [tr('역량', 'Competency'), c.keyword4],
          [tr('차시수', 'Chapters'), c.chapter ? `${c.chapter}차시` : tr('없음', 'none')], [tr('컨텐츠 유효기간', 'Valid'), `${c.contentsStart ?? ''} ~ ${c.contentsEnd ?? ''}`], [tr('컨텐츠 업로드 일자', 'Uploaded'), c.uploadDate],
          [tr('교강사', 'Instructor'), c.professor], [tr('수료기준', 'Pass rule'), c.passTime === null ? '' : `${c.passTime} 시간 이상`], [tr('모바일 지원', 'Mobile'), c.mobileLabel], [tr('교재비', 'Book price'), won(c.bookPrice)],
          [tr('교육비용', 'Price'), `${won(c.price)} | 환급비용 : 우선지원 : ${won(c.price01)} / 대규모 1000인 미만 : ${won(c.price02)} / 대규모 1000인 이상 : ${won(c.price03)}`],
          [tr('참고도서설명', 'Reference book'), c.bookIntro], [tr('학습자료 등록', 'Materials'), c.attachFile], [tr('과정 이미지', 'Course image'), c.previewImage ? <img key="p" src={`/upload/Course/${c.previewImage}`} alt="" width={100} /> : null],
          [tr('교재 이미지', 'Book image'), c.bookImage ? <img key="b" src={`/upload/Course/${c.bookImage}`} alt="" height={100} /> : null],
          [tr('과정소개', 'Introduction'), c.intro], [tr('교육대상', 'Audience'), c.eduTarget], [tr('교육목표', 'Goals'), c.eduGoal],
        ]} />
      )}
    </DetailDrawer>
  );
}

/** Small link-styled button used for the 진도율 / 과정명 cells (the PHP used javascript: links). */
export function CellLink({ onClick, children, label }: { onClick: () => void; children: ReactNode; label?: string }) {
  return <button type="button" onClick={onClick} aria-label={label} style={{ background: 'none', border: 0, padding: 0, color: 'var(--c-link, #1d5fd1)', cursor: 'pointer', textAlign: 'left', font: 'inherit', textDecoration: 'underline' }}>{children}</button>;
}

