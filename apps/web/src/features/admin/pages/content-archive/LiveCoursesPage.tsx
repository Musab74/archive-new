import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminContentArchiveApi as apiX, type LiveCourseRow } from '../../../../shared/api/endpoints/admin-content-archive';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AdminPage, AInput, ASelect, Callout, DataTable, FilterBar, FilterField, Kpi, YnBadge, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { GrantGate } from '../../GrantGate';
import { LegacyLink, noOf } from './shared';

const DEFAULTS = { col: 'ContentsName', q: '', page: 1 };
const SIZE = 30; // course.php live_view page size

/** course.php?ctype=R&live_view=Y — 실시간 강의실 관리 (Course ctype=R rows), grant E1. The MongoDB meeting list stays on the PHP page. */
export default function LiveCoursesPage() {
  return <GrantGate grant="E1"><LiveCourses /></GrantGate>;
}

function LiveCourses() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'live-courses', query], queryFn: ({ signal }) => apiX.liveCourses(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  const columns: Column<LiveCourseRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => noOf(total, p.page, SIZE, i) },
    { key: 'lectureCode', header: <>{tr('등급', 'Grade')}<br />{tr('과정코드', 'Course code')}</>, nowrap: true, render: (r) => <Link to={`/admin/courses/${r.idx}`}>{r.classGradeLabel}<br /><b className="mono">{r.lectureCode}</b></Link> },
    { key: 'courseName', header: <>{tr('과정분류', 'Category')}<br />{tr('과정명', 'Course')}</>, render: (r) => <Link to={`/admin/courses/${r.idx}`}>{r.category}<br /><b>{r.courseName}</b></Link> },
    { key: 'chapterLabel', header: tr('차시', 'Chapters'), nowrap: true, align: 'center' },
    { key: 'contentsTime', header: tr('교육시간', 'Minutes'), nowrap: true, align: 'right', render: (r) => `${r.contentsTime ?? ''} ${tr('분', 'min')}` },
    { key: 'packageLectureCode', header: tr('패키지콘텐츠 과정코드', 'Package code'), render: (r) => <span className="mono" style={{ fontSize: 12 }}>{r.packageLectureCode ?? ''}</span> },
    { key: 'hrdSeq', header: tr('원격훈련 일련번호', 'HRD serial'), nowrap: true, render: (r) => r.hrdSeq ?? '' },
    { key: 'dates', header: <>{tr('제작연도', 'Produced')}<br />{tr('업로드', 'Uploaded')}</>, nowrap: true, render: (r) => <>{r.contentsStart ?? ''}<br />{r.uploadDate ?? ''}</> },
    { key: 'mobile', header: tr('모바일', 'Mobile'), align: 'center', render: (r) => <YnBadge value={r.mobile} yes={tr('사용', 'Yes')} no={tr('미사용', 'No')} /> },
    { key: 'useYN', header: <>{tr('사이트', 'Site')}<br />{tr('노출', 'visible')}</>, align: 'center', render: (r) => <YnBadge value={r.useYN} yes={tr('사용', 'Yes')} no={tr('미사용', 'No')} /> },
  ];
  return (
    <AdminPage title={tr('실시간 강의실 관리', 'Live classrooms')} lead={tr('실시간 강의실 컨텐츠(Course ctype=R · ServiceType=R) 목록입니다. 과정 상세·수정은 과정 목록 화면을 사용합니다.', 'Live-classroom course rows (Course ctype=R · ServiceType=R). Open a row to view/edit it on the course screen.')}>
      <Callout tone="info">
        {tr('기존 화면의 기본 탭(실시간 강의실 목록·접속 회원·통계)은 MongoDB(HrdeLive meetings)에서 읽으며 새 API에는 아직 연결되지 않았습니다. 그 부분은 기존 관리자 페이지에서 계속 확인하세요: ', 'The default tab of the legacy page (meeting rooms, connected members, stats) reads MongoDB (HrdeLive) which the new API does not connect to yet. Use the legacy page for that part: ')}
        <LegacyLink file="course.php?ctype=R" label={tr('실시간 강의실(미팅) 목록 열기', 'Open live meeting rooms')} />
      </Callout>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 240px))', gap: 12, margin: '12px 0' }}>
        <Kpi label={tr('등록된 라이브 컨텐츠', 'Live contents')} value={list.data ? total : null} unit={tr('개', '')} icon="video" />
      </div>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'ContentsName', q: '' }); reset(); }}>
        <FilterField label={tr('검색구분', 'Search in')} htmlFor="lc-col" width={130}><ASelect id="lc-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'ContentsName', label: tr('과정명', 'Course') }, { value: 'LectureCode', label: tr('강의 코드', 'Course code') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="lc-q" width={260}><AInput id="lc-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} emptyTitle={tr('등록된 라이브 컨텐츠가 없습니다.', 'No live contents.')} dense />
    </AdminPage>
  );
}
