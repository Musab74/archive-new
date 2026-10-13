import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import styles from './AiZonePage.module.css';
import { catalogApi } from '../../shared/api/endpoints/catalog';
import { toApiQuery, CATALOG_PAGE_SIZE } from '../catalog/catalogParams';
import { useSession } from '../../shared/auth/useSession';
import { useDesign } from '../../shared/design/useDesign';
import { Section } from '../../shared/ui/Section';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { Pill } from '../../shared/ui/Pill';
import { ContentCard, ContentCardSkeleton } from '../../shared/ui/ContentCard';
import { Pagination } from '../../shared/ui/Pagination';
import { StateBlock } from '../../shared/ui/StateBlock';
import { AxisPromo } from '../../shared/ui/AxisPromo';
import { FormField, Input, Select, Textarea, FormMessage } from '../../shared/ui/Form';
import { aiZone as copy, catalog as catalogCopy, jobFields, footer as footerCopy } from '../../shared/strings/ko';
import { useReveal, useRevealChild } from '../../shared/motion/useReveal';
import { isAppError } from '../../shared/api/client';

const dirLink = (title: string) => `/catalog?competency=ai&field=${encodeURIComponent(title)}`;

function AiCatalog() {
  const [group, setGroup] = useState('');
  const [page, setPage] = useState(1);
  const categories = useQuery({ queryKey: ['catalog', 'categories'], queryFn: ({ signal }) => catalogApi.categories(signal), staleTime: 10 * 60_000 });
  const query = toApiQuery({ q: '', competency: 'ai', field: group, type: '', sort: 'latest', page }, categories.data?.items ?? []);
  const byCategory = useQuery({ queryKey: ['catalog', 'courses', query], queryFn: ({ signal }) => catalogApi.courses({ ...query, size: 6 }, signal), enabled: !categories.isPending || categories.isError });
  const categoryEmpty = byCategory.isSuccess && byCategory.data.total === 0;
  // AI contents are not assigned to the AI ZONE category in the live catalog; match them by keyword like the old site did.
  const byKeyword = useQuery({ queryKey: ['catalog', 'courses', 'ai-keyword', group, page], queryFn: ({ signal }) => catalogApi.courses({ q: group ? `AI ${group}` : 'AI', sort: 'popular', page, size: 6 }, signal), enabled: categoryEmpty });
  const list = categoryEmpty ? byKeyword : byCategory;
  return (
    <Section title={copy.catalogTitle} lead={copy.catalogLead} aside={<Button variant="text" size="sm" to="/catalog?competency=ai" iconRight={<Icon name="arrow" size={15} />}>{copy.viewAll}</Button>}>
      <div className={styles.pills} role="group" aria-label={copy.directionsTitle}>
        <Pill pressed={group === ''} onClick={() => { setGroup(''); setPage(1); }}>{catalogCopy.allTypes}</Pill>
        {copy.categories.map((c) => <Pill key={c.key} pressed={group === c.title} onClick={() => { setGroup(c.title); setPage(1); }}>{c.title}</Pill>)}
      </div>
      <div className={styles.toolbar} aria-live="polite">{list.isPending ? catalogCopy.counting : list.data ? catalogCopy.count(list.data.total) : ''}</div>
      <div className={styles.catalogGrid} aria-busy={list.isPending}>
        {list.isPending ? Array.from({ length: 3 }).map((_, i) => <ContentCardSkeleton key={i} />)
          : list.isError ? <div className={styles.empty}><StateBlock code="LIST_ERROR" center onRetry={() => void list.refetch()} /></div>
          : list.data.items.length === 0 ? <div className={styles.empty}><StateBlock code="EMPTY" center title={catalogCopy.empty.title} body={catalogCopy.empty.body} hideActions /></div>
          : list.data.items.map((c) => <ContentCard key={c.lectureCode} course={c} />)}
      </div>
      {list.data ? <Pagination page={page} total={list.data.total} size={list.data.size || CATALOG_PAGE_SIZE} onChange={setPage} label={copy.catalogTitle} /> : null}
    </Section>
  );
}

function RoadmapGenerator() {
  const { isAuthed } = useSession();
  const [goal, setGoal] = useState('');
  const [field, setField] = useState('');
  const [level, setLevel] = useState('beginner');
  const [error, setError] = useState('');
  const gen = useMutation({ mutationFn: () => catalogApi.roadmap({ goal: goal.trim(), field, level }) });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isAuthed) { setError(copy.generator.loginNeeded); return; }
    if (goal.trim().length < 4) { setError(copy.generator.goalPlaceholder); return; }
    setError('');
    gen.mutate();
  };
  return (
    <Section soft eyebrow={copy.generator.eyebrow} title={copy.generator.title} lead={copy.generator.lead}>
      <div className={styles.gen}>
        <form className={styles.genForm} onSubmit={onSubmit} aria-label={copy.generator.eyebrow}>
          <FormField label={copy.generator.goal} required htmlFor="rm-goal">
            <Textarea id="rm-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={copy.generator.goalPlaceholder} maxLength={500} required />
          </FormField>
          <div className={styles.genRow}>
            <FormField label={copy.generator.field} htmlFor="rm-field"><Select id="rm-field" value={field} onChange={(e) => setField(e.target.value)} placeholder={catalogCopy.allTypes} options={jobFields.map((f) => ({ value: f, label: f }))} /></FormField>
            <FormField label={copy.generator.level} htmlFor="rm-level"><Select id="rm-level" value={level} onChange={(e) => setLevel(e.target.value)} options={copy.generator.levels} /></FormField>
          </div>
          <FormMessage>{error}</FormMessage>
          {!isAuthed ? <FormMessage tone="ok">{copy.generator.loginNeeded}</FormMessage> : null}
          <div className="action-row">
            {isAuthed ? <Button type="submit" square loading={gen.isPending} icon={<Icon name="spark" size={16} />}>{copy.generator.submit}</Button> : <Button square to={`/auth/login?next=${encodeURIComponent('/ai-zone')}`}>{copy.generator.submit}</Button>}
          </div>
          <p className={styles.note}>{copy.generator.note}</p>
        </form>
        <div className={styles.result} aria-live="polite">
          <h3>{copy.generator.result}</h3>
          {gen.isError ? <StateBlock code="LIST_ERROR" kicker={copy.states.recommendFail.kicker} title={copy.states.recommendFail.title} body={isAppError(gen.error) ? gen.error.message : copy.generator.error} onRetry={() => gen.mutate()} /> : null}
          {gen.data ? (gen.data.items.length === 0 ? <p>{copy.generator.empty}</p> : (
            <>
              {gen.data.summary ? <p>{gen.data.summary}</p> : null}
              <ol>
                {gen.data.items.map((it) => (
                  <li key={it.order}><b>{String(it.order).padStart(2, '0')}</b><div>{it.lectureCode ? <a href={`/courses/${encodeURIComponent(it.lectureCode)}`}>{it.title}</a> : it.title}{it.reason ? <small>{it.reason}</small> : null}</div></li>
                ))}
              </ol>
            </>
          )) : !gen.isError ? <p className={styles.note}>{copy.generator.lead}</p> : null}
        </div>
      </div>
    </Section>
  );
}

/** AR-04 AI ZONE: gradient hero with four directions, direction cards → catalog filters, AI catalog, roadmap generator, recommendation path, 교육원 link, AXIS banner. */
export default function AiZonePage() {
  const { config } = useDesign();
  const reveal = useReveal();
  const child = useRevealChild();
  return (
    <div>
      <section className={`band ${styles.hero}`} aria-label={copy.eyebrow}>
        <div className={styles.four}>
          {copy.categories.map((c, i) => <div key={c.key}><em>{String(i + 1).padStart(2, '0')}</em><div><b>{c.title}</b><span>{c.short}</span></div></div>)}
        </div>
        <div>
          <div className={styles.eyebrow}>{copy.eyebrow}</div>
          <h1>{copy.title}</h1>
          <p>{copy.heroLead}</p>
          <div className="action-row">
            <Button variant="white" square to="/catalog?competency=ai" iconRight={<Icon name="arrow" size={16} />}>{copy.viewContents}</Button>
            <Button variant="ghost" square to="/roadmap">{copy.roadmap}</Button>
          </div>
        </div>
      </section>
      <Section title={copy.directionsTitle} lead={copy.directionsLead}>
        <motion.div className={styles.dirs} {...reveal}>
          {copy.categories.map((c, i) => (
            <motion.article key={c.key} className={styles.dir} {...child} custom={i}>
              <span className="eyebrow">{String(i + 1).padStart(2, '0')}</span>
              <h3>{c.title}</h3>
              <p>{c.short}</p>
              <div className={styles.topics}>{c.topics}</div>
              <Button variant="text" size="sm" to={dirLink(c.title)} className={styles.link} iconRight={<Icon name="arrow" size={15} />}>{copy.viewDirection}</Button>
            </motion.article>
          ))}
        </motion.div>
      </Section>
      <AiCatalog />
      <RoadmapGenerator />
      <section className={`band ${styles.path}`} aria-labelledby="ai-path">
        <h2 id="ai-path">{copy.pathTitle}</h2>
        <p>{copy.pathLead}</p>
        <div className={styles.steps}>{copy.pathSteps.map((s) => <div key={s.n}><b>{s.n}</b><strong>{s.title}</strong><span>{s.desc}</span></div>)}</div>
        <div className="action-row"><Button square to="/assessment/pre">{copy.preAssessment}</Button><Button variant="secondary" square to="/roadmap">{copy.roadmap}</Button></div>
      </section>
      {config.links.liveClassUrl ? (
        <section className={styles.ext}>
          <div><h3>{copy.academy.title}</h3><p>{copy.academy.desc}</p></div>
          <Button variant="secondary" href={config.links.liveClassUrl}>{copy.academy.cta}</Button>
        </section>
      ) : null}
      <AxisPromo variant="banner" banner="aiZone" />
      <p className="sr-only">{footerCopy.externalHint}</p>
    </div>
  );
}
