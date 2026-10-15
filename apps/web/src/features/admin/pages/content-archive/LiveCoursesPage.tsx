import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminContentArchiveApi as apiX, type LiveCourseRow } from '../../../../shared/api/endpoints/admin-content-archive';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Callout, DataTable, FilterBar, FilterField, Kpi, YnBadge, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { AnyGrantGate, ExportButton, LIVE_GRANTS, LIVE_INSTRUCTOR_URL, LegacyLink, liveHref, noOf } from './shared';
import LiveCourseDetailPage from './LiveCourseDetailPage';
import LiveCourseExcelPage from './LiveCourseExcelPage';

const DEFAULTS = { col: 'ContentsName', q: '', page: 1 };
const SIZE = 30; // course.php live_view page size ($live_page_size = 30)

/**
 * course.php?ctype=R&live_view=Y — "라이브 컨텐츠 관리" (Course ctype=R rows). The menu entry 실시간 강의실 관리 opens for any archive
 * sub-grant E1..E8 ($ArchiveHasAnySub). The MongoDB meeting list (course.php?ctype=R default view) stays on the PHP page.
 */
export default function LiveCoursesPage() {
  // The router registers only /admin/live-courses, so the read / edit / new / excel screens are addressed by query params on it
  // (?idx=N[&mode=edit], ?idx=new, ?view=excel) — the same shape as course_read.php?idx=..&ctype=R / course_write.php?mode=new&ctype=R.
  const [sp] = useSearchParams();
  const idx = sp.get('idx');
  if (idx) return <LiveCourseDetailPage idx={idx} />;
  if (sp.get('view') === 'excel') return <LiveCourseExcelPage />;
  return <AnyGrantGate grants={LIVE_GRANTS}><LiveCourses /></AnyGrantGate>;
}

/** A write action of course.php (`<?if($AdminWrite=="Y")?>`): a link when allowed, a disabled button with the read-only reason otherwise. */
function WriteLink({ to, icon, primary, canWrite, title, children }: { to: string; icon: 'plus' | 'file'; primary?: boolean; canWrite: boolean; title?: string; children: ReactNode }) {
  return canWrite ? <AButton variant={primary ? 'primary' : 'default'} icon={icon} to={to}>{children}</AButton> : <AButton variant={primary ? 'primary' : 'default'} icon={icon} disabled title={title}>{children}</AButton>;
}

function LiveCourses() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const navigate = useNavigate();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'live-courses', query], queryFn: ({ signal }) => apiX.liveCourses(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  // course.php: the whole row opens course_read.php?idx=..&ctype=R; the code / name anchors (readRun) do the same and stop propagation
  const cellLink = (r: LiveCourseRow, body: ReactNode) => <Link to={liveHref.detail(r.idx)} onClick={(e) => e.stopPropagation()}>{body}</Link>;
  const columns: Column<LiveCourseRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => noOf(total, p.page, SIZE, i) },
    { key: 'lectureCode', header: <>{tr('등급', 'Grade')}<br />{tr('과정코드', 'Course code')}</>, nowrap: true, render: (r) => cellLink(r, <>{r.classGradeLabel}<br /><b className="mono">{r.lectureCode}</b></>) },
    { key: 'courseName', header: <>{tr('과정분류', 'Category')}<br />{tr('과정명', 'Course')}</>, render: (r) => cellLink(r, <>{r.category}<br /><b>{r.courseName}</b></>) },
    { key: 'chapterLabel', header: tr('차시', 'Chapters'), nowrap: true, align: 'center' },
    { key: 'contentsTime', header: tr('교육시간', 'Minutes'), nowrap: true, align: 'right', render: (r) => `${r.contentsTime ?? ''} ${tr('분', 'min')}` },
    { key: 'packageLectureCode', header: tr('패키지콘텐츠 과정코드', 'Package code'), render: (r) => <span className="mono" style={{ fontSize: 12 }}>{r.packageLectureCode ?? ''}</span> },
    { key: 'hrdSeq', header: tr('원격훈련 일련번호', 'HRD serial'), nowrap: true, render: (r) => r.hrdSeq ?? '' },
    { key: 'dates', header: <>{tr('제작연도', 'Produced')}<br />{tr('업로드', 'Uploaded')}</>, nowrap: true, render: (r) => <>{r.contentsStart ?? ''}<br />{r.uploadDate ?? ''}</> },
    { key: 'mobile', header: tr('모바일', 'Mobile'), align: 'center', render: (r) => <YnBadge value={r.mobile} yes={tr('사용', 'Yes')} no={tr('미사용', 'No')} /> },
    { key: 'useYN', header: <>{tr('사이트', 'Site')}<br />{tr('노출', 'visible')}</>, align: 'center', render: (r) => <YnBadge value={r.useYN} yes={tr('사용', 'Yes')} no={tr('미사용', 'No')} /> },
  ];
  const openInstructor = () => window.open(LIVE_INSTRUCTOR_URL, '_blank', 'noopener');
  return (
    <AdminPage title={tr('라이브 컨텐츠 관리', 'Live contents')} lead={tr('실시간 강의실 컨텐츠(Course ctype=R · ServiceType=R) 목록입니다. 행을 누르면 상세·수정·삭제 화면이 열립니다.', 'Live-classroom course rows (Course ctype=R · ServiceType=R). Click a row to view, edit or delete it.')}
      actions={(
        <>
          <WriteLink to={liveHref.create} icon="plus" primary canWrite={canWrite} title={readOnlyTitle}>{tr('라이브 신규 등록', 'New live content')}</WriteLink>
          <WriteLink to={liveHref.excel} icon="file" canWrite={canWrite} title={readOnlyTitle}>{tr('엑셀로 등록', 'Register from Excel')}</WriteLink>
          <AButton icon="video" onClick={openInstructor}>{tr('실시간 강의 생성', 'Create live class')}</AButton>
          <AButton icon="calendar" onClick={openInstructor}>{tr('예정 강의 등록', 'Schedule a class')}</AButton>
        </>
      )}>
      <Callout tone="info">
        {tr('기존 화면의 "강의실 목록 보기"(실시간 강의실·접속 회원·통계)는 MongoDB(HrdeLive meetings)에서 읽으며 새 API에는 연결되지 않았습니다. 그 목록은 기존 관리자 페이지에서 확인하세요: ', 'The legacy "meeting rooms" view (rooms, connected members, stats) reads MongoDB (HrdeLive) which the new API does not connect to. Use the legacy page for it: ')}
        <LegacyLink file="course.php?ctype=R" label={tr('실시간 강의실(미팅) 목록 열기', 'Open live meeting rooms')} />
      </Callout>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 240px))', gap: 12, margin: '12px 0' }}>
        <Kpi label={tr('등록된 라이브 컨텐츠', 'Live contents')} value={list.data ? total : null} unit={tr('개', '')} icon="video" />
      </div>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'ContentsName', q: '' }); reset(); }}
        extra={<ExportButton label={tr('엑셀 다운로드', 'Download Excel (CSV)')} disabled={!list.data || total === 0} run={() => apiX.downloadLiveCoursesCsv({ col: query.col, q: query.q })} />}>
        <FilterField label={tr('검색구분', 'Search in')} htmlFor="lc-col" width={130}><ASelect id="lc-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'ContentsName', label: tr('과정명', 'Course') }, { value: 'LectureCode', label: tr('강의 코드', 'Course code') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="lc-q" width={260}><AInput id="lc-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={(r) => navigate(liveHref.detail(r.idx))} emptyTitle={tr('등록된 라이브 컨텐츠가 없습니다.', 'No live contents.')} dense />
    </AdminPage>
  );
}
