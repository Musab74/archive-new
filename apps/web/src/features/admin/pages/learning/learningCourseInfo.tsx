import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminLearningApi } from '../../../../shared/api/endpoints/admin-learning';
import { AButton, Card, DescList, DetailDrawer } from '../../../../shared/ui/admin';
import { LegacyHtml } from '../../../../shared/ui/LegacyHtml';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { LEGACY_SITE_ROOT, useCsvDownload } from './learningShared';

/** course_info_pop.php $MenuName: X 이러닝 / Y 숏폼 / Z 마이크로닝 from the request's ctype (blank when the caller passes none). */
const CTYPE_MENU: Record<string, string> = { X: '이러닝', Y: '숏폼', Z: '마이크로닝' };

/**
 * course_info_pop.php (CourseInfo(LectureCode)) as a read-only drawer: same rows and order as the PHP popup. The title prefix comes
 * from the caller's `ctype` like the PHP $ctype request value (CourseInfo(LectureCode) callers such as IP모니터링 pass none → blank).
 * 학습자료 is a download link (direct_download.php?code=Course&file=…).
 */
export function CourseInfoDrawer({ lectureCode, ctype, onClose }: { lectureCode: string | null; ctype?: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'learning', 'course-info', lectureCode], queryFn: ({ signal }) => adminLearningApi.courseInfo(lectureCode!, signal), enabled: !!lectureCode });
  const c = q.data;
  const [downloading, download] = useCsvDownload();
  const menuName = CTYPE_MENU[ctype ?? ''] ?? '';
  const radio = (v: string, label: string) => <label key={v} style={{ marginRight: 10 }}><input type="radio" checked={c?.contentsUrlSelect === v} disabled readOnly /> {label}</label>;
  return (
    <DetailDrawer open={!!lectureCode} onClose={onClose} title={tr(`${menuName} 컨텐츠 상세 정보`.trim(), 'Content details')} subtitle={c?.contentsName ?? lectureCode ?? ''} wide footer={<AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton>}>
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : !c ? <p className="muted">{adm.common.loading}</p> : (
        <Card>
          <DescList cols={2} items={[
            [tr('등급 / 과정코드', 'Grade / code'), <span key="g">{c.classGradeLabel} / <b style={{ color: 'var(--c-danger)' }}>{c.lectureCode}</b></span>],
            [tr('사이트노출 / 컨텐츠 경로', 'Visible / content path'), <span key="u">{c.useYNLabel} / {radio('A', tr('주 경로', 'Main'))}{radio('B', tr('예비 경로', 'Backup'))}</span>],
            [tr('패키지 콘텐츠 과정코드', 'Package codes'), c.packageLectureCode], [tr('원격훈련일련번호', 'HRD seq'), c.hrdSeq === null || c.hrdSeq === undefined ? '' : String(c.hrdSeq)],
            [tr('과정 분류', 'Category'), `${c.categoryName1 ?? ''} > ${c.categoryName2 ?? ''}`], [tr('서비스 구분', 'Service type'), c.serviceTypeLabel],
            [tr('교육시간', 'Duration'), `${c.contentsTime ?? ''} 분`], [tr('과정명', 'Course'), c.contentsName],
            [tr('조회수', 'Views'), tr(`${c.viewCount}회`, String(c.viewCount))], [tr('난이도(직급)', 'Level'), c.keyword1Name],
            [tr('직무분야', 'Job field'), c.keyword2Name], [tr('관심분야', 'Interest'), c.keyword3], [tr('역량', 'Competency'), c.keyword4],
            [tr('차시수', 'Chapters'), c.chapterLabel], [tr('컨텐츠 유효기간', 'Valid'), `${c.contentsStart ?? ''}  ~ ${c.contentsEnd ?? ''}`], [tr('컨텐츠 업로드 일자', 'Uploaded'), c.uploadDate],
            [tr('교강사', 'Instructor'), c.professor], [tr('수료기준', 'Pass rule'), `${c.passTime ?? ''} 시간 이상`], [tr('모바일 지원', 'Mobile'), c.mobileLabel], [tr('교재비', 'Book price'), `${c.bookPrice} 원`],
            [tr('교육비용', 'Fee'), `${c.price} 원 | 환급비용 : 우선지원 : ${c.price01View} 원 / 대규모 1000인 미만 : ${c.price02View} 원 / 대구모 1000인 이상 : ${c.price03View} 원`],
            [tr('참고도서설명', 'Book note'), c.bookIntro], [tr('학습자료 등록', 'Material'), c.attachFile ? <a key="a" href="#download" aria-disabled={downloading} onClick={(e) => { e.preventDefault(); if (!downloading) void download(() => adminLearningApi.downloadCourseAttach(c.lectureCode, c.attachFile!)); }}><b>{c.attachFile}</b></a> : ''],
            [tr('과정 이미지', 'Image'), c.previewImage ? <img key="p" src={`${LEGACY_SITE_ROOT}/upload/Course/${c.previewImage}`} width={100} alt="" /> : ''],
            [tr('교재 이미지', 'Book image'), c.bookImage ? <img key="b" src={`${LEGACY_SITE_ROOT}/upload/Course/${c.bookImage}`} height={100} alt="" /> : ''],
            [tr('과정소개', 'Intro'), <LegacyHtml key="i" html={c.intro} />], [tr('교육대상', 'Target'), <LegacyHtml key="t" html={c.eduTarget} />], [tr('교육목표', 'Goal'), <LegacyHtml key="o" html={c.eduGoal} />],
          ]} />
        </Card>
      )}
    </DetailDrawer>
  );
}

/** [renderLink(lectureCode, label), drawerElement] — 과정명 cells that open the course info. */
export function useCourseInfo(): [(lectureCode: string, label: ReactNode) => ReactNode, ReactNode] {
  const [code, setCode] = useState<string | null>(null);
  const link = (lc: string, label: ReactNode) => <button type="button" title={lc} onClick={() => setCode(lc)} style={{ background: 'none', border: 0, padding: 0, color: 'var(--c-link, #1e6bd6)', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>{label}</button>;
  return [link, <CourseInfoDrawer key="course-info" lectureCode={code} onClose={() => setCode(null)} />];
}
