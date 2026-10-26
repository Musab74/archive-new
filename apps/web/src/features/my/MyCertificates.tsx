import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import styles from './My.module.css';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { isAppError } from '../../shared/api/client';
import { useToast } from '../../app/providers/ToastProvider';
import { Button } from '../../shared/ui/Button';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { my as copy } from '../../shared/strings/ko';
import { cx } from '../../shared/utils/format';

const c = copy.certificates;

/** Opens the 수료증 PDF (include/certificate_pdf01.php layout) in a new tab; API messages (미수료 / 7일 대기) become a toast. */
function usePrintCertificate() {
  const { toast } = useToast();
  return async (studySeq: number) => {
    const win = window.open('', '_blank');
    try { await myRoomApi.certificatePdf(studySeq, win); } catch (e) { toast(isAppError(e) ? e.message : c.pdfFail, { tone: 'danger' }); }
  };
}

/** `/my/certificates` — every own Study row with PassOK='Y'; refund (A) rows wait until LectureEnd + 7 days. */
export default function MyCertificates() {
  const list = useQuery({ queryKey: ['my', 'certificates'], queryFn: ({ signal }) => myRoomApi.certificates(signal) });
  const print = usePrintCertificate();
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
                <td>{r.waiting && r.availableFrom ? <span className={cx(styles.pill, styles.pillWarn)}>{c.waiting(r.availableFrom)}</span> : <span className={cx(styles.pill, styles.pillOk)}>{c.printable}</span>}</td>
                <td><div className={styles.segRow}>
                  <Button variant="secondary" size="xs" square to={`/my/certificates/${r.studySeq}`}>{c.view}</Button>
                  {r.printable ? <Button size="xs" square onClick={() => void print(r.studySeq)}>{c.pdf}</Button> : null}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** `/my/certificates/:studySeq` — the values the PDF prints (same API rule: PassOK=Y, refund 7-day wait) + the PDF button. */
export function MyCertificateDetail() {
  const { studySeq = '' } = useParams();
  const seq = Number(studySeq);
  const print = usePrintCertificate();
  const cert = useQuery({ queryKey: ['my', 'certificate', seq], queryFn: ({ signal }) => myRoomApi.certificate(seq, signal), enabled: Number.isFinite(seq) && seq > 0, retry: false });
  if (!Number.isFinite(seq) || seq <= 0) return <div className={styles.page}><StateBlock code="NOT_FOUND" /></div>;
  if (cert.isPending) return <div className={styles.page} aria-busy="true"><Skeleton height={400} /></div>;
  if (cert.isError) {
    const e = cert.error;
    if (isAppError(e) && e.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
    if (isAppError(e) && (e.code === 'NO_ACCESS' || e.status === 403)) return <div className={styles.page}><StateBlock code="NO_ACCESS" title={c.noAccessTitle} body={e.message || c.noAccessBody} actions={<Button square size="sm" to="/my/certificates">{c.back}</Button>} /></div>;
    if (isAppError(e) && e.status === 404) return <div className={styles.page}><StateBlock code="NOT_FOUND" actions={<Button square size="sm" to="/my/certificates">{c.back}</Button>} /></div>;
    return <div className={styles.page}><StateBlock code="LIST_ERROR" title={c.errorTitle} body={c.errorBody} onRetry={() => void cert.refetch()} /></div>;
  }
  const d = cert.data;
  const f = c.sheet;
  return (
    <div className={styles.page}>
      <div className={cx(styles.head, styles.noPrint)}>
        <div><span className="eyebrow">{c.title}</span><h1>{d.item.courseName}</h1><p>{c.sheetNote}</p></div>
        <div className={styles.headAside}><Button variant="secondary" square size="sm" to="/my/certificates">{c.back}</Button><Button square size="sm" onClick={() => void print(d.studySeq)}>{c.pdf}</Button></div>
      </div>
      <article className={styles.cert} aria-label={c.sheetTitle}>
        <h1>{c.docTitle}</h1>
        <dl className={styles.certGrid} style={{ gridTemplateColumns: '1fr' }}>
          <div><dt>{f.name}</dt><dd>{d.item.name}</dd></div>
          <div><dt>{f.birthDay}</dt><dd>{d.item.birthDay || '—'}</dd></div>
          <div><dt>{f.company}</dt><dd>{d.item.companyName || '—'}</dd></div>
          <div><dt>{f.course}</dt><dd>{d.item.courseName}</dd></div>
          <div><dt>{f.period}</dt><dd>{c.period(d.item.lectureStart ?? '', d.item.lectureEnd ?? '', d.item.hours)}</dd></div>
          <div><dt>{f.issuedAt}</dt><dd>{d.issueDate}</dd></div>
          <div><dt>{f.site}</dt><dd>{d.siteName}</dd></div>
        </dl>
      </article>
    </div>
  );
}
