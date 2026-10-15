import { useParams } from 'react-router-dom';
import { AButton, AdminPage } from '../../../../shared/ui/admin';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';
import { ChapterSection } from './courses-parity.chapters';
import { AnyGrantGate, G } from './courses-parity.grants';

/** /admin/courses/:lectureCode/chapters — the 차시 구성 block of course_read.php on its own page. */
function CourseChaptersPageBody() {
  const { lectureCode = '' } = useParams();
  return (
    <AdminPage title={`${adm.courses.chapters.title} · ${lectureCode}`} lead={tr('과정의 차시 구성(Chapter → 기초차시)을 추가·수정·삭제·정렬합니다.', 'Add, edit, delete and reorder the chapters of the course.')} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: adm.courses.title, to: '/admin/courses' }, { label: lectureCode }]} actions={<AButton to="/admin/courses">{adm.common.back}</AButton>}>
      <ChapterSection lectureCode={lectureCode} />
    </AdminPage>
  );
}

/** 차시 구성 (course_read.php block, top menu E): menu E1/E2/E3. */
export default function CourseChaptersPage() {
  return <AnyGrantGate grants={G.courses}><CourseChaptersPageBody /></AnyGrantGate>;
}
