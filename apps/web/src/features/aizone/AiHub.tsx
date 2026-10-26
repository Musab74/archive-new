import { useMemo, useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from './AiHub.module.css';
import { catalogApi, type AiZoneParams, type AiZoneTab } from '../../shared/api/endpoints/catalog';
import { Section } from '../../shared/ui/Section';
import { Button } from '../../shared/ui/Button';
import { PillTabs } from '../../shared/ui/Tabs';
import { AppSelect } from '../../shared/ui/AppSelect';
import { Checkbox, Input } from '../../shared/ui/Form';
import { ContentCard, ContentCardSkeleton } from '../../shared/ui/ContentCard';
import { Pagination } from '../../shared/ui/Pagination';
import { StateBlock } from '../../shared/ui/StateBlock';
import { aiHub as copy } from '../../shared/strings/ko';

/** archive/aizone/main.html: 9 cards per page, sliders 1–600 min / 2018–this year / 0–5 stars. */
export const AI_HUB_PAGE_SIZE = 9;
const THIS_YEAR = new Date().getFullYear();
type Sort = 'popular' | 'new' | 'rating';
interface Filters { search: string; categories: string[]; ctypes: string[]; minTime: number; minYear: number; minRating: number }
const EMPTY: Filters = { search: '', categories: [], ctypes: [], minTime: 1, minYear: 2018, minRating: 0 };

/** Filters + sort → GET /catalog/ai-zone query (only the content tab takes filters, like aizone-content.php). Pure; exported for tests. */
export function aiHubQuery(tab: AiZoneTab, sort: Sort, f: Filters): AiZoneParams {
  if (tab !== 'content') return { tab };
  return {
    tab, type: sort === 'new' ? 'new' : 'popular', sortBy: sort === 'rating' ? 'rating' : 'latest',
    categories: f.categories, ctypes: f.ctypes, search: f.search.trim(), minTime: f.minTime, minYear: f.minYear, minRating: f.minRating,
  };
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * The old AI ZONE content hub (AI 콘텐츠 허브 / 실습형 AI / AI 관련 자격): tab, 과정 필터 (search, 세부 분야, 콘텐츠 형태,
 * minimum minutes / production year / rating), 조회순 · 최신순 · 평점순, 9 per page. Cards open the content page like the catalog.
 */
export function AiHub() {
  const [tab, setTab] = useState<AiZoneTab>('content');
  const [sort, setSort] = useState<Sort>('popular');
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const params = useMemo(() => aiHubQuery(tab, sort, applied), [tab, sort, applied]);
  const list = useQuery({ queryKey: ['catalog', 'ai-zone', params], queryFn: ({ signal }) => catalogApi.aiZone(params, signal), placeholderData: keepPreviousData, staleTime: 5 * 60_000 });
  const items = list.data?.items ?? [];
  const pageItems = items.slice((page - 1) * AI_HUB_PAGE_SIZE, page * AI_HUB_PAGE_SIZE);

  const apply = (e?: FormEvent) => { e?.preventDefault(); setApplied(draft); setPage(1); };
  const reset = () => { setDraft(EMPTY); setApplied(EMPTY); setPage(1); };
  const empty = tab === 'handson' ? copy.emptyHandson : tab === 'certification' ? copy.emptyCert : copy.empty;

  return (
    <Section title={copy.title} lead={copy.lead} soft>
      <div className={styles.head}>
        <PillTabs label={copy.tabsAria} items={copy.tabs} value={tab} onChange={(k) => { setTab(k as AiZoneTab); setPage(1); }} />
        {tab === 'content' ? (
          <AppSelect className={styles.sort} size="sm" icon="sort" aria-label={copy.sortAria} align="end" value={sort} onValueChange={(v) => { setSort(v as Sort); setPage(1); }} options={copy.sorts} />
        ) : null}
      </div>
      <div className={tab === 'content' ? styles.layout : undefined}>
        {tab === 'content' ? (
          <form className={styles.filters} onSubmit={apply} aria-label={copy.filters}>
            <div className={styles.filtersHead}><b>{copy.filters}</b><button type="button" className="text-link" onClick={reset}>{copy.reset}</button></div>
            <label className={styles.field}>
              <span className="sr-only">{copy.search}</span>
              <Input type="search" value={draft.search} placeholder={copy.search} maxLength={100} onChange={(e) => setDraft({ ...draft, search: e.target.value })} />
            </label>
            <fieldset className={styles.group}>
              <legend>{copy.field}</legend>
              {copy.categories.map((c) => <Checkbox key={c.value} label={c.label} checked={draft.categories.includes(c.value)} onChange={() => setDraft({ ...draft, categories: toggle(draft.categories, c.value) })} />)}
            </fieldset>
            <fieldset className={styles.group}>
              <legend>{copy.type}</legend>
              {copy.types.map((c) => <Checkbox key={c.value} label={c.label} checked={draft.ctypes.includes(c.value)} onChange={() => setDraft({ ...draft, ctypes: toggle(draft.ctypes, c.value) })} />)}
            </fieldset>
            <label className={styles.range}>
              <span>{copy.minTime} <b>{copy.minutes(draft.minTime)}</b></span>
              <input type="range" min={1} max={600} value={draft.minTime} onChange={(e) => setDraft({ ...draft, minTime: Number(e.target.value) })} aria-valuetext={copy.minutes(draft.minTime)} />
            </label>
            <label className={styles.range}>
              <span>{copy.minYear} <b>{copy.year(draft.minYear)}</b></span>
              <input type="range" min={2018} max={Math.max(2018, THIS_YEAR)} value={draft.minYear} onChange={(e) => setDraft({ ...draft, minYear: Number(e.target.value) })} aria-valuetext={copy.year(draft.minYear)} />
            </label>
            <label className={styles.range}>
              <span>{copy.minRating} <b>{copy.rating(draft.minRating)}</b></span>
              <input type="range" min={0} max={5} step={0.5} value={draft.minRating} onChange={(e) => setDraft({ ...draft, minRating: Number(e.target.value) })} aria-valuetext={copy.rating(draft.minRating)} />
            </label>
            <Button type="submit" square size="sm" block>{copy.apply}</Button>
          </form>
        ) : null}
        <div>
          <p className={styles.count} aria-live="polite">{list.isPending ? '' : list.data ? copy.count(list.data.count) : ''}</p>
          <div className={styles.grid} aria-busy={list.isFetching}>
            {list.isPending ? Array.from({ length: 3 }).map((_, i) => <ContentCardSkeleton key={i} />)
              : list.isError ? <div className={styles.span}><StateBlock code="LIST_ERROR" center onRetry={() => void list.refetch()} /></div>
              : pageItems.length === 0 ? <div className={styles.span}><StateBlock code="EMPTY" center title={empty} hideActions /></div>
              : pageItems.map((c) => <ContentCard key={c.lectureCode} course={c} badge={`${copy.difficulty} ${c.difficulty}`} />)}
          </div>
          <Pagination page={page} total={items.length} size={AI_HUB_PAGE_SIZE} onChange={setPage} label={copy.title} />
        </div>
      </div>
    </Section>
  );
}
