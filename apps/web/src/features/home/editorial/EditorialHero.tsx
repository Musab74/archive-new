import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotionConfig } from 'framer-motion';
import styles from './EditorialHero.module.css';
import { Button } from '../../../shared/ui/Button';
import { Icon, type IconName } from '../../../shared/ui/Icon';
import { useLoadIn } from '../../../shared/motion/loadIn';
import { motionTokens } from '../../../shared/motion/tokens';
import { useHeaderOverlay } from '../../../shared/ui/headerChrome';
import { nav } from '../../../shared/strings/ko';
import { HeroStats, type StatItem } from './HeroStats';

export interface HeroArea { key: string; name: string; desc: string; icon: IconName; to: string }

export interface EditorialHeroProps {
  eyebrow: string;
  /** Headline; `\n` splits lines (each line staggers in on its own). */
  title: string;
  lead: string;
  cta: { label: string; to: string };
  secondary?: { label: string; to: string };
  areas: { label: string; all: string; items: HeroArea[] };
  stats: StatItem[];
  statsLabel: string;
}

/**
 * Home hero for heroVariant 'visual-right': copy, two actions and the live stats strip on the left; on the right an
 * "explore" panel with a catalog search and the learning areas as links. The sticky header floats transparently
 * over it (useHeaderOverlay). One short load-in stagger, no looping motion.
 */
export function EditorialHero({ eyebrow, title, lead, cta, secondary, areas, stats, statsLabel }: EditorialHeroProps) {
  useHeaderOverlay();
  const reduced = useReducedMotionConfig();
  const navigate = useNavigate();
  const id = useId();
  const panelId = useId();
  const { parent, child } = useLoadIn(0.05);
  const lines = useMemo(() => title.split('\n').filter(Boolean), [title]);
  const [statsStart, setStatsStart] = useState(false);

  useEffect(() => { const t = setTimeout(() => setStatsStart(true), reduced ? 0 : 400); return () => clearTimeout(t); }, [reduced]);

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = (new FormData(e.currentTarget).get('q') as string | null)?.trim();
    navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog');
  };

  return (
    <section className={`bleed ${styles.hero}`} aria-labelledby={id} data-hero="editorial">
      <div className={`bleed-inner ${styles.inner}`}>
        <motion.div className={styles.copy} {...parent}>
          <motion.span className={styles.eyebrow} variants={child.variants}><span className={styles.dot} aria-hidden="true" />{eyebrow}</motion.span>
          <h1 id={id} className={styles.title}>
            {lines.map((line, i) => <motion.span key={i} className={styles.line} variants={child.variants}>{line}</motion.span>)}
          </h1>
          <motion.p className={styles.lead} variants={child.variants}>{lead}</motion.p>
          <motion.div className={styles.actions} variants={child.variants}>
            <Button size="lg" to={cta.to} iconRight={<Icon name="arrow" size={18} />}>{cta.label}</Button>
            {secondary ? <Button variant="secondary" size="lg" to={secondary.to}>{secondary.label}</Button> : null}
          </motion.div>
          <motion.div className={styles.statsWrap} variants={child.variants}>
            <HeroStats items={stats} start={statsStart} delay={reduced ? 0 : 400} label={statsLabel} />
          </motion.div>
        </motion.div>

        <motion.aside
          className={styles.panel}
          aria-labelledby={panelId}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: reduced ? 0 : 0.2, ease: motionTokens.ease }}
        >
          <div className={styles.panelHead}>
            <h2 id={panelId} className={styles.panelTitle}>{areas.label}</h2>
            <Link to="/catalog" className={styles.panelAll}>{areas.all}<Icon name="arrow" size={14} /></Link>
          </div>
          <form className={styles.search} role="search" onSubmit={onSearch}>
            <label className="sr-only" htmlFor={`${panelId}-q`}>{nav.search}</label>
            <Icon name="search" size={18} />
            <input id={`${panelId}-q`} name="q" type="search" placeholder={nav.searchPlaceholder} autoComplete="off" />
            <button type="submit">{nav.searchSubmit}</button>
          </form>
          <ul className={styles.areas}>
            {areas.items.map((a) => (
              <li key={a.key}>
                <Link to={a.to} className={styles.area} data-area={a.key}>
                  <span className={styles.areaIcon} aria-hidden="true"><Icon name={a.icon} size={20} /></span>
                  <span className={styles.areaText}><strong>{a.name}</strong><span>{a.desc}</span></span>
                  <span className={styles.areaGo} aria-hidden="true"><Icon name="chevron-right" size={18} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </motion.aside>
      </div>
    </section>
  );
}
