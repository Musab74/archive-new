import { describe, expect, it } from 'vitest';
import { ADMIN_MENU, buildAdminMenu, grantForPath, hasGrant, menuEntryForPath } from '../shared/auth/adminMenu';

const deptA = { dept: 'A', topGrants: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], subGrants: ['A1', 'A2', 'B1', 'B2', 'C1', 'D1', 'E1', 'F1', 'G1'] };
const sales = { dept: 'B', topGrants: ['A', 'B'], subGrants: ['A1', 'B1'] };

describe('admin menu from grants', () => {
  it('dept A sees the whole catalogue', () => {
    const menu = buildAdminMenu(deptA);
    expect(menu.map((g) => g.key)).toEqual(['members', 'learning', 'nudge', 'content', 'archive', 'community', 'site', 'ruby', 'monitoring']);
    expect(menu.reduce((n, g) => n + g.items.length, 0)).toBe(ADMIN_MENU.filter((g) => !g.dept).reduce((n, g) => n + g.items.length, 0)); // dept-restricted groups (실시간 강의, dept C) are not part of A's catalogue
  });

  it('dept A passes even without explicit sub grants', () => {
    expect(hasGrant({ dept: 'A', topGrants: [], subGrants: [] }, 'G1')).toBe(true);
  });

  it('filters by sub-grant code and drops empty groups', () => {
    const menu = buildAdminMenu(sales);
    expect(menu.map((g) => g.key)).toEqual(['members', 'learning', 'monitoring']);
    expect(menu.find((g) => g.key === 'monitoring')!.items.map((i) => i.to)).toContain('/admin/emon');
    expect(menu.some((g) => g.letter === 'G')).toBe(false);
  });

  it('a top-level letter grants every sub item of that letter', () => {
    const menu = buildAdminMenu({ dept: 'C', topGrants: ['F'], subGrants: [] });
    expect(menu.map((g) => g.key)).toEqual(['live', 'archive', 'community', 'ruby']); // 실시간 강의 is shown to dept C regardless of grants; 아카이브 holds the F1 수강신청관리 item
    expect(hasGrant({ dept: 'C', topGrants: ['F'], subGrants: [] }, 'F1')).toBe(true);
    expect(hasGrant({ dept: 'C', topGrants: ['F'], subGrants: [] }, 'A1')).toBe(false);
  });

  it('returns nothing for a missing session', () => {
    expect(buildAdminMenu(null)).toEqual([]);
    expect(hasGrant(undefined, 'A1')).toBe(false);
  });

  it('maps paths to the grant their endpoints need', () => {
    expect(grantForPath('/admin/members/user01')).toBe('A1');
    expect(grantForPath('/admin/companies/import')).toBe('A1');
    expect(grantForPath('/admin/legacy/lecture_reg')).toBe('A3');
    expect(menuEntryForPath('/admin/courses', ADMIN_MENU, '?ctype=Z')?.item.label).toBe('마이크로닝 컨텐츠 관리');
    expect(menuEntryForPath('/admin/courses/12', ADMIN_MENU, '')?.item.label).toBe('패키지컨텐츠관리');
    expect(grantForPath('/admin/design/tokens')).toBe('G1');
    expect(grantForPath('/admin/emon/preview/attend')).toBe('B1');
    expect(grantForPath('/admin')).toBeNull();
  });
});
