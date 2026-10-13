import { useCallback, useEffect, useMemo, useRef, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CourseCard } from '@ainex/contracts';
import styles from './CatalogPage.module.css';
import { activeFilterCount, CATALOG_PAGE_SIZE, DEFAULT_CATALOG_PARAMS, parseCatalogParams, serializeCatalogParams, toApiQuery, type CatalogParams } from './catalogParams';
import { catalogApi, type CoursePage } from '../../shared/api/endpoints/catalog';
import { useSession } from '../../shared/auth/useSession';
import { useToast } from '../../app/providers/ToastProvider';
import { Breadcrumb } from '../../shared/ui/Breadcrumb';
import { TypeLabel } from '../../shared/ui/Pill';
import { Button } from '../../shared/ui/Button';
import { FilterSidebar, FilterSheet, SelectedFilters, type FilterOption, type FilterValue } from '../../shared/ui/FilterSidebar';
import { ContentCard, ContentCardSkeleton } from '../../shared/ui/ContentCard';
import { Pagination } from '../../shared/ui/Pagination';
import { StateBlock } from '../../shared/ui/StateBlock';
import { catalog as copy, competencies, contentType, jobFields, leadershipFields, aiZone, nav, content as contentCopy } from '../../shared/strings/ko';
import { useDesign } from '../../shared/design/useDesign';

const TYPE_OPTIONS: FilterOption[] = [{ value: 'elearning', label: contentType.X! }, { value: 'micro', label: contentType.Y! }, { value: 'short', label: contentType.Z! }];

/** AR-03 콘텐츠 탐색·목록: q/competency/field/type/sort/page live in the URL; sidebar (PC) / sheet (mobile); grid + pagination; EMPTY/LIST_ERROR states. */
export default function CatalogPage() {
  const [sp, setSp] = useSearchParams();
  const params = useMemo(() => parseCatalogParams(sp), [sp]);
  const { isAuthed } = useSession();
  const { config } = useDesign();
  const { toast } = useToast();
  const qc = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);

  const update = useCallback((patch: Partial<CatalogParams>, resetPage = true) => {
    const next = { ...params, ...patch, page: resetPage ? 1 : (patch.page ?? params.page) };
    setSp(serializeCatalogParams(next));
  }, [params, setSp]);

  const categories = useQuery({ queryKey: ['catalog', 'categories'], queryFn: ({ signal }) => catalogApi.categories(signal), staleTime: 10 * 60_000 });
  const apiQuery = useMemo(() => toApiQuery(params, categories.data?.items ?? []), [params, categories.data]);
  const list = useQuery({
    queryKey: ['catalog', 'courses', apiQuery],
    queryFn: ({ signal }) => catalogApi.courses(apiQuery, signal),
    placeholderData: keepPreviousData,
    enabled: !categories.isPending || categories.isError,
  });

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [params.page]);

  const like = useMutation({
    mutationFn: ({ course, liked }: { course: CourseCard; liked: boolean }) => catalogApi.like(course.lectureCode, liked),
    onMutate: ({ course, liked }) => {
      const key = ['catalog', 'courses', apiQuery];
      const prev = qc.getQueryData<CoursePage>(key);
      if (prev) qc.setQueryData<CoursePage>(key, { ...prev, items: prev.items.map((c) => (c.lectureCode === course.lectureCode ? { ...c, liked } : c)) });
      return { prev, key };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev); toast(contentCopy.likeFail, { tone: 'danger' }); },
  });

  const fields: FilterOption[] = useMemo(() => {
    if (!params.competency) return [];
    const cats = categories.data?.items ?? [];
    const top = cats.find((c) => !c.parentId && c.name.replace(/\s+/g, '') === competencies[params.competency as keyof typeof competencies].label.replace(/\s+/g, ''));
    const subs = top ? cats.filter((c) => c.parentId === top.id) : [];
    if (subs.length) return subs.map((c) => ({ value: c.name, label: c.name, count: c.count }));
    if (params.competency === 'job') return jobFields.map((f) => ({ value: f, label: f }));
    if (params.competency === 'leadership') return leadershipFields.map((f) => ({ value: f, label: f }));
    if (params.competency === 'ai') return aiZone.categories.map((c) => ({ value: c.title, label: c.title }));
    return [];
  }, [params.competency, categories.data]);

  const filterValue: FilterValue = { competency: params.competency, field: params.field, type: params.type };
  const onFilter = (v: FilterValue) => update({ competency: v.competency, field: v.field, type: v.type as CatalogParams['type'] });

  const chips = [
    ...(params.competency ? [{ key: 'competency', label: competencies[params.competency].label, onRemove: () => update({ competency: '', field: '' }) }] : []),
    ...(params.field ? [{ key: 'field', label: params.field, onRemove: () => update({ field: '' }) }] : []),
    ...(params.type ? [{ key: 'type', label: TYPE_OPTIONS.find((t) => t.value === params.type)?.label ?? params.type, onRemove: () => update({ type: '' }) }] : []),
    ...(params.q ? [{ key: 'q', label: `“${params.q}”`, onRemove: () => update({ q: '' }) }] : []),
  ];

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    update({ q: (searchRef.current?.value ?? '').trim() });
  };

  const data = list.data;
  const sortOptions = [...copy.sorts, ...(params.q ? [{ value: 'relevance', label: copy.relevance }] : [])];
  const crumbs = [{ label: isAuthed ? copy.crumbHome : nav.archive, to: isAuthed ? '/home' : '/' }, { label: copy.crumb }];

  return (
    <div>
      <section className={`band ${styles.title}`}>
        <Breadcrumb items={crumbs} />
        <h1>{copy.title}</h1>
        <p>{copy.lead}</p>
        {isAuthed ? (
          <div className={styles.scope}>
            <TypeLabel small>{config.branding.siteName}</TypeLabel>
            <Button variant="text" size="xs" to="/my/profile">{nav.myRoom} · 회원·이용정보</Button>
          </div>
        ) : null}
      </section>
      <div className={styles.body}>
        <FilterSidebar value={filterValue} onChange={onFilter} fields={fields} types={TYPE_OPTIONS} />
        <div className={styles.main}>
          <form className={styles.search} role="search" onSubmit={onSearch}>
            <label className="sr-only" htmlFor="catalog-q">{copy.searchLabel}</label>
            <input id="catalog-q" ref={searchRef} key={params.q} defaultValue={params.q} type="search" placeholder={copy.searchPlaceholder} autoComplete="off" />
            <button type="submit">{copy.search}</button>
          </form>
          <div className={styles.mobileFilter}>
            <FilterSheet value={filterValue} onChange={onFilter} fields={fields} types={TYPE_OPTIONS} activeCount={activeFilterCount(params)} />
          </div>
          <SelectedFilters chips={chips} onClear={() => setSp(serializeCatalogParams(DEFAULT_CATALOG_PARAMS))} />
          <div className={styles.toolbar}>
            <p className={styles.count} aria-live="polite">{list.isPending ? copy.counting : data ? <>{copy.count(data.total)}</> : null}</p>
            <label className={styles.sort}>
              <span className="sr-only">{copy.sort}</span>
              <select value={params.sort} onChange={(e) => update({ sort: e.target.value as CatalogParams['sort'] })}>
                {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>

          {list.isError ? (
            <StateBlock code="LIST_ERROR" center title={copy.error.title} body={copy.error.body} onRetry={() => void list.refetch()} />
          ) : list.isPending ? (
            <div className={styles.grid} aria-busy="true">{Array.from({ length: 6 }).map((_, i) => <ContentCardSkeleton key={i} />)}</div>
          ) : !data || data.items.length === 0 ? (
            <StateBlock code="EMPTY" center title={copy.empty.title} body={copy.empty.body} actions={<Button variant="secondary" square size="sm" onClick={() => setSp(serializeCatalogParams(DEFAULT_CATALOG_PARAMS))}>{copy.empty.action}</Button>} />
          ) : (
            <>
              <div className={styles.grid} aria-busy={list.isFetching}>
                {data.items.map((c) => <ContentCard key={c.lectureCode} course={c} showLike={isAuthed} onLike={(course, liked) => like.mutate({ course, liked })} />)}
              </div>
              <Pagination page={params.page} total={data.total} size={data.size || CATALOG_PAGE_SIZE} onChange={(p) => update({ page: p }, false)} label={copy.title} />
            </>
          )}
          <p className={styles.help}>{copy.help}</p>
        </div>
      </div>
    </div>
  );
}
