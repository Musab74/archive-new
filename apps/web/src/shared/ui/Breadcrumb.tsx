import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import styles from './Breadcrumb.module.css';
import { Icon } from './Icon';

export interface Crumb { label: string; to?: string }

export function Breadcrumb({ items, label = '현재 위치' }: { items: Crumb[]; label?: string }) {
  return (
    <nav aria-label={label} className={styles.crumb}>
      {items.map((c, i) => (
        <Fragment key={`${c.label}-${i}`}>
          {i > 0 ? <Icon name="chevron-right" size={13} className={styles.sep} /> : null}
          {c.to && i < items.length - 1 ? <Link to={c.to}>{c.label}</Link> : <span className={styles.current} aria-current={i === items.length - 1 ? 'page' : undefined}>{c.label}</span>}
        </Fragment>
      ))}
    </nav>
  );
}
