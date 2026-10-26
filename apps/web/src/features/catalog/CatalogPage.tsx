import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CourseCard } from '@ainex/contracts';
import styles from './CatalogPage.module.css';
import { activeFilterCount, CATALOG_PAGE_SIZE, DEFAULT_CATALOG_PARAMS, parseCatalogParams, serializeCatalogParams, toApiQuery, topCategoryOf, type CatalogParams } from './catalogParams';
import { catalogApi, type CoursePage } from '../../shared/api/endpoints/catalog';
import { useSession } from '../../shared/auth/useSession';
import { useToast } from '../../app/providers/ToastProvider';
import { Breadcrumb } from '../../shared/ui/Breadcrumb';
import { Icon } from '../../shared/ui/Icon';
import { TypeLabel } from '../../shared/ui/Pill';
import { Button } from '../../shared/ui/Button';
import { AppSelect } from '../../shared/ui/AppSelect';
import { SearchField } from '../../shared/ui/SearchField';
import { FilterSidebar, FilterSheet, SelectedFilters, type FilterOption, type FilterValue } from '../../shared/ui/FilterSidebar';
import { ContentCard, ContentCardSkeleton } from '../../shared/ui/ContentCard';
import { Pagination } from '../../shared/ui/Pagination';
import { StateBlock } from '../../shared/ui/StateBlock';
import { catalog as copy, competencies, contentType, jobFields, leadershipFields, aiZone, nav, content as contentCopy } from '../../shared/strings/ko';
import { useDesign } from '../../shared/design/useDesign';
import { qk } from '../my/queries';
import { enrollmentApi } from '../../shared/api/endpoints/enrollment';
import { formatDate } from '../../shared/utils/format';

const TYPE_OPTIONS: FilterOption[] = [{ value: 'elearning', label: contentType.X! }, { value: 'micro', label: contentType.Y! }, { value: 'short', label: contentType.Z! }];

/** AR-03 콘텐츠 탐색·목록: q/competency/field/type/sort/page live in the URL; sidebar (PC) / sheet (mobile); grid + pagination; EMPTY/LIST_ERROR states. */
export default function CatalogPage() {
  const [sp, setSp] = useSearchParams();
  const params = useMemo(() => parseCatalogParams(sp), [sp]);
  const { isAuthed } = useSession();
  const { config } = useDesign();
  const enrollments = useQuery({ queryKey: qk.enrollments, queryFn: ({ signal }) => enrollmentApi.list(signal), enabled: isAuthed, retry: false });
  const { toast } = useToast();
  const qc = useQueryClient();

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
    const top = topCategoryOf(cats, params.competency);
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

  const data = list.data;
  // 검색 관련도순 only with a search text; 찜한 콘텐츠순 only signed in (main/sections/tab-all.php OrderData 4)
  const sortOptions = [...copy.sorts, ...(isAuthed ? [{ value: 'liked', label: copy.likedSort }] : []), ...(params.q ? [{ value: 'relevance', label: copy.relevance }] : [])];
  const crumbs = [{ label: isAuthed ? copy.crumbHome : nav.archive, to: isAuthed ? '/home' : '/' }, { label: copy.crumb }];
  // AR-03 진입 상태: guests browse the public list; a signed-in learner without an active 이용건 sees why (기간 종료 / 시작 전 / 확인 실패)
  const rows = enrollments.data?.items ?? [];
  const active = rows.find((e) => e.state === 'ACTIVE') ?? null;
  const usage = !isAuthed ? 'GUEST' : enrollments.isError ? 'ACCESS_ERROR' : enrollments.isSuccess && !active ? (rows.some((e) => e.state === 'BEFORE') ? 'BEFORE' : rows.length ? 'ENDED' : null) : null;
  const st = copy.states;
  const notice = usage === 'GUEST' ? (
    <StateBlock code="GUEST" kicker={st.guest.kicker} title={st.guest.title} body={st.guest.body} actions={<Button size="sm" square to={`/auth/login?next=${encodeURIComponent('/catalog')}`}>{st.guest.action}</Button>} />
  ) : usage === 'ENDED' || usage === 'BEFORE' ? (
    <StateBlock code={usage} kicker={st[usage === 'ENDED' ? 'ended' : 'before'].kicker} title={st[usage === 'ENDED' ? 'ended' : 'before'].title} body={st[usage === 'ENDED' ? 'ended' : 'before'].body}
      actions={<><Button size="sm" square to="/my/profile">{st.ended.action}</Button><Button variant="secondary" size="sm" square to="/support/guide">{st.support}</Button></>} />
  ) : usage === 'ACCESS_ERROR' ? (
    <StateBlock code="ACCESS_ERROR" kicker={st.accessError.kicker} title={st.accessError.title} body={st.accessError.body}
      actions={<><Button size="sm" square onClick={() => void enrollments.refetch()}>{st.accessError.action}</Button><Button variant="secondary" size="sm" square to="/support/guide">{st.support}</Button></>} />
  ) : null;

  return (
    <div>
      <section className={`band ${styles.title}`}>
        <div className={styles.titleRow}>
          <div>
            <Breadcrumb items={crumbs} />
            <h1>{copy.title}</h1>
            <p>{copy.lead}</p>
            {isAuthed ? (
              <div className={styles.scope}>
                {active ? <><TypeLabel small tone={active.mode === 'NON_REFUND' ? 'mint' : 'navy'}>{active.mode === 'NON_REFUND' ? '비환급형' : '환급형'}</TypeLabel><span>{copy.scopePrefix} {formatDate(active.lectureStart)} ~ {formatDate(active.lectureEnd)}</span></> : <TypeLabel small>{config.branding.siteName}</TypeLabel>}
                <Button variant="text" size="xs" to="/my/profile">{nav.myRoom} · 회원·이용정보</Button>
              </div>
            ) : <p className={styles.scope}>{copy.publicNote}</p>}
          </div>
        </div>
        <SearchField key={params.q} id="catalog-q" size="lg" label={copy.searchLabel} placeholder={copy.searchPlaceholder} submitLabel={copy.search} clearLabel={nav.clearSearch}
          defaultValue={params.q} loading={list.isFetching && !list.isPending} onSearch={(q) => update({ q })} onClear={() => { if (params.q) update({ q: '' }); }} formClassName={styles.search} />
      </section>
      <div className={styles.body}>
        <FilterSidebar value={filterValue} onChange={onFilter} fields={fields} types={TYPE_OPTIONS} />
        <div className={styles.main}>
          <div className={styles.toolbar}>
            <div className={styles.summary}>
              <span className={styles.resultsLabel}>{params.q ? copy.results : copy.crumb}</span>
              <p className={styles.count} aria-live="polite">{list.isPending ? copy.counting : data ? copy.count(data.total) : null}</p>
            </div>
            <div className={styles.controls}>
              <div className={styles.mobileFilter}>
                <FilterSheet value={filterValue} onChange={onFilter} fields={fields} types={TYPE_OPTIONS} activeCount={activeFilterCount(params)} />
              </div>
              <AppSelect className={styles.sort} size="sm" icon="sort" prefix={copy.sortPrefix} aria-label={copy.sort} align="end"
                value={params.sort} onValueChange={(v) => update({ sort: v as CatalogParams['sort'] })} options={sortOptions} />
            </div>
          </div>
          <SelectedFilters chips={chips} onClear={() => setSp(serializeCatalogParams(DEFAULT_CATALOG_PARAMS))} />
          {notice}

          {list.isError ? (
            <StateBlock code="LIST_ERROR" center title={copy.error.title} body={copy.error.body} onRetry={() => void list.refetch()} />
          ) : list.isPending ? (
            <div className={styles.grid} aria-busy="true">{Array.from({ length: 6 }).map((_, i) => <ContentCardSkeleton key={i} />)}</div>
          ) : !data || data.items.length === 0 ? (
            <StateBlock code="EMPTY" center title={copy.empty.title} body={copy.empty.body} actions={<Button variant="secondary" size="sm" onClick={() => setSp(serializeCatalogParams(DEFAULT_CATALOG_PARAMS))}>{copy.empty.action}</Button>} />
          ) : (
            <>
              <div className={styles.grid} aria-busy={list.isFetching} data-fetching={list.isFetching || undefined}>
                {data.items.map((c) => <ContentCard key={c.lectureCode} course={c} showLike={isAuthed} onLike={(course, liked) => like.mutate({ course, liked })} />)}
              </div>
              <Pagination page={params.page} total={data.total} size={data.size || CATALOG_PAGE_SIZE} onChange={(p) => update({ page: p }, false)} label={copy.title} />
            </>
          )}
          <p className={styles.help}><Icon name="info" size={14} />{copy.help}</p>
        </div>
      </div>
    </div>
  );
}
