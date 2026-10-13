import styles from './My.module.css';
import { isAppError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { TypeLabel } from '../../shared/ui/Pill';
import { my as copy, assessment as assessmentCopy } from '../../shared/strings/ko';
import { useCurrentEnrollment, useMyStatus } from './queries';

const c = copy.assessmentHub;

/** `/my/assessment` — status cards linking to pre/post/result/roadmap. */
export default function MyAssessmentHub() {
  const current = useCurrentEnrollment();
  const status = useMyStatus();
  if (current.isError && isAppError(current.error) && current.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  const pre = current.data?.preAssessment ?? null;
  const preDone = pre?.submitted ?? status.data?.preAssessment?.submitted ?? false;
  const postDone = status.data?.postAssessment?.submitted ?? false;
  const noEnrollment = current.isSuccess && current.data.studySeq === null;
  return (
    <div className={styles.page}>
      <div className={styles.head}><div><span className="eyebrow">{copy.crumb}</span><h1>{c.title}</h1><p>{c.lead}</p></div></div>
      {current.isPending ? <Skeleton height={160} /> : noEnrollment ? <StateBlock code="NO_ACCESS" title={assessmentCopy.noEnrollmentTitle} body={assessmentCopy.noEnrollmentBody} /> : (
        <div className={styles.grid2}>
          <div className={styles.hubCard}>
            <div className={styles.cardHead}><h3>{c.pre.title}</h3><TypeLabel tone={preDone ? 'mint' : pre?.started ? 'navy' : 'gray'} small>{preDone ? c.pre.done : pre?.started ? c.pre.inProgress : c.pre.todo}</TypeLabel></div>
            <p>{pre && !preDone && pre.required > 0 ? c.progress(pre.answered, pre.required) : assessmentCopy.pre.lead}</p>
            <div className="action-row"><Button square size="sm" to={preDone ? '/assessment/result' : '/assessment/pre'}>{preDone ? c.pre.ctaDone : pre?.started ? c.pre.ctaResume : c.pre.ctaTodo}</Button></div>
          </div>
          <div className={styles.hubCard}>
            <div className={styles.cardHead}><h3>{c.post.title}</h3><TypeLabel tone={postDone ? 'mint' : 'gray'} small>{postDone ? c.post.done : preDone ? c.post.todo : c.post.locked}</TypeLabel></div>
            <p>{assessmentCopy.post.note}</p>
            <div className="action-row"><Button square size="sm" variant={preDone ? 'primary' : 'secondary'} to={postDone ? '/assessment/result' : '/assessment/post'} aria-disabled={!preDone || undefined}>{postDone ? c.post.ctaDone : c.post.cta}</Button></div>
          </div>
          <div className={styles.hubCard}><h3>{c.result.title}</h3><p>{c.result.body}</p><div className="action-row"><Button variant="secondary" square size="sm" to="/assessment/result">{c.result.cta}</Button></div></div>
          <div className={styles.hubCard}><h3>{c.roadmap.title}</h3><p>{c.roadmap.body}</p><div className="action-row"><Button variant="secondary" square size="sm" to="/roadmap">{c.roadmap.cta}</Button></div></div>
        </div>
      )}
      <p className={styles.note}>{c.note}</p>
    </div>
  );
}
