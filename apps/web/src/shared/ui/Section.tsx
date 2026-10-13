import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Section.module.css';
import { cx } from '../utils/format';

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  eyebrow?: ReactNode;
  num?: string;
  title?: ReactNode;
  lead?: ReactNode;
  /** Right-aligned element next to the heading (e.g. 전체 보기 link). */
  aside?: ReactNode;
  soft?: boolean;
  flush?: boolean;
  as?: 'section' | 'div' | 'article';
  headingLevel?: 'h1' | 'h2' | 'h3';
  children?: ReactNode;
}

/** Full-bleed section band (global .band: edge-to-edge background, content on the frame gutter) with the storyboard heading row (01 · title / lead / aside link). */
export function Section({ eyebrow, num, title, lead, aside, soft, flush, as = 'section', headingLevel = 'h2', className, children, ...rest }: SectionProps) {
  const Tag = as;
  const H = headingLevel;
  return (
    <Tag className={cx('band', styles.section, soft && styles.soft, flush && styles.flush, className)} {...rest}>
      {(title || lead || aside) && (
        <div className={styles.heading}>
          <div>
            {eyebrow ? <span className={cx('eyebrow', styles.eyebrow)}>{eyebrow}</span> : null}
            {title ? <H>{num ? <span className="hnum">{num}</span> : null}{title}</H> : null}
            {lead ? <p className={styles.lead}>{lead}</p> : null}
          </div>
          {aside ? <div className={styles.aside}>{aside}</div> : null}
        </div>
      )}
      {children}
    </Tag>
  );
}
