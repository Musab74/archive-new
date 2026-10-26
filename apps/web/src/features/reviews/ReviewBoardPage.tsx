import { useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import styles from './Reviews.module.css';
import { isAppError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { Pagination } from '../../shared/ui/Pagination';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { Input } from '../../shared/ui/Form';
import { my as myCopy } from '../../shared/strings/ko';
import { useReviewBoard, useReviewBoardOne } from '../assessment/queries';
import { Stars, cut } from './MyReviewsPage';

const c = myCopy.reviews;

/** `/support/reviews` — public/support/survey.html: every visible review, search by title or course name, ?lectureCode filter with the course average. */
export default function ReviewBoardPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const sw = params.get('sw') ?? '';
  const lectureCode = params.get('lectureCode') ?? '';
  const [term, setTerm] = useState(sw);
  const list = useReviewBoard(page, sw, lectureCode);
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    setParams(next);
  };
  const onSearch = (e: FormEvent) => { e.preventDefault(); set({ sw: term.trim() || null, page: null }); };
  if (list.isError && isAppError(list.error) && list.error.isAuth) return <div className={`${styles.page} ${styles.inLayout}`}><StateBlock code="LOGIN" /></div>;
  const data = list.data;
  return (
    <div className={`${styles.page} ${styles.inLayout}`}>
      <div className={styles.head}><span className="eyebrow">{c.board.crumb}</span><h1>{c.board.title}</h1></div>
      <div className={styles.toolbar}>
        <div className={styles.count}>
          {data ? <span>{c.board.total(data.total)}</span> : null}
          {data?.course ? (
            <span className={styles.filter}>
              <b>{data.course.name ?? data.course.lectureCode}</b>
              {data.course.avgStar > 0 ? <><strong>{data.course.avgStar}</strong><Stars value={data.course.avgStar} /><span>({c.board.avg})</span></> : null}
              <Button variant="secondary" size="xs" square onClick={() => set({ lectureCode: null, page: null })}>{c.board.clear}</Button>
            </span>
          ) : null}
        </div>
        <form className={styles.search} role="search" onSubmit={onSearch}>
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={c.board.search} aria-label={c.board.search} maxLength={100} />
          <Button square size="sm" type="submit">{c.board.searchButton}</Button>
        </form>
      </div>
      {list.isPending ? <Skeleton lines={6} /> : list.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void list.refetch()} /> : (
        <>
          <table className={styles.table}>
            <thead><tr><th className={styles.mh}>{c.cols.no}</th><th>{c.cols.course}</th><th>{c.cols.title}</th><th className={styles.mh}>{c.cols.author}</th><th>{c.cols.star}</th><th className={styles.mh}>{c.cols.date}</th><th className={styles.mh}>{c.cols.views}</th></tr></thead>
            <tbody>
              {data!.items.length ? data!.items.map((r, i) => (
                <tr key={r.idx}>
                  <td className={styles.mh}>{data!.total - (page - 1) * data!.size - i}</td>
                  <td className={styles.left}><Link to={`/support/reviews/${r.idx}`}>{r.courseName ?? r.lectureCode}</Link></td>
                  <td className={styles.left}><Link to={`/support/reviews/${r.idx}`}>{cut(r.title)}</Link></td>
                  <td className={styles.mh}>{r.author}</td>
                  <td><Stars value={r.starPoint} /></td>
                  <td className={styles.mh}>{r.regDate ?? ''}</td>
                  <td className={styles.mh}>{r.viewCount}</td>
                </tr>
              )) : <tr><td colSpan={7}>{c.board.empty}</td></tr>}
            </tbody>
          </table>
          <Pagination page={page} total={data!.total} size={data!.size} onChange={(p) => set({ page: p > 1 ? String(p) : null })} />
        </>
      )}
    </div>
  );
}

/** `/support/reviews/:idx` — public/support/survey_view.html (one view counted per open). */
export function ReviewBoardDetailPage() {
  const { idx = '' } = useParams();
  const id = Number(idx);
  const one = useReviewBoardOne(Number.isInteger(id) ? id : 0);
  if (one.isPending) return <div className={`${styles.page} ${styles.inLayout}`}><Skeleton lines={6} /></div>;
  if (one.isError) return <div className={`${styles.page} ${styles.inLayout}`}><StateBlock code="NOT_FOUND" title={c.notFound} actions={<Button square size="sm" to="/support/reviews">{c.list}</Button>} /></div>;
  const r = one.data;
  return (
    <div className={`${styles.page} ${styles.inLayout}`}>
      <article className={styles.view}>
        <div className={styles.viewHead}><h2>{r.title}</h2><div className={styles.meta}><span>{c.regDate}<b>{r.regDate ?? ''}</b></span><span>{c.views}<b>{r.viewCount}</b></span></div></div>
        <dl className={styles.viewInfo}><dt>{c.course}</dt><dd><Link to={`/support/reviews?lectureCode=${encodeURIComponent(r.lectureCode)}`}>{r.courseName ?? r.lectureCode}</Link></dd><dt>{c.star}</dt><dd><Stars value={r.starPoint} /></dd></dl>
        <div className={styles.contents}>{r.contents}</div>
      </article>
      <div className={styles.actions}><Button square to="/support/reviews">{c.list}</Button></div>
    </div>
  );
}
