import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CourseCard } from '@ainex/contracts';
import styles from './Sections.module.css';
import { catalogApi } from '../../../shared/api/endpoints/catalog';
import { PillTabs } from '../../../shared/ui/Tabs';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { ContentCard, ContentCardSkeleton } from '../../../shared/ui/ContentCard';
import { StateBlock } from '../../../shared/ui/StateBlock';

export type ContentTabKey = 'all' | 'top' | 'new' | 'ai';
export interface ContentTabsProps { title: string; lead: string; aria: string; items: { key: string; label: string }[]; more: string; size?: number }

/** Old-site content tabs (전체 / 인기 / 최신 / AI 추천) backed by the catalog API (popular, TOP10, NEW, AI search). */
export function ContentTabs({ title, lead, aria, items, more, size = 8 }: ContentTabsProps) {
  const [tab, setTab] = useState<ContentTabKey>('all');
  const q = useQuery({
    queryKey: ['home', 'tabs', tab, size],
    queryFn: async ({ signal }): Promise<CourseCard[]> => {
      if (tab === 'top') return (await catalogApi.list(2, signal)).items.slice(0, size);
      if (tab === 'new') return (await catalogApi.list(3, signal)).items.slice(0, size);
      if (tab === 'ai') return (await catalogApi.courses({ q: 'AI', size, sort: 'popular' }, signal)).items;
      return (await catalogApi.courses({ size, sort: 'popular' }, signal)).items;
    },
    staleTime: 5 * 60_000,
  });
  const list = q.data ?? [];
  return (
    <section className={`bleed ${styles.tabsSection}`} aria-labelledby="home-tabs-h">
      <div className={`bleed-inner ${styles.tabsInner}`}>
        <div className={styles.tabsHead}>
          <div>
            <h2 id="home-tabs-h" className={styles.sectionTitle}>{title}</h2>
            <p className={styles.sectionLead}>{lead}</p>
          </div>
          <PillTabs label={aria} items={items} value={tab} onChange={(k) => setTab(k as ContentTabKey)} />
        </div>
        <div className={styles.cardGrid} aria-busy={q.isPending}>
          {q.isPending ? Array.from({ length: size }).map((_, i) => <ContentCardSkeleton key={i} />)
            : q.isError ? <div className={styles.span}><StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /></div>
            : list.length === 0 ? <div className={styles.span}><StateBlock code="EMPTY" center hideActions /></div>
            : list.map((c) => <ContentCard key={c.lectureCode} course={c} />)}
        </div>
        <div className={styles.moreRow}><Button variant="secondary" to={tab === 'ai' ? '/ai-zone' : '/catalog'} iconRight={<Icon name="arrow" size={15} />}>{more}</Button></div>
      </div>
    </section>
  );
}
