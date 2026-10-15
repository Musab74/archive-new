import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import styles from './detail.module.css';
import { cx } from '../../utils/format';
import { Icon, type IconName } from '../Icon';
import { useT } from '../../i18n/adminLang';

/**
 * Detail ("inside") page layout for the admin console, used the same way on every record page:
 *
 *   <DetailPage>
 *     <DetailHeader … facts={[…]} actions={…} dangerActions={…} />
 *     <DetailTabs>
 *       <DetailTab id="info" label="기본 정보"> <InfoTable groups={…} /> </DetailTab>
 *       <DetailTab id="studies" label="수강 내역" count={12}> <SectionPanel …><DataTable … /></SectionPanel> </DetailTab>
 *     </DetailTabs>
 *   </DetailPage>
 *
 * Header = who/what this record is and what can be done with it; tabs = one topic per tab (the old page's sections);
 * InfoTable = label/value grid grouped by subject; SectionPanel = a titled block with a count and a toolbar.
 */

export function DetailPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.page, className)}>{children}</div>;
}

export interface Fact { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: 'ok' | 'warn' | 'danger' }
export interface Crumb { label: string; to?: string }

/** Record summary: icon/initial, title, subtitle, status badges, key facts and the grouped actions. */
export function DetailHeader({ title, subtitle, initial, icon, badges, facts, actions, dangerActions, back, crumbs }: {
  title: ReactNode; subtitle?: ReactNode; initial?: string; icon?: IconName; badges?: ReactNode; facts?: Fact[];
  /** Everyday actions (edit, export …), right-aligned. */ actions?: ReactNode;
  /** Destructive or rare actions (탈퇴, 삭제, 비밀번호 초기화 …) — collapsed under a "더보기" menu so they are never clicked by accident. */ dangerActions?: ReactNode;
  back?: { to: string; label: string }; crumbs?: Crumb[];
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!moreRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <header className={styles.header}>
      {crumbs?.length ? (
        <nav className={styles.crumbs} aria-label={t('현재 위치', 'Breadcrumb')}>
          {crumbs.map((c, i) => <span key={`${c.label}${i}`}>{i ? <Icon name="chevron-right" size={13} /> : null}{c.to && i < crumbs.length - 1 ? <Link to={c.to}>{c.label}</Link> : <b>{c.label}</b>}</span>)}
        </nav>
      ) : null}
      <div className={styles.headTop}>
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">{icon ? <Icon name={icon} size={24} /> : (initial ?? '?').slice(0, 1)}</span>
          <div className={styles.titles}>
            <h1>{title}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
            {badges ? <div className={styles.badges}>{badges}</div> : null}
          </div>
        </div>
        <div className={styles.actions}>
          {back ? <Link to={back.to} className={styles.backBtn}><Icon name="arrow-left" size={15} />{back.label}</Link> : null}
          {actions}
          {dangerActions ? (
            <div className={styles.more} ref={moreRef}>
              <button type="button" className={styles.moreBtn} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>{t('더보기', 'More')}<Icon name="chevron-down" size={14} /></button>
              {open ? <div className={styles.menu} role="menu" onClick={() => setOpen(false)}>{dangerActions}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
      {facts?.length ? (
        <dl className={styles.facts}>
          {facts.map((f, i) => (
            <div key={i} className={cx(styles.fact, f.tone && styles[`fact_${f.tone}`])}>
              <dt>{f.label}</dt><dd>{f.value === null || f.value === undefined || f.value === '' ? '—' : f.value}</dd>
              {f.hint ? <small>{f.hint}</small> : null}
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}

export interface DetailTabProps { id: string; label: ReactNode; count?: number | null; icon?: IconName; hidden?: boolean; children?: ReactNode }
/** One tab of a DetailTabs; renders nothing on its own. */
export function DetailTab(_: DetailTabProps): null { return null; }

/** Tabs with counts; the active tab is kept in the URL (?tab=…) so reload/back/links land on the same section. */
export function DetailTabs({ children, param = 'tab', label }: { children: ReactNode; param?: string; label?: string }) {
  const t = useT();
  const base = useId();
  const [sp, setSp] = useSearchParams();
  const tabs = useMemo(() => Children.toArray(children).filter((c): c is ReactElement<DetailTabProps> => isValidElement(c) && !(c.props as DetailTabProps).hidden).map((c) => c.props as DetailTabProps), [children]);
  const wanted = sp.get(param);
  const active = tabs.find((x) => x.id === wanted) ?? tabs[0];
  const select = (id: string) => { const next = new URLSearchParams(sp); if (id === tabs[0]?.id) next.delete(param); else next.set(param, id); setSp(next, { replace: true }); };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = tabs[(i + d + tabs.length) % tabs.length]!;
    select(n.id);
    document.getElementById(`${base}-t-${n.id}`)?.focus();
  };
  if (!active) return null;
  return (
    <section className={styles.tabsWrap}>
      <div className={styles.tabs} role="tablist" aria-label={label ?? t('상세 항목', 'Sections')}>
        {tabs.map((x, i) => (
          <button key={x.id} id={`${base}-t-${x.id}`} type="button" role="tab" aria-selected={x.id === active.id} aria-controls={`${base}-p-${x.id}`} tabIndex={x.id === active.id ? 0 : -1}
            className={styles.tab} onClick={() => select(x.id)} onKeyDown={(e) => onKey(e, i)}>
            {x.icon ? <Icon name={x.icon} size={16} /> : null}<span>{x.label}</span>
            {x.count !== undefined && x.count !== null ? <span className={styles.count}>{x.count.toLocaleString('ko-KR')}</span> : null}
          </button>
        ))}
      </div>
      <div id={`${base}-p-${active.id}`} role="tabpanel" aria-labelledby={`${base}-t-${active.id}`} className={styles.panel}>{active.children}</div>
    </section>
  );
}

export interface InfoRow { label: ReactNode; value: ReactNode; /** Spans the full width of the table. */ wide?: boolean }
export interface InfoGroup { title?: ReactNode; aside?: ReactNode; rows: InfoRow[] }

/** Label/value table grouped by subject (the old site's view table, cleaned up). 2 pairs per line on wide screens. */
export function InfoTable({ groups, columns = 2 }: { groups: InfoGroup[]; columns?: 1 | 2 }) {
  return (
    <div className={styles.infoGroups}>
      {groups.map((g, gi) => (
        <section key={gi} className={styles.infoGroup}>
          {g.title || g.aside ? <div className={styles.groupHead}><h3>{g.title}</h3>{g.aside}</div> : null}
          <dl className={cx(styles.info, columns === 2 && styles.info2)}>
            {g.rows.map((r, i) => (
              <div key={i} className={cx(styles.infoRow, r.wide && styles.infoWide)}>
                <dt>{r.label}</dt>
                <dd>{r.value === null || r.value === undefined || r.value === '' ? <span className={styles.empty}>—</span> : r.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

/** Titled block inside a tab: title + count, an optional toolbar (filters, buttons) and the content (usually a DataTable). */
export function SectionPanel({ title, count, toolbar, note, children, maxHeight }: { title: ReactNode; count?: number | null; toolbar?: ReactNode; note?: ReactNode; children?: ReactNode; maxHeight?: number }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h3>{title}{count !== undefined && count !== null ? <span className={styles.count}>{count.toLocaleString('ko-KR')}</span> : null}</h3>
        {toolbar ? <div className={styles.toolbar}>{toolbar}</div> : null}
      </div>
      {note ? <p className={styles.note}>{note}</p> : null}
      <div className={maxHeight ? styles.scroll : undefined} style={maxHeight ? { maxHeight } : undefined}>{children}</div>
    </section>
  );
}

/** Two panels side by side on wide screens (e.g. 로그인 내역 | 본인인증 내역), stacked on narrow ones. */
export function PanelGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid2}>{children}</div>;
}

/** A plain menu item for DetailHeader.dangerActions. */
export function MenuAction({ onClick, children, danger, disabled, title }: { onClick: () => void; children: ReactNode; danger?: boolean; disabled?: boolean; title?: string }) {
  return <button type="button" role="menuitem" className={cx(styles.menuItem, danger && styles.menuDanger)} onClick={onClick} disabled={disabled} title={title}>{children}</button>;
}
