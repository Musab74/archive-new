import type { ReactNode } from 'react';
import styles from './Auth.module.css';
import { auth as copy } from '../../shared/strings/ko';

export function FindShell({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="page-heading">
        <div className="crumb">{copy.find.crumb}</div>
        <h1>{copy.find.title}</h1>
      </div>
      <section className={styles.section}><div className={styles.single}>{children}</div></section>
    </div>
  );
}
