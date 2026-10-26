import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './Legal.module.css';
import { fillLegal, type LegalHtmlSection } from './legalText';
import { useLegalInfo } from './useLegalInfo';
import { Tabs } from '../../shared/ui/Tabs';
import { Button } from '../../shared/ui/Button';
import { LegacyHtml } from '../../shared/ui/LegacyHtml';
import { legal as copy } from '../../shared/strings/ko';

export interface LegalSection { id: string; title: string; body?: string; html?: string }

/**
 * AR-20 11 약관·정책: tabs, heading with 시행일/인쇄, TOC + body. Sections carry either the PHP document HTML (public/etc/include,
 * filled with SiteInfomation) or plain text. `?from=signup` adds 「동의 화면으로 돌아가기」.
 */
export function LegalDoc({ docKey, title, sections, effectiveDate, lead, extra }: { docKey: 'terms' | 'privacy'; title: string; sections: (LegalSection | LegalHtmlSection)[]; effectiveDate?: string; lead?: string; extra?: ReactNode }) {
  const { hash, search } = useLocation();
  const info = useLegalInfo();
  const fromSignup = new URLSearchParams(search).get('from') === 'signup';
  return (
    <article>
      <Tabs items={copy.tabs.map((t) => ({ key: t.key, label: t.label, to: t.to }))} value={docKey} label={copy.crumb} />
      <div className={`band ${styles.heading}`}>
        <div className="crumb">{copy.crumb}</div>
        <h1>{title}</h1>
        <p className={styles.meta}><span>{copy.effective} {effectiveDate ?? '—'}</span><button type="button" onClick={() => window.print()}>{copy.print}</button></p>
      </div>
      <div className={styles.content}>
        <div className={styles.columns}>
          <aside className={styles.toc} aria-label="목차">
            {sections.map((s) => <a key={s.id} href={`#${s.id}`} aria-current={hash === `#${s.id}` ? 'true' : undefined}>{s.title}</a>)}
          </aside>
          <div className={styles.body}>
            {lead ? <LegacyHtml className={styles.lead} html={fillLegal(lead, info)} /> : null}
            {sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
                <h2 id={`${s.id}-h`}>{fillLegal(s.title, info)}</h2>
                {'html' in s && s.html ? <LegacyHtml className={styles.doc} html={fillLegal(s.html, info)} /> : <p>{'body' in s ? s.body : ''}</p>}
              </section>
            ))}
            {extra}
            {fromSignup ? <Button variant="secondary" square to="/auth/signup/terms">{copy.backToConsent}</Button> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
