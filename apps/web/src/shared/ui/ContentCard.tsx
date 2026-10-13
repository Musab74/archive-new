import { Link } from 'react-router-dom';
import type { CourseCard } from '@ainex/contracts';
import styles from './ContentCard.module.css';
import { cx, formatMinutes, formatNumber, typeLabel } from '../utils/format';
import { Icon } from './Icon';
import { catalog as catalogCopy, common } from '../strings/ko';

export interface ContentCardProps {
  course: CourseCard;
  onLike?: (course: CourseCard, liked: boolean) => void;
  showLike?: boolean;
  horizontal?: boolean;
  /** Short word on the fallback tile (e.g. "AI & WORK"); defaults to the type label. */
  word?: string;
  /** Subtitle on the fallback tile; defaults to the first keyword or the category. */
  sub?: string;
  className?: string;
  badge?: string;
}

/**
 * Catalog card (storyboard `.content-card`): 16:9 thumbnail (image or typed colour tile), category line,
 * title, type · minutes, rating (★ 4.7 (38) | 평점 없음), 조회 n, optional like toggle.
 */
export function ContentCard({ course, onLike, showLike = !!onLike, horizontal, word, sub, className, badge }: ContentCardProps) {
  const to = `/courses/${encodeURIComponent(course.lectureCode)}`;
  const type = typeLabel(course.ctype);
  const liked = !!course.liked;
  const tone = ['X', 'Y', 'Z', 'W', 'A'].includes(course.ctype) ? course.ctype : 'Y';
  return (
    <article className={cx(styles.card, horizontal && styles.horizontal, className)}>
      <Link to={to} className={styles.thumbLink} aria-label={catalogCopy.detailView(course.title)} tabIndex={-1}>
        <div className={cx(styles.thumb, styles[tone as keyof typeof styles])}>
          {course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" loading="lazy" /> : (
            <>
              <small className={styles.word}>{(word ?? type).toUpperCase()}</small>
              <strong className={styles.sub}>{sub ?? course.keywords?.[0] ?? course.category1 ?? ''}</strong>
            </>
          )}
          <span className={styles.play} aria-hidden="true"><Icon name="play" size={10} /></span>
        </div>
      </Link>
      {showLike ? (
        <button type="button" className={cx(styles.like, liked && styles.liked)} aria-pressed={liked} aria-label={liked ? catalogCopy.unlike : catalogCopy.like} onClick={() => onLike?.(course, !liked)}>
          <Icon name="heart" size={18} />
        </button>
      ) : null}
      <div className={styles.copy}>
        <div className={styles.cat}><span>{course.category1 ?? type}</span><span>{badge ?? (course.serviceType === 'public' ? common.preview : course.category2 ?? '')}</span></div>
        <Link to={to} className={styles.title}>{course.title}</Link>
        <div className={styles.meta}><span>{type}</span><span>{formatMinutes(course.minutes)}</span></div>
        <div className={styles.rating}>
          {course.rating != null && course.ratingCount > 0 ? <span><span className={styles.star} aria-hidden="true">★</span><span className="sr-only">평점 </span> {course.rating.toFixed(1)} ({formatNumber(course.ratingCount)})</span> : <span>{common.noRating}</span>}
          <span>{common.views} {formatNumber(course.viewCount)}</span>
        </div>
      </div>
    </article>
  );
}

export function ContentCardSkeleton({ horizontal }: { horizontal?: boolean }) {
  return (
    <div className={cx(styles.card, horizontal && styles.horizontal)} aria-hidden="true">
      <div className={styles.thumbLink}><div className={styles.thumb} style={{ background: '#eef1f5' }} /></div>
      <div className={styles.copy}>
        <span style={{ height: 12, width: '40%', background: '#eef1f5', borderRadius: 4 }} />
        <span style={{ height: 44, background: '#eef1f5', borderRadius: 4 }} />
        <span style={{ height: 12, width: '55%', background: '#eef1f5', borderRadius: 4 }} />
      </div>
    </div>
  );
}
