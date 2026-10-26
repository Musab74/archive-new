import { describe, expect, it } from 'vitest';
import { activeFilterCount, parseCatalogParams, serializeCatalogParams, toApiQuery, topCategoryOf, aiDirectionOf, CATALOG_TYPE_OPTIONS, DEFAULT_CATALOG_PARAMS } from '../features/catalog/catalogParams';
import { contentType } from '../shared/strings/ko';

describe('catalog URL params', () => {
  it('returns defaults for an empty query', () => {
    expect(parseCatalogParams(new URLSearchParams(''))).toEqual(DEFAULT_CATALOG_PARAMS);
  });

  it('parses valid values', () => {
    const p = parseCatalogParams(new URLSearchParams('q=프롬프트&competency=job&field=IT·SW&type=micro&sort=popular&page=3'));
    expect(p).toEqual({ q: '프롬프트', competency: 'job', field: 'IT·SW', type: 'micro', sort: 'popular', page: 3 });
    expect(activeFilterCount(p)).toBe(3);
  });

  it('accepts raw ctype letters and rejects unknown values', () => {
    expect(parseCatalogParams(new URLSearchParams('type=X')).type).toBe('elearning');
    expect(parseCatalogParams(new URLSearchParams('type=video')).type).toBe('');
    expect(parseCatalogParams(new URLSearchParams('competency=foo&field=x')).competency).toBe('');
    expect(parseCatalogParams(new URLSearchParams('competency=foo&field=x')).field).toBe('');
    expect(parseCatalogParams(new URLSearchParams('sort=random')).sort).toBe('latest');
    expect(parseCatalogParams(new URLSearchParams('page=0')).page).toBe(1);
    expect(parseCatalogParams(new URLSearchParams('page=abc')).page).toBe(1);
  });

  it('serializes without defaults and round-trips', () => {
    const p = { q: 'ai', competency: 'ai' as const, field: 'AI 입문·기초', type: 'short' as const, sort: 'rating' as const, page: 2 };
    const sp = serializeCatalogParams(p);
    expect(sp.toString()).toBe('q=ai&competency=ai&field=AI+%EC%9E%85%EB%AC%B8%C2%B7%EA%B8%B0%EC%B4%88&type=short&sort=rating&page=2');
    expect(parseCatalogParams(sp)).toEqual(p);
    expect(serializeCatalogParams(DEFAULT_CATALOG_PARAMS).toString()).toBe('');
  });

  it('maps to the API query using category ids when known', () => {
    const cats = [{ id: 10, name: '직무역량', parentId: null }, { id: 11, name: 'IT·SW', parentId: 10 }, { id: 20, name: '공통역량', parentId: null }];
    const q = toApiQuery({ q: '보고서', competency: 'job', field: 'IT·SW', type: 'elearning', sort: 'latest', page: 2 }, cats);
    expect(q).toEqual({ page: 2, size: 12, sort: 'latest', q: '보고서', ctype: 'X', category1: 10, category2: 11 });
    const fallback = toApiQuery({ ...DEFAULT_CATALOG_PARAMS, competency: 'leadership', field: '팀 리더십' }, cats);
    expect(fallback.category1).toBeUndefined();
    expect(fallback.keyword).toBe('팀 리더십');
  });

  it('uses the PHP ctype letters: 마이크로러닝 = Z, 숏폼 = Y', () => {
    expect(toApiQuery({ ...DEFAULT_CATALOG_PARAMS, type: 'micro' }).ctype).toBe('Z');
    expect(toApiQuery({ ...DEFAULT_CATALOG_PARAMS, type: 'short' }).ctype).toBe('Y');
    expect(parseCatalogParams(new URLSearchParams('type=Z')).type).toBe('micro');
    expect(parseCatalogParams(new URLSearchParams('type=Y')).type).toBe('short');
  });

  it('labels each 콘텐츠 유형 filter option with its own ctype (the 숏폼 pill used to filter Z 마이크로러닝)', () => {
    expect(CATALOG_TYPE_OPTIONS).toEqual([{ value: 'elearning', label: '이러닝' }, { value: 'micro', label: '마이크로러닝' }, { value: 'short', label: '숏폼' }]);
    for (const o of CATALOG_TYPE_OPTIONS) expect(contentType[toApiQuery({ ...DEFAULT_CATALOG_PARAMS, type: o.value }).ctype!]).toBe(o.label);
  });

  it('keeps 검색 관련도순 only with a search text and accepts 찜한 콘텐츠순', () => {
    expect(parseCatalogParams(new URLSearchParams('sort=relevance')).sort).toBe('latest');
    expect(parseCatalogParams(new URLSearchParams('q=AI&sort=relevance')).sort).toBe('relevance');
    expect(parseCatalogParams(new URLSearchParams('sort=liked')).sort).toBe('liked');
  });

  it('matches the old category names (리더십 ↔ 리더십역량) and maps AI ZONE to the ai filter', () => {
    const cats = [{ id: 9, name: '리더십', parentId: null }, { id: 1, name: '공통역량', parentId: null }];
    expect(topCategoryOf(cats, 'leadership')?.id).toBe(9);
    expect(toApiQuery({ ...DEFAULT_CATALOG_PARAMS, competency: 'leadership' }, cats).category1).toBe(9);
    expect(toApiQuery({ ...DEFAULT_CATALOG_PARAMS, competency: 'ai' }, cats)).toMatchObject({ ai: 'all' });
    expect(toApiQuery({ ...DEFAULT_CATALOG_PARAMS, competency: 'ai', field: 'AI·AX 프로젝트' }, cats)).toMatchObject({ ai: 'project' });
    expect(aiDirectionOf('없는 방향')).toBe('all');
  });
});
