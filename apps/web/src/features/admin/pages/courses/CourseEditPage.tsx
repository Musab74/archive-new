import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminCoursesParityApi as cp } from '../../../../shared/api/endpoints/admin-courses-parity';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, Card, DataTable, type Column } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';
import { CourseForm, CourseReadView } from './courses-parity.course';
import { ChapterSection } from './courses-parity.chapters';
import { PackageDetail, PackageForm, PackageNewPage } from './courses-parity.package';
import { menuName } from './courses-parity.shared';

/**
 * /admin/courses/:idx — course_read.php (read view + 차시 구성) and course_write.php (?mode=edit); for a package
 * course_package_read.php / course_package_write.php. /admin/courses/new?ctype=X (or ?packageYN=Y) is the 등록 form.
 */
export default function CourseEditPage() {
  const { idx = '' } = useParams();
  const [p, setP] = useSearchState({ mode: '', ctype: '', packageYN: '' });
  const navigate = useNavigate();
  const isNew = idx === 'new';
  const n = Number(idx);
  const q = useQuery({ queryKey: ['admin', 'course', n], queryFn: ({ signal }) => cp.course(n, signal), enabled: !isNew && n > 0 });
  if (isNew && p.packageYN === 'Y') return <PackageNewPage />;
  if (isNew) {
    const ctype = p.ctype || 'X';
    return (
      <AdminPage title={tr(`${menuName(ctype)} 컨텐츠 관리 등록`, `New ${menuName(ctype)} content`)} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: tr(`${menuName(ctype)} 컨텐츠 관리`, 'Contents'), to: `/admin/courses?ctype=${ctype}` }, { label: tr('등록', 'New') }]}>
        <CourseForm ctype={ctype} onDone={(id) => navigate(`/admin/courses/${id}`)} onCancel={() => navigate(`/admin/courses?ctype=${ctype}`)} />
      </AdminPage>
    );
  }
  const d = q.data;
  const editing = p.mode === 'edit';
  const listTo = d?.isPackage ? '/admin/courses?packageYN=Y' : `/admin/courses?ctype=${d?.ctype ?? 'X'}`;
  const title = d ? (d.isPackage ? tr('패키지 컨텐츠 관리', 'Package contents') : tr(`${menuName(d.ctype ?? '')} 컨텐츠 관리`, `${menuName(d.ctype ?? '')} contents`)) : tr('컨텐츠 관리', 'Contents');
  type Term = NonNullable<typeof d>['terms'][number];
  const termCols: Column<Term>[] = [
    { key: 'idx', header: 'idx', align: 'right' },
    { key: 'start', header: tr('시작', 'Start'), nowrap: true, render: (r) => r.start ?? '' },
    { key: 'end', header: tr('종료', 'End'), nowrap: true, render: (r) => r.end ?? '' },
    { key: 'serviceType', header: tr('유형', 'Type'), render: (r) => String(r.serviceType ?? '') },
    { key: 'openYear', header: tr('연도', 'Year'), render: (r) => String(r.openYear ?? '') },
    { key: 'openTerme', header: tr('회차', 'Term'), render: (r) => String(r.openTerme ?? '') },
    { key: 'openChapter', header: tr('차시', 'Chapter'), render: (r) => String(r.openChapter ?? '') },
  ];
  return (
    <AdminPage title={`${title}${editing ? ` ${tr('수정', 'edit')}` : ''}${d ? ` · ${d.name ?? ''} (${d.lectureCode})` : ''}`} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: title, to: listTo }, { label: idx }]} actions={<AButton to={listTo}>{adm.common.back}</AButton>}>
      {q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /> : q.isPending || !d ? <Skeleton lines={10} /> : d.isPackage ? (
        editing ? <PackageForm detail={d} onDone={() => setP({ mode: '' })} onCancel={() => setP({ mode: '' })} /> : <PackageDetail d={d} onEdit={() => setP({ mode: 'edit' })} />
      ) : editing ? (
        <CourseForm ctype={d.ctype ?? 'X'} detail={d} onDone={() => setP({ mode: '' })} onCancel={() => setP({ mode: '' })} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CourseReadView d={d} onEdit={() => setP({ mode: 'edit' })} />
          {d.chapter !== '0' || d.chapterRows > 0 ? <ChapterSection lectureCode={d.lectureCode} contentsName={d.name} chapterCount={d.chapter} /> : null}
          <Card title={`${tr('회차(LectureTerme) 최근 50건', 'Terms (latest 50)')} · ${tr('수강', 'enrollments')} ${d.enrollments.toLocaleString('ko-KR')}`}><DataTable columns={termCols} rows={d.terms} rowKey={(r) => r.idx} dense emptyTitle={tr('회차가 없습니다.', 'No terms.')} emptyBody=" " /></Card>
        </div>
      )}
    </AdminPage>
  );
}
