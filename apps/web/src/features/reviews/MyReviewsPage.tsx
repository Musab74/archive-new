import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import styles from './Reviews.module.css';
import { reviewsApi, type ReviewDetail } from '../../shared/api/endpoints/assessment';
import { isAppError } from '../../shared/api/client';
import { Breadcrumb } from '../../shared/ui/Breadcrumb';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Modal';
import { Pagination } from '../../shared/ui/Pagination';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { FormField, FormMessage, Input, Select, Textarea } from '../../shared/ui/Form';
import { my as myCopy, nav } from '../../shared/strings/ko';
import { useMyReview, useMyReviews } from '../assessment/queries';

const c = myCopy.reviews;

/** StarPointViewA: ★ for the score, ☆ for the rest of 5. */
export function Stars({ value }: { value: number }) {
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return <span className={styles.stars} role="img" aria-label={`${c.star} ${value}`}>{'★'.repeat(n)}<span>{'★'.repeat(5 - n)}</span></span>;
}

/** strcut_utf8($Title, 45). */
export const cut = (s: string, n = 45) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** `/my/reviews` — public/mypage/survey.html: the learner's own reviews, 10 per page, newest first. */
export default function MyReviewsPage() {
  const [page, setPage] = useState(1);
  const list = useMyReviews(page);
  const crumbs = [{ label: nav.myRoom, to: '/my' }, { label: c.title }];
  if (list.isError && isAppError(list.error) && list.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  const data = list.data;
  return (
    <div className={styles.page}>
      <Breadcrumb items={crumbs} />
      <div className={styles.head}><span className="eyebrow">{myCopy.crumb}</span><h1>{c.title}</h1><p>{c.lead}</p></div>
      {list.isPending ? <Skeleton lines={5} /> : list.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void list.refetch()} /> : (
        <>
          <table className={styles.table}>
            <thead><tr><th className={styles.mh}>{c.cols.no}</th><th className={styles.mh}>{c.cols.course}</th><th>{c.cols.title}</th><th>{c.cols.star}</th><th className={styles.mh}>{c.cols.date}</th><th className={styles.mh}>{c.cols.views}</th></tr></thead>
            <tbody>
              {data!.items.length ? data!.items.map((r, i) => (
                <tr key={r.idx}>
                  <td className={styles.mh}>{data!.total - (page - 1) * data!.size - i}</td>
                  <td className={`${styles.left} ${styles.mh}`}><Link to={`/my/reviews/${r.idx}`}>{r.courseName ?? r.lectureCode}</Link></td>
                  <td className={styles.left}><Link to={`/my/reviews/${r.idx}`}>{cut(r.title)}</Link></td>
                  <td><Stars value={r.starPoint} /></td>
                  <td className={styles.mh}>{r.regDate ?? ''}</td>
                  <td className={styles.mh}>{r.viewCount}</td>
                </tr>
              )) : <tr><td colSpan={6}>{c.empty}</td></tr>}
            </tbody>
          </table>
          <Pagination page={page} total={data!.total} size={data!.size} onChange={setPage} />
        </>
      )}
      <p className={styles.note}>{c.writeHint}</p>
    </div>
  );
}

/** `/my/reviews/:idx` — survey_view.html + survey_modify.html + survey_script.php (modify / del), owner only. */
export function MyReviewDetailPage() {
  const { idx = '' } = useParams();
  const id = Number(idx);
  const one = useMyReview(Number.isInteger(id) ? id : 0);
  const crumbs = [{ label: nav.myRoom, to: '/my' }, { label: c.title, to: '/my/reviews' }, { label: c.detailTitle }];
  if (one.isPending) return <div className={styles.page}><Skeleton lines={6} /></div>;
  if (one.isError) {
    if (isAppError(one.error) && one.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
    return <div className={styles.page}><Breadcrumb items={crumbs} /><StateBlock code="NOT_FOUND" title={c.notFound} actions={<Button square size="sm" to="/my/reviews">{c.list}</Button>} /></div>;
  }
  return <ReviewEditor key={one.data.idx} review={one.data} crumbs={crumbs} />;
}

function ReviewEditor({ review, crumbs }: { review: ReviewDetail; crumbs: { label: string; to?: string }[] }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(review.title);
  const [contents, setContents] = useState(review.contents);
  const [star, setStar] = useState(String(review.starPoint || 5));
  const [confirm, setConfirm] = useState<'edit' | 'remove' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['reviews'] });
  const update = useMutation({
    mutationFn: () => reviewsApi.update(review.idx, { title: title.trim(), contents: contents.trim(), starPoint: Number(star) }),
    onSuccess: () => { setConfirm(null); setEditing(false); setMsg({ tone: 'ok', text: c.done }); refresh(); },
    onError: (e) => { setConfirm(null); setMsg({ tone: 'error', text: isAppError(e) ? e.message : c.fail }); },
  });
  const remove = useMutation({
    mutationFn: () => reviewsApi.remove(review.idx),
    onSuccess: () => { refresh(); navigate('/my/reviews'); },
    onError: (e) => { setConfirm(null); setMsg({ tone: 'error', text: isAppError(e) ? e.message : c.fail }); },
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !contents.trim()) { setMsg({ tone: 'error', text: c.required }); return; }
    setConfirm('edit');
  };
  return (
    <div className={styles.page}>
      <Breadcrumb items={crumbs} />
      <div className={styles.head}><span className="eyebrow">{myCopy.crumb}</span><h1>{c.detailTitle}</h1></div>
      {editing ? (
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <FormField label={c.titleLabel} required htmlFor="rv-title"><Input id="rv-title" value={title} maxLength={250} onChange={(e) => setTitle(e.target.value)} /></FormField>
          <FormField label={c.star} required htmlFor="rv-star"><Select id="rv-star" value={star} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: c.starOption(n) }))} onValueChange={setStar} /></FormField>
          <FormField label={c.contentsLabel} required htmlFor="rv-contents"><Textarea id="rv-contents" rows={10} value={contents} onChange={(e) => setContents(e.target.value)} /></FormField>
          <FormMessage tone={msg?.tone}>{msg?.text}</FormMessage>
          <div className={styles.actions}><Button variant="secondary" square onClick={() => { setEditing(false); setMsg(null); }}>{c.cancel}</Button><Button square type="submit" loading={update.isPending}>{c.save}</Button></div>
        </form>
      ) : (
        <article className={styles.view}>
          <div className={styles.viewHead}><h2>{review.title}</h2><div className={styles.meta}><span>{c.regDate}<b>{(review.regDate ?? '').slice(0, 10)}</b></span><span>{c.views}<b>{review.viewCount}</b></span></div></div>
          <dl className={styles.viewInfo}><dt>{c.course}</dt><dd>{review.courseName ?? review.lectureCode}</dd><dt>{c.star}</dt><dd><Stars value={review.starPoint} /></dd></dl>
          <div className={styles.contents}>{review.contents}</div>
          {review.visible === false ? <p className={styles.note}>{c.hidden}</p> : null}
          <FormMessage tone={msg?.tone}>{msg?.text}</FormMessage>
          <div className={styles.actions} style={{ marginTop: 14 }}>
            <Button variant="secondary" square onClick={() => setConfirm('remove')}>{c.remove}</Button>
            <Button variant="secondary" square onClick={() => { setEditing(true); setMsg(null); }}>{c.edit}</Button>
            <Button square to="/my/reviews">{c.list}</Button>
          </div>
        </article>
      )}
      <Dialog open={confirm !== null} title={confirm === 'remove' ? c.confirmRemove : c.confirmEdit} tone={confirm === 'remove' ? 'warn' : 'info'} cancelLabel={c.cancel} loading={update.isPending || remove.isPending}
        onConfirm={() => (confirm === 'remove' ? remove.mutate() : update.mutate())} onCancel={() => setConfirm(null)} />
    </div>
  );
}
