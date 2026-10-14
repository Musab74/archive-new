import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion';
import styles from './EditorialHero.module.css';
import { Button } from '../../../shared/ui/Button';
import { Icon, type IconName } from '../../../shared/ui/Icon';
import { IconTile, type IconTone } from '../../../shared/ui/IconTile';
import { SearchField } from '../../../shared/ui/SearchField';
import { useHeaderOverlay } from '../../../shared/ui/headerChrome';
import { nav } from '../../../shared/strings/ko';
import { HeroStats, type StatItem } from './HeroStats';

export interface HeroArea { key: string; name: string; desc: string; icon: IconName; tone: IconTone; chips: string[]; to: string }

export interface EditorialHeroProps {
  eyebrow: string;
  /** Headline; `\n` (or, failing that, the first comma) splits lines; each staggers in and the last carries the drawn underline. */
  title: string;
  lead: string;
  cta: { label: string; to: string };
  secondary?: { label: string; to: string };
  areas: { label: string; all: string; count: (n: number) => string; go: (name: string) => string; items: HeroArea[] };
  stats: StatItem[];
  statsLabel: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Home hero (heroVariant 'visual-right'). Left: eyebrow, headline, lead, actions and the live stats strip.
 * Right: the learning-discovery panel — catalog search, the learning areas as colourful rows, and a preview pane that
 * follows hover/focus (master–detail, like the product itself). One staggered entrance; no looping motion.
 */
export function EditorialHero({ eyebrow, title, lead, cta, secondary, areas, stats, statsLabel }: EditorialHeroProps) {
  useHeaderOverlay();
  const reduced = useReducedMotionConfig();
  const navigate = useNavigate();
  const id = useId();
  const panelId = useId();
  // Explicit \n wins; a one-line tagline ("…을, …에.") breaks after its first comma so the last phrase carries the mark.
  const lines = useMemo(() => {
    const explicit = title.split('\n').map((l) => l.trim()).filter(Boolean);
    if (explicit.length > 1) return explicit;
    const m = title.match(/^(.+?[,，])\s+(.+)$/);
    return m ? [m[1]!, m[2]!] : explicit;
  }, [title]);
  const [statsStart, setStatsStart] = useState(false);
  const [active, setActive] = useState(0);
  const area = areas.items[active] ?? areas.items[0];

  useEffect(() => { const t = setTimeout(() => setStatsStart(true), reduced ? 0 : 700); return () => clearTimeout(t); }, [reduced]);

  const rise = (delay: number) => (reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
    : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: EASE } });

  return (
    <section className={`bleed ${styles.hero}`} aria-labelledby={id} data-hero="editorial">
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={`bleed-inner ${styles.inner}`}>
        <div className={styles.copy}>
          <motion.span className={styles.eyebrow} {...rise(0.05)}><span className={styles.dot} aria-hidden="true" />{eyebrow}</motion.span>
          <h1 id={id} className={styles.title}>
            {lines.map((line, i) => (
              <motion.span key={i} className={styles.line} {...rise(0.12 + i * 0.09)}>
                {i === lines.length - 1 ? (
                  <span className={styles.mark}>
                    {line}
                    <svg className={styles.underline} viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true">
                      <motion.path d="M3 11 C 70 4, 150 3, 297 8" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"
                        initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.55, ease: EASE }} />
                    </svg>
                  </span>
                ) : line}
              </motion.span>
            ))}
          </h1>
          <motion.p className={styles.lead} {...rise(0.3)}>{lead}</motion.p>
          <motion.div className={styles.actions} {...rise(0.38)}>
            <Button size="lg" to={cta.to} iconRight={<Icon name="arrow" size={18} />}>{cta.label}</Button>
            {secondary ? <Button variant="secondary" size="lg" to={secondary.to}>{secondary.label}</Button> : null}
          </motion.div>
          <motion.div className={styles.statsWrap} {...rise(0.46)}>
            <HeroStats items={stats} start={statsStart} delay={0} label={statsLabel} />
          </motion.div>
        </div>

        <motion.div className={styles.visual} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, delay: reduced ? 0 : 0.2, ease: EASE }}>
          <div className={styles.plate} aria-hidden="true" />
          <aside className={styles.panel} aria-labelledby={panelId}>
            <div className={styles.panelHead}>
              <div className={styles.panelTitleRow}>
                <span className={styles.panelDots} aria-hidden="true"><i /><i /><i /></span>
                <h2 id={panelId} className={styles.panelTitle}>{areas.label}</h2>
                <span className={styles.panelCount}>{areas.count(areas.items.length)}</span>
              </div>
              <Link to="/catalog" className={styles.panelAll}>{areas.all}<Icon name="arrow" size={14} /></Link>
            </div>
            <SearchField id={`${panelId}-q`} name="q" label={nav.search} placeholder={nav.searchPlaceholder} submitLabel={nav.searchSubmit} showSubmitText={false} clearLabel={nav.clearSearch}
              onSearch={(q) => navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog')} formClassName={styles.search} />
            <div className={styles.explore}>
              <ul className={styles.areas}>
                {areas.items.map((a, i) => (
                  <li key={a.key}>
                    <Link to={a.to} className={styles.area} data-area={a.key} data-active={i === active || undefined}
                      onPointerEnter={() => setActive(i)} onFocus={() => setActive(i)}>
                      <IconTile icon={a.icon} tone={a.tone} className={styles.areaTile} />
                      <span className={styles.areaText}><strong>{a.name}</strong><span>{a.desc}</span></span>
                      <Icon name="chevron-right" size={18} className={styles.areaGo} />
                    </Link>
                  </li>
                ))}
              </ul>
              {area ? (
                <div className={styles.preview} aria-hidden="true">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={area.key} className={styles.previewInner}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: EASE }}>
                      <IconTile icon={area.icon} tone={area.tone} size="lg" solid />
                      <b className={styles.previewName}>{area.name}</b>
                      <p className={styles.previewDesc}>{area.desc}</p>
                      <span className={styles.previewChips}>{area.chips.map((c) => <span key={c}>{c}</span>)}</span>
                      <Link to={area.to} tabIndex={-1} className={styles.previewGo} style={{ '--tone': `var(--cat-${area.tone})` } as React.CSSProperties}>{areas.go(area.name)}<Icon name="arrow" size={15} /></Link>
                    </motion.div>
                  </AnimatePresence>
                </div>
              ) : null}
            </div>
          </aside>
        </motion.div>
      </div>
    </section>
  );
}
