import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { normalizeHomeSections, type CourseCard, type HomeSectionKey } from '@ainex/contracts';
import styles from './PublicHome.module.css';
import { useDesign, useAssetUrl } from '../../shared/design/useDesign';
import { useSession } from '../../shared/auth/useSession';
import { catalogApi } from '../../shared/api/endpoints/catalog';
import { Hero } from '../../shared/ui/Hero';
import { AiZoneStrip } from '../../shared/ui/AiZoneStrip';
import { OperatingTypeCards } from '../../shared/ui/OperatingTypeCards';
import { AxisPromo } from '../../shared/ui/AxisPromo';
import { Section } from '../../shared/ui/Section';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { PillTabs } from '../../shared/ui/Tabs';
import { ContentCard, ContentCardSkeleton } from '../../shared/ui/ContentCard';
import { StateBlock } from '../../shared/ui/StateBlock';
import { competencies, home as copy, jobFields, nav, type CompetencyKey } from '../../shared/strings/ko';
import { useReveal, useRevealChild } from '../../shared/motion/useReveal';
import { EditorialHero, type HeroArea } from './editorial/EditorialHero';
import { IntroBand, type IntroStep } from './editorial/IntroBand';
import { JourneyBand, type JourneyStep } from './editorial/JourneyBand';
import { ContentTabs } from './editorial/ContentTabs';
import { CtaBand } from './editorial/CtaBand';
import type { StatItem } from './editorial/HeroStats';

const DISCOVERY: { key: CompetencyKey; icon: 'briefcase' | 'flag' | 'user' | 'spark' }[] = [
  { key: 'common', icon: 'briefcase' }, { key: 'job', icon: 'flag' }, { key: 'leadership', icon: 'user' }, { key: 'ai', icon: 'spark' },
];

function FeaturedSection() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('');
  const pick = useQuery({ queryKey: ['catalog', 'list', 1], queryFn: ({ signal }) => catalogApi.list(1, signal) });
  const pickEmpty = pick.isSuccess && (pick.data?.items ?? []).length === 0;
  // Operators may leave the PICK list empty → fall back to TOP10, then to the most popular contents.
  const top10 = useQuery({ queryKey: ['catalog', 'list', 2], queryFn: ({ signal }) => catalogApi.list(2, signal), enabled: pickEmpty });
  const top10Empty = top10.isSuccess && (top10.data?.items ?? []).length === 0;
  const popular = useQuery({ queryKey: ['catalog', 'featured', 'popular'], queryFn: ({ signal }) => catalogApi.courses({ size: 4, sort: 'popular' }, signal), enabled: pickEmpty && top10Empty });
  const typed = useQuery({ queryKey: ['catalog', 'featured', tab], queryFn: ({ signal }) => catalogApi.courses({ ctype: tab as 'X' | 'Y' | 'Z', size: 4, sort: 'popular' }, signal), enabled: tab !== '' });
  const allSource = pickEmpty ? (top10Empty ? popular : top10) : pick;
  const source = tab === '' ? allSource : typed;
  const items: CourseCard[] = tab === '' ? (allSource.data?.items ?? []).slice(0, 4) : (typed.data?.items ?? []).slice(0, 4);
  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = (new FormData(e.currentTarget).get('q') as string | null)?.trim();
    navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog');
  };
  return (
    <Section soft num={copy.featured.num} title={copy.featured.title} lead={copy.featured.lead} aside={<Button variant="text" size="sm" to="/catalog" iconRight={<Icon name="arrow" size={15} />}>{copy.featured.viewAll}</Button>}>
      <div className={styles.toolbar}>
        <PillTabs label={copy.featured.tabsAria} items={copy.featured.tabs.map((t) => ({ key: t.key, label: t.label }))} value={tab} onChange={setTab} />
        <form className={styles.search} role="search" onSubmit={onSearch}>
          <label className="sr-only" htmlFor="home-q">{nav.search}</label>
          <input id="home-q" name="q" type="search" placeholder={copy.featured.searchPlaceholder} autoComplete="off" />
          <button type="submit" aria-label={nav.searchSubmit}><Icon name="search" size={20} /></button>
        </form>
      </div>
      <div className={styles.grid} aria-busy={source.isPending}>
        {source.isPending ? Array.from({ length: 4 }).map((_, i) => <ContentCardSkeleton key={i} />)
          : source.isError ? <div className={styles.empty}><StateBlock code="LIST_ERROR" center onRetry={() => void source.refetch()} /></div>
          : items.length === 0 ? <div className={styles.empty}><StateBlock code="EMPTY" center hideActions /></div>
          : items.map((c) => <ContentCard key={c.lectureCode} course={c} />)}
      </div>
    </Section>
  );
}

function BrowseSection() {
  const reveal = useReveal();
  const child = useRevealChild();
  // ContentsKeyword Category 2 = 직무분야 (the 12 job fields of AR-01 '역량과 분야로 찾는 배움')
  const kw = useQuery({ queryKey: ['catalog', 'keywords', '2'], queryFn: ({ signal }) => catalogApi.keywords(signal, '2'), staleTime: 10 * 60_000 });
  const fields = useMemo(() => {
    const names = (kw.data?.items ?? []).map((k) => k.name).filter(Boolean);
    return names.length >= 12 ? names.slice(0, 12) : jobFields;
  }, [kw.data]);
  return (
    <Section num={copy.browse.num} title={copy.browse.title} lead={copy.browse.lead}>
      <motion.div className={styles.discovery} {...reveal}>
        {DISCOVERY.map((d, i) => (
          <motion.div key={d.key} {...child} custom={i}>
            <Link className={styles.dcard} to={d.key === 'ai' ? '/ai-zone' : `/catalog?competency=${d.key}`}>
              <Icon name={d.icon} size={27} />
              <strong>{competencies[d.key].label}</strong>
              <span>{competencies[d.key].desc}</span>
            </Link>
          </motion.div>
        ))}
      </motion.div>
      <p className={styles.jobLabel}>{copy.browse.jobLabel}</p>
      <nav className={styles.jobs} aria-label={copy.browse.jobLabel}>
        {fields.map((f) => <Link key={f} to={`/catalog?competency=job&field=${encodeURIComponent(f)}`}>{f}</Link>)}
      </nav>
    </Section>
  );
}

function ConsultingSection({ showFaq }: { showFaq: boolean }) {
  return (
    <Section>
      <div className={styles.support}>
        <div>
          <h2>{copy.consulting.title}</h2>
          <p>{copy.consulting.lead}</p>
          <div className="action-row">
            <Button square to="/support/inquiry/new" iconRight={<Icon name="arrow" size={15} />}>{copy.consulting.cta}</Button>
            <Button variant="secondary" square to="/support/guide">{copy.consulting.support}</Button>
          </div>
        </div>
        {showFaq ? (
          <div>
            {copy.faq.map((f) => <details key={f.q} className={styles.faq}><summary>{f.q}</summary><p>{f.a}</p></details>)}
            <div className="action-row"><Button variant="text" size="sm" to="/support/faq" iconRight={<Icon name="arrow" size={15} />}>{nav.support} · FAQ</Button></div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/** Editorial hero (heroVariant 'visual-right'): storyboard copy, old-site learning areas in the explore panel, live counts from /catalog/stats. */
function HomeHero({ isAuthed, title, siteName }: { isAuthed: boolean; title: string; siteName: string }) {
  const stats = useQuery({ queryKey: ['catalog', 'stats'], queryFn: ({ signal }) => catalogApi.stats(signal), staleTime: 10 * 60_000 });
  const e = copy.editorial;
  const items: StatItem[] = [
    { key: 'courses', value: stats.data?.courses ?? null, unit: e.stats.courses.unit, caption: e.stats.courses.caption },
    { key: 'categories', value: stats.data?.categories ?? null, unit: e.stats.categories.unit, caption: e.stats.categories.caption },
    { key: 'types', value: stats.data?.types ?? e.stats.types.value, unit: e.stats.types.unit, caption: e.stats.types.caption },
  ];
  return (
    <EditorialHero
      eyebrow={e.eyebrow}
      title={title}
      lead={copy.heroLead}
      cta={{ label: copy.heroCta, to: '/catalog' }}
      secondary={isAuthed ? { label: nav.myRoom, to: '/home' } : { label: copy.heroLogin, to: '/auth/login' }}
      areas={{ ...e.areas, items: e.areas.items as HeroArea[] }}
      stats={items}
      statsLabel={`${siteName} ${e.stats.aria}`}
    />
  );
}

/** AR-01 public main. Sections follow design.layout.homeSections order/visibility (keys the stored config predates are appended hidden until an admin toggles them on). */
export default function PublicHome() {
  const { config } = useDesign();
  const { isAuthed } = useSession();
  const heroImage = useAssetUrl(config.branding.heroAssetId);
  const order = useMemo(() => normalizeHomeSections(config.layout.homeSections, { missingVisible: false }), [config.layout.homeSections]);
  const visible = (k: HomeSectionKey) => order.find((s) => s.key === k)?.visible ?? false;
  const faqVisible = visible('faq');
  const siteName = config.branding.siteName;
  const title = config.branding.tagline || copy.heroTitle;
  const editorial = config.layout.heroVariant === 'visual-right';
  const e = copy.editorial;

  const render = (key: HomeSectionKey) => {
    switch (key) {
      case 'hero':
        return editorial ? <HomeHero key={key} isAuthed={isAuthed} title={title} siteName={siteName} /> : (
          <Hero key={key} tag={copy.heroTag} title={title} lead={copy.heroLead} cards={copy.heroCards} imageUrl={heroImage} imageAlt={siteName} variant={config.layout.heroVariant}
            actions={<>
              <Button square to="/catalog" iconRight={<Icon name="arrow" size={16} />}>{copy.heroCta}</Button>
              {isAuthed ? <Button variant="secondary" square to="/home">{nav.myRoom}</Button> : <Button variant="secondary" square to="/auth/login">{copy.heroLogin}</Button>}
            </>} />
        );
      case 'intro': return <IntroBand key={key} label={e.intro.label} title={e.intro.title(siteName)} body={e.intro.body(siteName)} cta={{ label: e.intro.cta, to: '/about' }} steps={e.intro.steps as IntroStep[]} />;
      case 'contentTabs': return <ContentTabs key={key} label={e.tabs.label} title={e.tabs.title} lead={e.tabs.lead} aria={e.tabs.aria} items={e.tabs.items} more={e.tabs.more} />;
      case 'ctaBand': return <CtaBand key={key} label={e.cta.label} title={e.cta.title(siteName)} lead={e.cta.lead} apply={{ label: e.cta.apply, to: '/support/inquiry/new' }} phone={{ label: e.cta.phone, href: e.cta.phoneHref }} columns={e.cta.columns} />;
      case 'aiZone': return <AiZoneStrip key={key} />;
      case 'operatingTypes': return <Section key={key} num={copy.modes.num} title={copy.modes.title} lead={copy.modes.lead}><OperatingTypeCards /></Section>;
      case 'featured': return <FeaturedSection key={key} />;
      case 'competencyBrowse': return <BrowseSection key={key} />;
      case 'journey': return <JourneyBand key={key} label={copy.journey.eyebrow} title={copy.journey.title} lead={copy.journey.lead} cta={{ label: copy.journey.cta, to: '/support/guide' }} steps={copy.journey.steps as JourneyStep[]} />;
      case 'axis': return <AxisPromo key={key} variant="main" />;
      case 'consulting': return <ConsultingSection key={key} showFaq={faqVisible} />;
      case 'faq': return null; // rendered inside the consulting row (storyboard layout)
      default: return null;
    }
  };

  const keys = order.filter((s) => s.visible).map((s) => s.key);
  // FAQ without consulting: still show the FAQ teaser.
  const faqOnly = faqVisible && !visible('consulting');
  return (
    <>
      {keys.map(render)}
      {faqOnly ? <ConsultingSection showFaq /> : null}
    </>
  );
}
