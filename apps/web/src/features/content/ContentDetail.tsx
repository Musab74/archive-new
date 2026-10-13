import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './ContentDetail.module.css';
import { catalogApi } from '../../shared/api/endpoints/catalog';
import { isAppError } from '../../shared/api/client';
import type { CourseDetail } from '../../shared/api/schemas';
import { useSession } from '../../shared/auth/useSession';
import { useToast } from '../../app/providers/ToastProvider';
import { Breadcrumb } from '../../shared/ui/Breadcrumb';
import { LegacyHtml } from '../../shared/ui/LegacyHtml';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { TypeLabel, Tag } from '../../shared/ui/Pill';
import { Tabs } from '../../shared/ui/Tabs';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Modal } from '../../shared/ui/Modal';
import { Textarea } from '../../shared/ui/Form';
import { catalog as catalogCopy, common, content as copy, nav } from '../../shared/strings/ko';
import { formatDate, formatMinutes, formatNumber, typeLabel, cx } from '../../shared/utils/format';
import type { StateCode } from '../../shared/strings/ko';

const TABS = [{ key: 'intro', label: copy.tabs.intro }, { key: 'outline', label: copy.tabs.outline }, { key: 'reviews', label: copy.tabs.reviews }];

function errorState(code: string, status: number): StateCode {
  if (status === 404) return 'UNAVAILABLE';
  if (code === 'NO_ACCESS' || status === 403) return 'NO_ACCESS';
  if (code === 'PERIOD_EXPIRED') return 'ENDED';
  if (status === 401) return 'GUEST';
  return 'ACCESS_ERROR';
}

/** AR-05 콘텐츠 상세: hero (copy + poster + meta grid), 학습하기/찜, tabs 소개·구성·평점·후기. */
export default function ContentDetail() {
  const { lectureCode = '' } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthed } = useSession();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState('intro');
  const [loginOpen, setLoginOpen] = useState(false);
  const [star, setStar] = useState(0);
  const [comment, setComment] = useState('');
  const [rateMsg, setRateMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const detail = useQuery({ queryKey: ['catalog', 'course', lectureCode, isAuthed], queryFn: ({ signal }) => catalogApi.course(lectureCode, signal), enabled: !!lectureCode });
  useEffect(() => { if (detail.data?.myRating) setStar(detail.data.myRating); }, [detail.data?.myRating]);

  const like = useMutation({
    mutationFn: (liked: boolean) => catalogApi.like(lectureCode, liked),
    onMutate: (liked) => { const key = ['catalog', 'course', lectureCode, isAuthed]; const prev = qc.getQueryData<CourseDetail>(key); if (prev) qc.setQueryData<CourseDetail>(key, { ...prev, liked }); return { prev, key }; },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev); toast(copy.likeFail, { tone: 'danger' }); },
  });
  const rate = useMutation({
    mutationFn: () => catalogApi.review(lectureCode, { starPoint: star, contents: comment }),
    onSuccess: () => { setRateMsg({ text: copy.rateDone }); setComment(''); void detail.refetch(); },
    onError: (e) => setRateMsg({ text: isAppError(e) ? e.message : copy.rateFail, error: true }),
  });

  if (detail.isPending) {
    return (
      <div className={styles.body} aria-busy="true">
        <Skeleton height={14} width={120} /><Skeleton height={36} width="60%" style={{ marginTop: 12 }} /><Skeleton lines={4} />
      </div>
    );
  }
  if (detail.isError) {
    const err = detail.error;
    const code = isAppError(err) ? errorState(err.code, err.status) : 'ACCESS_ERROR';
    return <div className={styles.stateWrap}><StateBlock code={code} onRetry={() => void detail.refetch()} /></div>;
  }
  const c = detail.data;
  const liked = !!c.liked;
  const canLearn = isAuthed && c.studySeq != null;
  const learnLabel = c.progress && c.progress >= 100 ? copy.relearn : c.lastChapterSeq ? copy.continueLearn : copy.learn;

  const onLearn = () => {
    if (!isAuthed) { setLoginOpen(true); return; }
    if (c.studySeq != null) navigate(`/learn/${c.studySeq}/${c.lastChapterSeq ?? c.chapters[0]?.seq ?? 1}`);
    else navigate(`/my/profile`);
  };
  const onLike = () => {
    if (!isAuthed) { setLoginOpen(true); return; }
    like.mutate(!liked);
  };
  const onRate = () => {
    if (!isAuthed) { setRateMsg({ text: copy.rateLoginNeeded, error: true }); return; }
    if (!star) { setRateMsg({ text: copy.rateSelect, error: true }); return; }
    rate.mutate();
  };
  const backTo = sp.get('from') ?? '/catalog';
  const avg = c.rating != null && c.ratingCount > 0 ? c.rating.toFixed(1) : null;

  return (
    <article>
      <div className={styles.path}>
        <Breadcrumb items={[{ label: nav.archive, to: '/catalog' }, { label: c.category1 ?? typeLabel(c.ctype), to: backTo }, { label: copy.crumb }]} />
        <Button variant="text" size="xs" to={backTo} icon={<Icon name="arrow-left" size={14} />}>{copy.backToList}</Button>
      </div>
      <section className={styles.hero}>
        <div className={styles.copy}>
          <div className={styles.labels}>
            <TypeLabel>{typeLabel(c.ctype)}</TypeLabel>
            {c.category1 ? <TypeLabel tone="gray">{c.category1}{c.category2 ? ` · ${c.category2}` : ''}</TypeLabel> : null}
            {c.isPublic ? <TypeLabel tone="mint">{copy.publicBadge}</TypeLabel> : null}
          </div>
          <h1>{c.title}</h1>
          {c.objective || c.description ? <p className={styles.intro}>{(c.objective ?? c.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)}</p> : null}
          <dl className={styles.meta}>
            <div><dt>{copy.meta.type}</dt><dd>{typeLabel(c.ctype)}</dd></div>
            <div><dt>{copy.meta.duration}</dt><dd>{formatMinutes(c.minutes)}</dd></div>
            <div><dt>{copy.meta.year}</dt><dd>{c.year ?? '—'}</dd></div>
            <div><dt>{copy.meta.updated}</dt><dd>{formatDate(c.updatedDate ?? c.regDate) || '—'}</dd></div>
            <div><dt>{copy.meta.teacher}</dt><dd>{c.teacher ?? '—'}</dd></div>
            <div><dt>{copy.meta.views}</dt><dd>{formatNumber(c.viewCount)}</dd></div>
            <div><dt>{copy.meta.rating}</dt><dd>{avg ? `★ ${avg} (${formatNumber(c.ratingCount)})` : common.noRating}</dd></div>
            <div><dt>{copy.meta.category}</dt><dd>{c.category1 ?? '—'}</dd></div>
          </dl>
          <div className={styles.actions}>
            <Button square size="lg" onClick={onLearn} iconRight={<Icon name="arrow" size={16} />} disabled={isAuthed && !canLearn && c.studySeq === null}>{learnLabel}</Button>
            <Button variant="secondary" square size="lg" onClick={onLike} aria-pressed={liked} icon={<Icon name="heart" size={18} style={liked ? { fill: 'currentColor', color: 'var(--c-accent-warm)' } : undefined} />}>{liked ? copy.liked : copy.like}</Button>
          </div>
          {c.keywords.length ? <div className={styles.keywords}>{c.keywords.map((k) => <Tag key={k}>#{k}</Tag>)}</div> : null}
        </div>
        <div className={styles.poster}>
          {c.thumbnailUrl ? <img src={c.thumbnailUrl} alt="" /> : <><small>{typeLabel(c.ctype).toUpperCase()}</small><strong>{c.title}</strong></>}
          {c.previewUrl ? <a className={styles.previewBtn} href={c.previewUrl} target="_blank" rel="noopener noreferrer"><Icon name="play" size={14} /> {copy.preview}</a> : null}
        </div>
      </section>

      <Tabs items={TABS} value={tab} onChange={setTab} label={copy.crumb} />
      <div className={styles.body}>
        {tab === 'intro' ? (
          <section className={styles.part} aria-labelledby="intro-h"><h2 id="intro-h">{copy.introTitle}</h2><LegacyHtml html={c.description ?? c.objective ?? '—'} /></section>
        ) : null}
        {tab === 'outline' ? (
          <section className={styles.part} aria-labelledby="outline-h">
            <div className={styles.grid}>
              <div>
                <h2 id="outline-h">{copy.outlineTitle}</h2>
                {c.chapters.length === 0 ? <p>{copy.outlineEmpty}</p> : (
                  <ol className={styles.lessons}>
                    {c.chapters.map((ch) => (
                      <li key={ch.seq} className={styles.lesson}>
                        <span className={styles.lessonNum}>{ch.number}</span>
                        <span className={styles.lessonText}>{ch.title}</span>
                        {ch.completed ? <span className={styles.lessonDone}>완료</span> : null}
                        {ch.minutes ? <span className={styles.lessonTime}>{formatMinutes(ch.minutes)}</span> : null}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <div className={styles.teacher}>
                <div className={styles.tsym} aria-hidden="true"><Icon name="user" size={24} /></div>
                <h3>{copy.teacherTitle} · {c.teacher ?? '—'}</h3>
                <p>{c.teacherIntro ?? ''}</p>
              </div>
            </div>
          </section>
        ) : null}
        {tab === 'reviews' ? (
          <section className={styles.part} aria-labelledby="reviews-h">
            <h2 id="reviews-h">{copy.reviewsTitle}</h2>
            <div className={styles.grid}>
              <div>
                <div className={styles.summary}>{avg ? <><b>★ {avg}</b><span>{copy.ratingsSummary(avg, c.ratingCount)}</span></> : <span>{common.noRating}</span>}</div>
                {c.reviews.length === 0 ? <p>{copy.reviewsEmpty}</p> : c.reviews.map((r) => (
                  <div key={r.idx} className={styles.review}><b>★ {r.starPoint}</b> {r.title || r.contents}<small>{r.name} · {formatDate(r.regDate)}</small></div>
                ))}
              </div>
              <div className={styles.ratingBox}>
                <h3>{copy.rateTitle}</h3>
                <p>{copy.rateLead}</p>
                <div className={styles.stars} role="radiogroup" aria-label={copy.rateTitle}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={star === n} aria-label={copy.rateStar(n)} className={cx(n <= star && styles.filled)} onClick={() => setStar(n)} disabled={!isAuthed || c.canRate === false}>★</button>
                  ))}
                </div>
                <label>
                  <span className="sr-only">{copy.rateComment}</span>
                  <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={copy.rateCommentPlaceholder} maxLength={2000} disabled={!isAuthed || c.canRate === false} />
                </label>
                <p className={cx(styles.ratingMsg, rateMsg?.error && styles.ratingErr)} role="status">{rateMsg?.text ?? (!isAuthed ? copy.rateLoginNeeded : '')}</p>
                <Button square size="sm" onClick={onRate} loading={rate.isPending} disabled={!isAuthed || c.canRate === false}>{copy.rateSubmit}</Button>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <Modal open={loginOpen} onClose={() => setLoginOpen(false)} title={copy.learnLoginTitle} symbol="lock"
        actions={<><Button variant="secondary" onClick={() => setLoginOpen(false)}>{common.cancel}</Button><Button to={`/auth/login?next=${encodeURIComponent(`/contents/${lectureCode}`)}`}>{common.goLogin}</Button></>}>
        {copy.learnLoginBody}
      </Modal>
      <p className="sr-only">{catalogCopy.help}</p>
    </article>
  );
}
