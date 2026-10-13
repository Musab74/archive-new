import { describe, expect, it } from 'vitest';
import { activeFilterCount, parseCatalogParams, serializeCatalogParams, toApiQuery, DEFAULT_CATALOG_PARAMS } from '../features/catalog/catalogParams';

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
});
