import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import styles from './My.module.css';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { isAppError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { my as copy } from '../../shared/strings/ko';
import { fmtDate } from './queries';
import { cx } from '../../shared/utils/format';

const c = copy.certificates;

/** `/my/certificates` — list of PassOK + closed enrollments. */
export default function MyCertificates() {
  const list = useQuery({ queryKey: ['my', 'certificates'], queryFn: ({ signal }) => myRoomApi.certificates(signal) });
  if (list.isError && isAppError(list.error) && list.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  return (
    <div className={styles.page}>
      <div className={styles.head}><div><span className="eyebrow">{copy.crumb}</span><h1>{c.title}</h1><p>{c.lead}</p></div></div>
      {list.isPending ? <Skeleton lines={4} /> : list.isError ? <StateBlock code="LIST_ERROR" title={c.errorTitle} body={c.errorBody} onRetry={() => void list.refetch()} /> : list.data.length === 0 ? (
        <StateBlock code="EMPTY" symbol="file" title={c.emptyTitle} body={c.emptyBody} actions={<Button variant="secondary" square size="sm" to="/my/records?tab=completion">{copy.records.tabs.completion}</Button>} />
      ) : (
        <table className={styles.table}>
          <thead><tr><th scope="col">{c.cols.course}</th><th scope="col">{c.cols.period}</th><th scope="col">{c.cols.issuedAt}</th><th scope="col" /></tr></thead>
          <tbody>
            {list.data.map((r) => (
              <tr key={r.studySeq}>
                <td><span className={styles.title}>{r.courseName}</span><span className={styles.sub}>#{r.studySeq} · {r.lectureCode}</span></td>
                <td>{typeof r.period === 'string' ? r.period : r.period?.label ?? ''}</td>
                <td>{fmtDate(r.issuedAt)}</td>
                <td><Button variant="secondary" size="xs" square to={`/my/certificates/${r.studySeq}`}>{c.view}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** `/my/certificates/:studySeq` — printable certificate (pdf is null from the API → window.print). */
export function MyCertificateDetail() {
  const { studySeq = '' } = useParams();
  const seq = Number(studySeq);
  const cert = useQuery({ queryKey: ['my', 'certificate', seq], queryFn: ({ signal }) => myRoomApi.certificate(seq, signal), enabled: Number.isFinite(seq) && seq > 0 });
  if (!Number.isFinite(seq) || seq <= 0) return <div className={styles.page}><StateBlock code="NOT_FOUND" /></div>;
  if (cert.isPending) return <div className={styles.page} aria-busy="true"><Skeleton height={400} /></div>;
  if (cert.isError) {
    const e = cert.error;
    if (isAppError(e) && e.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
    if (isAppError(e) && (e.code === 'NO_ACCESS' || e.status === 403)) return <div className={styles.page}><StateBlock code="NO_ACCESS" title={c.noAccessTitle} body={c.noAccessBody} actions={<Button square size="sm" to="/my/certificates">{c.back}</Button>} /></div>;
    if (isAppError(e) && e.status === 404) return <div className={styles.page}><StateBlock code="NOT_FOUND" actions={<Button square size="sm" to="/my/certificates">{c.back}</Button>} /></div>;
    return <div className={styles.page}><StateBlock code="LIST_ERROR" title={c.errorTitle} body={c.errorBody} onRetry={() => void cert.refetch()} /></div>;
  }
  const d = cert.data;
  return (
    <div className={styles.page}>
      <div className={cx(styles.head, styles.noPrint)}>
        <div><span className="eyebrow">{c.title}</span><h1>{d.course.name}</h1><p>{c.pdfNote}</p></div>
        <div className={styles.headAside}><Button variant="secondary" square size="sm" to="/my/certificates">{c.back}</Button><Button square size="sm" onClick={() => window.print()}>{c.print}</Button></div>
      </div>
      <article className={styles.cert} aria-label={c.docTitle}>
        <span className={styles.certNo}>{c.docNo(d.studySeq)}</span>
        <h1>{c.docTitle}</h1>
        <dl className={styles.certGrid}>
          <div><dt>{c.fields.name}</dt><dd>{d.learner.name}</dd></div>
          <div><dt>{c.fields.id}</dt><dd>{d.learner.id}</dd></div>
          <div><dt>{c.fields.company}</dt><dd>{d.company?.name ?? '—'}</dd></div>
          <div><dt>{c.fields.code}</dt><dd>{d.course.lectureCode}{d.course.hrdCode ? ` / ${d.course.hrdCode}` : ''}</dd></div>
          <div><dt>{c.fields.course}</dt><dd>{d.course.name}</dd></div>
          <div><dt>{c.fields.period}</dt><dd>{d.period?.label ?? ''}</dd></div>
          <div><dt>{c.fields.hours}</dt><dd>{d.hours.formatted}</dd></div>
          <div><dt>{c.fields.issuedAt}</dt><dd>{fmtDate(d.issuedAt)}</dd></div>
        </dl>
        <p className={styles.certBody}>{c.body}</p>
        <p className={styles.certBody}>{fmtDate(d.issuedAt)}</p>
        <p className={styles.certIssuer}>{c.issuer}</p>
      </article>
    </div>
  );
}
