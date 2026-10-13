import type { CatalogQuery } from '@ainex/contracts';
import type { Category } from '../../shared/api/schemas';
import { competencies, type CompetencyKey } from '../../shared/strings/ko';

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

const TYPE_TO_CTYPE: Record<Exclude<CatalogType, ''>, 'X' | 'Y' | 'Z'> = { elearning: 'X', micro: 'Y', short: 'Z' };
const CTYPE_TO_TYPE: Record<'X' | 'Y' | 'Z', Exclude<CatalogType, ''>> = { X: 'elearning', Y: 'micro', Z: 'short' };
const SORTS: CatalogSort[] = ['latest', 'popular', 'rating', 'title'];
const COMPETENCIES = Object.keys(competencies) as CompetencyKey[];

export const typeToCtype = (t: CatalogType): 'X' | 'Y' | 'Z' | undefined => (t ? TYPE_TO_CTYPE[t] : undefined);
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
  const sort = (SORTS as string[]).includes(rawSort) ? (rawSort as CatalogSort) : 'latest';
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

/** Finds category ids by name from GET /catalog/categories; competency → category1, field → category2 (or keyword). */
export function toApiQuery(p: CatalogParams, categories: Category[] = []): Partial<CatalogQuery> {
  const query: Partial<CatalogQuery> = { page: p.page, size: CATALOG_PAGE_SIZE, sort: p.sort };
  if (p.q) query.q = p.q;
  const ctype = typeToCtype(p.type);
  if (ctype) query.ctype = ctype;
  if (p.competency) {
    const label = competencies[p.competency].label;
    const top = categories.find((c) => !c.parentId && norm(c.name) === norm(label));
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
