/**
 * Menu visibility exactly as the PHP admin decides it (hrd_manager/include/include_top.php top menu + include/include_submenu.php
 * left menu). The same checks apply to every department, A included:
 *  - a section shows when its letter is in DeptStructure.TopMenuGrant (회원 관리 additionally needs dept != 'C'),
 *  - 실시간 강의 only for dept C, Ruby for sub-grant F2 or dept A, 모니터링 (with the "test" badge) only for dept A,
 *  - each left-menu link only when its exact sub-grant code is in SubMenuGrant (the top letter alone is not enough),
 *    using the code the PHP checks, which differs from the API grant for a few links (기초차시 D2, 패키지 D6, 이러닝/마이크로닝/숏폼
 *    E1/E2/E3, PICK/TOP/NEW E5, 실시간 강의실 = any E1..E8). Only two links skip the sub-grant for dept A:
 *    AI 로그·로드맵 분석 (B9, or dept A with top B) and 수료증/이수증 테스트 (dept A only).
 * buildAdminMenu (shared/auth/adminMenu.ts) is wider than this (it mirrors the API AdminGuard, which lets dept A call every
 * endpoint); AdminShellParity and the dashboard shortcuts use this filter.
 */
import { ADMIN_MENU, type AdminGrantSource, type AdminMenuGroup, type AdminMenuItem } from '../../../shared/auth/adminMenu';

type Rule = (src: AdminGrantSource) => boolean;
const sub = (code: string): Rule => (src) => src.subGrants.includes(code);
const ARCHIVE_SUBS = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8'];

/** include_submenu.php checks keyed by the new route (`to`), where the PHP code is not the item's API grant. */
export const PHP_ITEM_RULES: Record<string, Rule> = {
  '/admin/learning/ai-analysis': (src) => src.subGrants.includes('B9') || (src.dept === 'A' && src.topGrants.includes('B')),
  '/admin/learning/certificate-test': (src) => src.dept === 'A',
  '/admin/contents': sub('D2'),
  '/admin/courses?packageYN=Y': sub('D6'),
  '/admin/courses?ctype=X': sub('E1'),
  '/admin/courses?ctype=Z': sub('E2'),
  '/admin/courses?ctype=Y': sub('E3'),
  '/admin/live-courses': (src) => ARCHIVE_SUBS.some((c) => src.subGrants.includes(c)), // $ArchiveHasAnySub
  '/admin/lists': sub('E5'),
};

/** include_top.php: whether the TOP section is shown. */
export function phpSectionVisible(src: AdminGrantSource, group: AdminMenuGroup): boolean {
  if (group.key === 'live') return src.dept === 'C';
  if (group.key === 'ruby') return src.subGrants.includes('F2') || src.dept === 'A';
  if (group.key === 'monitoring') return src.dept === 'A';
  if (group.key === 'members') return src.topGrants.includes('A') && src.dept !== 'C';
  return src.topGrants.includes(group.letter);
}

/** include_submenu.php: whether a left-menu link is shown inside a visible section. */
export function phpItemVisible(src: AdminGrantSource, group: AdminMenuGroup, item: AdminMenuItem): boolean {
  if (group.key === 'live' || group.key === 'ruby' || group.key === 'monitoring') return true; // the section check is the only gate
  const rule = PHP_ITEM_RULES[item.to];
  return rule ? rule(src) : src.subGrants.includes(item.grant);
}

/** include_top.php: 모니터링 carries <span class="hrde-test-badge">test</span>. */
export function phpSectionBadge(group: Pick<AdminMenuGroup, 'key'>): string | null {
  return group.key === 'monitoring' ? 'test' : null;
}

/** Menu groups with the PHP visibility; sections with no visible link are dropped (the PHP shows an empty section only via a direct URL). */
export function buildPhpParityMenu(src: AdminGrantSource | null | undefined, catalogue: AdminMenuGroup[] = ADMIN_MENU): AdminMenuGroup[] {
  if (!src) return [];
  return catalogue
    .filter((g) => phpSectionVisible(src, g))
    .map((g) => ({ ...g, items: g.items.filter((it) => phpItemVisible(src, g, it)) }))
    .filter((g) => g.items.length > 0);
}

/**
 * include_submenu.php case "G": 사이트 관리 also lists the Ruby pages ([AI] Ruby FAQ 관리 / 지식베이스 / 임베딩 재생성) for sub-grant F2
 * or dept A. They stay in the Ruby section of the catalogue (so breadcrumbs and the active section do not change); the shell only
 * appends these links to the 사이트관리 left column.
 */
export function phpSideExtras(src: AdminGrantSource | null | undefined, group: Pick<AdminMenuGroup, 'key'>): AdminMenuItem[] {
  if (!src || group.key !== 'site' || !(src.subGrants.includes('F2') || src.dept === 'A')) return [];
  return [
    { label: '[AI] Ruby FAQ 관리', to: '/admin/ruby/faq', grant: 'F2' },
    { label: '[AI] Ruby 지식베이스', to: '/admin/ruby/kb', grant: 'F2' },
    { label: '[AI] 임베딩 재생성', to: '/admin/ruby/embeddings', grant: 'F2' },
  ];
}
