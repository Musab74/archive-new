import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { CourseCard } from '@ainex/contracts';
import styles from './ContentCard.module.css';
import { cx, formatMinutes, formatNumber, typeLabel } from '../utils/format';
import { Icon, type IconName } from './Icon';
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

/** Content type → icon + support-palette tone (thumbnail badge and the designed fallback tile). */
export const TYPE_STYLE: Record<string, { icon: IconName; tone: string }> = {
  X: { icon: 'monitor', tone: 'var(--cat-blue)' },
  Y: { icon: 'bolt', tone: 'var(--cat-teal)' },
  Z: { icon: 'shorts', tone: 'var(--cat-coral)' },
  W: { icon: 'book', tone: 'var(--cat-violet)' },
  A: { icon: 'layers', tone: 'var(--cat-indigo)' },
};

export const contentTypeStyle = (ctype: string) => TYPE_STYLE[ctype] ?? TYPE_STYLE.Y!;

/**
 * Catalog card: 16:9 thumbnail (real image, or a designed tile tinted by content type) with type + duration badges,
 * category line, 2-line title, rating · views. The title link covers the card; the like toggle sits above it.
 */
export function ContentCard({ course, onLike, showLike = !!onLike, horizontal, word, sub, className, badge }: ContentCardProps) {
  const to = `/courses/${encodeURIComponent(course.lectureCode)}`;
  const type = typeLabel(course.ctype);
  const liked = !!course.liked;
  const ts = contentTypeStyle(course.ctype);
  const flag = badge ?? (course.serviceType === 'public' ? common.preview : null);
  const category = [course.category1, course.category2].filter(Boolean).join(' · ') || type;
  return (
    <article className={cx(styles.card, horizontal && styles.horizontal, className)} style={{ '--tone': ts.tone } as CSSProperties}>
      <div className={styles.media}>
        <div className={cx(styles.thumb, !course.thumbnailUrl && styles.tile)}>
          {course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" loading="lazy" decoding="async" /> : (
            <>
              <span className={styles.tileIcon} aria-hidden="true"><Icon name={ts.icon} size={64} strokeWidth={1.25} /></span>
              {word ? <small className={styles.word}>{word.toUpperCase()}</small> : null}
              <strong className={styles.sub}>{sub ?? course.keywords?.[0] ?? course.category2 ?? course.category1 ?? ''}</strong>
            </>
          )}
          <span className={styles.typeBadge}><Icon name={ts.icon} size={13} />{type}</span>
          {course.minutes > 0 ? <span className={styles.duration}><Icon name="clock" size={12} />{formatMinutes(course.minutes)}</span> : null}
          <span className={styles.play} aria-hidden="true"><Icon name="play" size={16} /></span>
        </div>
      </div>
      {showLike ? (
        <button type="button" className={cx(styles.like, liked && styles.liked)} aria-pressed={liked} aria-label={liked ? catalogCopy.unlike : catalogCopy.like} onClick={() => onLike?.(course, !liked)}>
          <Icon name="heart" size={17} />
        </button>
      ) : null}
      <div className={styles.copy}>
        <div className={styles.cat}><span className={styles.catText}>{category}</span>{flag ? <span className={styles.flag}>{flag}</span> : null}</div>
        <Link to={to} className={styles.title} aria-label={catalogCopy.detailView(course.title)}><span>{course.title}</span></Link>
        <div className={styles.meta}>
          {course.rating != null && course.ratingCount > 0
            ? <span className={styles.rating}><Icon name="star" size={14} className={styles.star} /><b>{course.rating.toFixed(1)}</b><span className={styles.count}>({formatNumber(course.ratingCount)})</span><span className="sr-only">평점</span></span>
            : <span className={styles.count}>{common.noRating}</span>}
          <span className={styles.views}><Icon name="eye" size={14} />{common.views} {formatNumber(course.viewCount)}</span>
          <span className={styles.go} aria-hidden="true"><Icon name="arrow" size={16} /></span>
        </div>
      </div>
    </article>
  );
}

export function ContentCardSkeleton({ horizontal }: { horizontal?: boolean }) {
  return (
    <div className={cx(styles.card, styles.skeleton, horizontal && styles.horizontal)} aria-hidden="true">
      <div className={styles.media}><div className={cx(styles.thumb, styles.shimmer)} /></div>
      <div className={styles.copy}>
        <span className={styles.shimmer} style={{ height: 12, width: '42%' }} />
        <span className={styles.shimmer} style={{ height: 18, width: '92%' }} />
        <span className={styles.shimmer} style={{ height: 18, width: '64%' }} />
        <span className={styles.shimmer} style={{ height: 12, width: '50%', marginTop: 8 }} />
      </div>
    </div>
  );
}
