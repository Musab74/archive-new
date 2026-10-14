/**
 * Admin console menu built from DeptStructure grants (same rule as the API AdminGuard):
 * dept 'A' sees everything; otherwise an item is visible when its sub-grant code (e.g. 'A1') is in subGrants
 * or its top letter is in topGrants. Letters: A=회원관리 B=수강관리 D=컨텐츠관리 E=아카이브 F=커뮤니티 G=사이트관리.
 *
 * Structure follows the previous PHP admin (hrd_manager): `ADMIN_MENU` groups are the TOP sections
 * (회원 관리 · 수강 관리 · 모니터링 · 컨텐츠관리 · 커뮤니티관리 · 사이트관리) and each group's items are the LEFT column.
 * A group's `key` is unique; its `letter` is the grant letter and may repeat (수강 관리 and 모니터링 both use B).
 */
import type { IconName } from '../ui/Icon';
import { tr } from '../i18n/adminLang';

export interface AdminGrantSource { dept: string; topGrants: string[]; subGrants: string[] }
export interface AdminMenuItem { label: string; to: string; grant: string; end?: boolean; icon?: IconName }
export interface AdminMenuGroup { key: string; letter: string; label: string; items: AdminMenuItem[]; icon?: IconName }

export const GRANT_LABELS: Record<string, string> = {
  A: tr('회원관리', 'Members'), B: tr('수강관리', 'Learning'), C: tr('첨삭관리', 'Reviews'), D: tr('컨텐츠관리', 'Content'), E: tr('아카이브', 'Archive'), F: tr('커뮤니티', 'Community'), G: tr('사이트관리', 'Site'),
};

/** Full menu catalogue (what dept 'A' sees). `grant` is the sub-menu code the API checks for the item's endpoints. */
export const ADMIN_MENU: AdminMenuGroup[] = [
  { key: 'members', letter: 'A', label: tr('회원 관리', 'Members'), icon: 'users', items: [
    { label: tr('사업주 관리', 'Companies'), to: '/admin/companies', grant: 'A1', icon: 'building' },
    { label: tr('수강생 관리', 'Learners'), to: '/admin/members', grant: 'A1', icon: 'users' },
  ] },
  { key: 'learning', letter: 'B', label: tr('수강 관리', 'Learning'), icon: 'graduation', items: [
    { label: tr('수강 목록', 'Enrollments'), to: '/admin/studies', grant: 'B1', icon: 'book' },
  ] },
  { key: 'monitoring', letter: 'B', label: tr('모니터링', 'Monitoring'), icon: 'monitor', items: [
    { label: tr('일별 학습시간', 'Daily study time'), to: '/admin/monitoring/daily', grant: 'B1', icon: 'calendar-clock' },
    { label: tr('중복 학습', 'Overlapping study'), to: '/admin/monitoring/overlap', grant: 'B1', icon: 'copy' },
    { label: tr('이상 데이터', 'Anomalies'), to: '/admin/monitoring/abnormal', grant: 'B1', icon: 'file-warning' },
    { label: tr('EMON 전송함', 'EMON outbox'), to: '/admin/emon', grant: 'B1', icon: 'send' },
  ] },
  { key: 'content', letter: 'D', label: tr('컨텐츠관리', 'Content'), icon: 'library', items: [
    { label: tr('과정', 'Courses'), to: '/admin/courses', grant: 'D1', icon: 'graduation' },
    { label: tr('기초 차시', 'Base contents'), to: '/admin/contents', grant: 'D1', icon: 'monitor' },
    { label: tr('분류·키워드', 'Categories · keywords'), to: '/admin/categories', grant: 'D1', icon: 'tags' },
    { label: tr('메인 큐레이션', 'Home curation'), to: '/admin/lists', grant: 'D1', icon: 'ordered' },
  ] },
  { key: 'community', letter: 'F', label: tr('커뮤니티관리', 'Community'), icon: 'message', items: [
    { label: tr('공지사항', 'Notices'), to: '/admin/notices', grant: 'F1', icon: 'megaphone' },
    { label: 'FAQ', to: '/admin/faqs', grant: 'F1', icon: 'info' },
    { label: tr('기업교육 문의', 'Business inquiries'), to: '/admin/inquiries', grant: 'F1', icon: 'building' },
    { label: tr('1:1 문의', '1:1 questions'), to: '/admin/counsel', grant: 'F1', icon: 'inbox' },
    { label: tr('부정수강 제보', 'Misconduct reports'), to: '/admin/cheating', grant: 'F1', icon: 'shield' },
  ] },
  { key: 'site', letter: 'G', label: tr('사이트관리', 'Site'), icon: 'settings', items: [
    { label: tr('사이트 정보', 'Site information'), to: '/admin/site-info', grant: 'G1', icon: 'file' },
    { label: tr('운영자·권한', 'Operators · permissions'), to: '/admin/staff', grant: 'G1', icon: 'user-cog' },
    { label: tr('웹사이트 디자인', 'Website design'), to: '/admin/design', grant: 'G1', icon: 'palette' },
  ] },
];

/** True when the staff member may open endpoints guarded by `grant` (e.g. 'A1'). */
export function hasGrant(src: AdminGrantSource | null | undefined, grant: string): boolean {
  if (!src) return false;
  if (src.dept === 'A') return true;
  return src.subGrants.includes(grant) || src.topGrants.includes(grant.charAt(0));
}

/** Menu groups filtered by grants; groups with no visible item are dropped. */
export function buildAdminMenu(src: AdminGrantSource | null | undefined, catalogue: AdminMenuGroup[] = ADMIN_MENU): AdminMenuGroup[] {
  return catalogue
    .map((g) => ({ ...g, items: g.items.filter((it) => hasGrant(src, it.grant)) }))
    .filter((g) => g.items.length > 0);
}

/** The menu item that owns `pathname` (longest matching `to`) with its group, or null (dashboard, unknown page). */
export function menuEntryForPath(pathname: string, catalogue: AdminMenuGroup[] = ADMIN_MENU): { group: AdminMenuGroup; item: AdminMenuItem } | null {
  let best: { group: AdminMenuGroup; item: AdminMenuItem } | null = null;
  for (const g of catalogue) for (const it of g.items) {
    if ((pathname === it.to || pathname.startsWith(`${it.to}/`)) && (!best || it.to.length > best.item.to.length)) best = { group: g, item: it };
  }
  return best;
}

/** Grant code required for a pathname (longest matching menu `to`), or null for ungated pages like the dashboard. */
export function grantForPath(pathname: string, catalogue: AdminMenuGroup[] = ADMIN_MENU): string | null {
  return menuEntryForPath(pathname, catalogue)?.item.grant ?? null;
}
