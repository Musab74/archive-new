import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { AdminChapterRow } from '../../../../shared/api/schemas';
import { AButton, AdminPage, DataTable, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { adm } from '../../strings';

const c = adm.courses.chapters.cols;
const columns: Column<AdminChapterRow>[] = [
  { key: 'order', header: c.order, align: 'right', sortable: true },
  { key: 'chapterSeq', header: c.seq, align: 'right' },
  { key: 'chapterType', header: c.type, align: 'center', render: (r) => r.chapterType ?? '' },
  { key: 'contentsIdx', header: c.contentsIdx, align: 'right', render: (r) => (r.contentsIdx ? <Link to={`/admin/contents/${r.contentsIdx}`}>{r.contentsIdx}</Link> : <span className="muted">{String(r.subIdx ?? '')}</span>) },
  { key: 'title', header: c.title, render: (r) => r.title ?? <span className="muted">연결된 차시 없음</span> },
  { key: 'lectureTimeMin', header: c.min, align: 'right', render: (r) => (r.lectureTimeMin != null ? `${r.lectureTimeMin}분` : '') },
  { key: 'details', header: c.details, align: 'right' },
  { key: 'deleted', header: c.deleted, align: 'center', render: (r) => (r.deleted ? <StatusBadge tone="danger">삭제됨</StatusBadge> : '') },
  { key: 'regDate', header: c.regDate, nowrap: true, render: (r) => r.regDate ?? '' },
];

export default function CourseChaptersPage() {
  const { lectureCode = '' } = useParams();
  const q = useQuery({ queryKey: ['admin', 'chapters', lectureCode], queryFn: ({ signal }) => adminApi.chapters(lectureCode, signal), enabled: !!lectureCode });
  return (
    <AdminPage title={`${adm.courses.chapters.title} · ${lectureCode}`} lead={adm.courses.chapters.lead} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: adm.courses.title, to: '/admin/courses' }, { label: lectureCode }]} actions={<AButton to="/admin/courses">{adm.common.back}</AButton>}>
      <DataTable columns={columns} rows={q.data} rowKey={(r) => r.chapterSeq} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense emptyTitle="차시가 없습니다." emptyBody=" " />
    </AdminPage>
  );
}
