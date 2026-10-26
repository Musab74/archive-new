import type { AiDirection, CatalogQuery } from '@ainex/contracts';
import type { Category } from '../../shared/api/schemas';
import { aiZone, competencies, contentType, type CompetencyKey } from '../../shared/strings/ko';

export type CatalogSort = CatalogQuery['sort'];
export type CatalogType = '' | 'elearning' | 'micro' | 'short';

export interface CatalogParams {
  q: string;
  competency: CompetencyKey | '';
  field: string;
  type: CatalogType;
  sort: CatalogSort;
  page: number;
}

export const CATALOG_PAGE_SIZE = 12;
export const DEFAULT_CATALOG_PARAMS: CatalogParams = { q: '', competency: '', field: '', type: '', sort: 'latest', page: 1 };

/** ctype letters as the PHP site uses them: X 이러닝, Z 마이크로러닝, Y 숏폼 (archive main nav contents_list.html?ctype=…). */
const TYPE_TO_CTYPE: Record<Exclude<CatalogType, ''>, 'X' | 'Y' | 'Z'> = { elearning: 'X', micro: 'Z', short: 'Y' };
const CTYPE_TO_TYPE: Record<'X' | 'Y' | 'Z', Exclude<CatalogType, ''>> = { X: 'elearning', Z: 'micro', Y: 'short' };
const SORTS: CatalogSort[] = ['latest', 'popular', 'rating', 'title', 'relevance', 'liked'];
const COMPETENCIES = Object.keys(competencies) as CompetencyKey[];

export const typeToCtype = (t: CatalogType): 'X' | 'Y' | 'Z' | undefined => (t ? TYPE_TO_CTYPE[t] : undefined);

/** 콘텐츠 유형 filter options; each label is the ctype letter's label, so 마이크로러닝 filters Z and 숏폼 filters Y. */
export const CATALOG_TYPE_OPTIONS: { value: Exclude<CatalogType, ''>; label: string }[] = (['elearning', 'micro', 'short'] as const)
  .map((t) => ({ value: t, label: contentType[TYPE_TO_CTYPE[t]] ?? t }));
export const ctypeToType = (c: string): CatalogType => (c === 'X' || c === 'Y' || c === 'Z' ? CTYPE_TO_TYPE[c] : '');

/** URLSearchParams → typed, validated params (unknown values fall back to defaults). */
export function parseCatalogParams(sp: URLSearchParams): CatalogParams {
  const q = (sp.get('q') ?? '').trim().slice(0, 100);
  const comp = sp.get('competency') ?? '';
  const competency = (COMPETENCIES as string[]).includes(comp) ? (comp as CompetencyKey) : '';
  const field = competency ? (sp.get('field') ?? '').trim().slice(0, 100) : '';
  const rawType = sp.get('type') ?? '';
  const type: CatalogType = rawType in TYPE_TO_CTYPE ? (rawType as CatalogType) : (rawType === 'X' || rawType === 'Y' || rawType === 'Z') ? CTYPE_TO_TYPE[rawType] : '';
  const rawSort = sp.get('sort') ?? '';
  // 검색 관련도순 only exists while there is a search text (AR-03)
  const sort = (SORTS as string[]).includes(rawSort) && !(rawSort === 'relevance' && !q) ? (rawSort as CatalogSort) : 'latest';
  const pageNum = Number.parseInt(sp.get('page') ?? '1', 10);
  const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.min(pageNum, 9999) : 1;
  return { q, competency, field, type, sort, page };
}

/** Typed params → URLSearchParams with defaults omitted (keeps URLs short and shareable). */
export function serializeCatalogParams(p: CatalogParams): URLSearchParams {
  const sp = new URLSearchParams();
  if (p.q) sp.set('q', p.q);
  if (p.competency) sp.set('competency', p.competency);
  if (p.competency && p.field) sp.set('field', p.field);
  if (p.type) sp.set('type', p.type);
  if (p.sort !== 'latest') sp.set('sort', p.sort);
  if (p.page > 1) sp.set('page', String(p.page));
  return sp;
}

/** Number of active filters shown on the mobile trigger. */
export const activeFilterCount = (p: CatalogParams): number => [p.competency, p.field, p.type].filter(Boolean).length;

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
/** '리더십역량' (site label) and '리더십' (CourseCategory name on the old site) name the same group. */
const sameGroup = (a: string, b: string) => { const x = norm(a); const y = norm(b); return !!x && !!y && (x === y || x.startsWith(y) || y.startsWith(x)); };

/** The Deep-1 CourseCategory of a competency ('리더십역량' matches the old site's '리더십'); AI ZONE has none. */
export function topCategoryOf(categories: Category[], competency: CompetencyKey | ''): Category | undefined {
  if (!competency || competency === 'ai') return undefined;
  return categories.find((c) => !c.parentId && sameGroup(c.name, competencies[competency].label));
}

/** AI ZONE direction title (aiZone.categories) → API `ai` value; unknown / empty → all AI contents. */
export function aiDirectionOf(field: string): AiDirection {
  const hit = aiZone.categories.find((c) => norm(c.title) === norm(field));
  return (hit?.key as AiDirection | undefined) ?? 'all';
}

/**
 * Typed params → GET /catalog/courses query. competency → category1 by CourseCategory name (field → its child category2, or an
 * exact keyword label the API resolves to Keyword2/3/4 ids); AI ZONE has no category on the old site, so it maps to `ai`
 * (the old AI ZONE keyword condition, one of the four directions when a field is chosen).
 */
export function toApiQuery(p: CatalogParams, categories: Category[] = []): Partial<CatalogQuery> {
  const query: Partial<CatalogQuery> = { page: p.page, size: CATALOG_PAGE_SIZE, sort: p.sort };
  if (p.q) query.q = p.q;
  const ctype = typeToCtype(p.type);
  if (ctype) query.ctype = ctype;
  if (p.competency === 'ai') {
    query.ai = p.field ? aiDirectionOf(p.field) : 'all';
  } else if (p.competency) {
    const label = competencies[p.competency].label;
    const top = topCategoryOf(categories, p.competency);
    if (top) query.category1 = top.id;
    else query.keyword = label;
    if (p.field) {
      const sub = categories.find((c) => (top ? c.parentId === top.id : true) && norm(c.name) === norm(p.field));
      if (sub) query.category2 = sub.id;
      else query.keyword = p.field;
    }
  }
  return query;
}
