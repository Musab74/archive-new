/**
 * Admin console menu built from DeptStructure grants (same rule as the API AdminGuard):
 * dept 'A' sees everything; otherwise an item is visible when its sub-grant code (e.g. 'A1') is in subGrants
 * or its top letter is in topGrants. Letters: A=회원관리 B=수강관리 D=컨텐츠관리 E=아카이브 F=커뮤니티 G=사이트관리.
 */
import type { IconName } from '../ui/Icon';
import { tr } from '../i18n/adminLang';

export interface AdminGrantSource { dept: string; topGrants: string[]; subGrants: string[] }
export interface AdminMenuItem { label: string; to: string; grant: string; end?: boolean; icon?: IconName }
export interface AdminMenuGroup { letter: string; label: string; items: AdminMenuItem[]; icon?: IconName }

export const GRANT_LABELS: Record<string, string> = {
  A: tr('회원관리', 'Members'), B: tr('수강관리', 'Learning'), C: tr('첨삭관리', 'Reviews'), D: tr('컨텐츠관리', 'Content'), E: tr('아카이브', 'Archive'), F: tr('커뮤니티', 'Community'), G: tr('사이트관리', 'Site'),
};

/** Full menu catalogue (what dept 'A' sees). `grant` is the sub-menu code the API checks for the item's endpoints. */
export const ADMIN_MENU: AdminMenuGroup[] = [
  { letter: 'A', label: GRANT_LABELS.A!, icon: 'users', items: [
    { label: tr('회원 목록', 'Members'), to: '/admin/members', grant: 'A1', icon: 'users' },
    { label: tr('사업주 관리', 'Companies'), to: '/admin/companies', grant: 'A1', icon: 'building' },
  ] },
  { letter: 'B', label: GRANT_LABELS.B!, icon: 'graduation', items: [
    { label: tr('수강 목록', 'Enrollments'), to: '/admin/studies', grant: 'B1', icon: 'book' },
    { label: tr('일별 학습시간', 'Daily study time'), to: '/admin/monitoring/daily', grant: 'B1', icon: 'calendar-clock' },
    { label: tr('중복 학습', 'Overlapping study'), to: '/admin/monitoring/overlap', grant: 'B1', icon: 'copy' },
    { label: tr('이상 데이터', 'Anomalies'), to: '/admin/monitoring/abnormal', grant: 'B1', icon: 'file-warning' },
    { label: tr('EMON 전송함', 'EMON outbox'), to: '/admin/emon', grant: 'B1', icon: 'send' },
  ] },
  { letter: 'D', label: GRANT_LABELS.D!, icon: 'library', items: [
    { label: tr('과정', 'Courses'), to: '/admin/courses', grant: 'D1', icon: 'graduation' },
    { label: tr('기초 차시', 'Base contents'), to: '/admin/contents', grant: 'D1', icon: 'monitor' },
    { label: tr('분류·키워드', 'Categories · keywords'), to: '/admin/categories', grant: 'D1', icon: 'tags' },
    { label: tr('메인 큐레이션', 'Home curation'), to: '/admin/lists', grant: 'D1', icon: 'ordered' },
  ] },
  { letter: 'F', label: GRANT_LABELS.F!, icon: 'message', items: [
    { label: tr('공지사항', 'Notices'), to: '/admin/notices', grant: 'F1', icon: 'megaphone' },
    { label: 'FAQ', to: '/admin/faqs', grant: 'F1', icon: 'info' },
    { label: tr('기업교육 문의', 'Business inquiries'), to: '/admin/inquiries', grant: 'F1', icon: 'building' },
    { label: tr('1:1 문의', '1:1 questions'), to: '/admin/counsel', grant: 'F1', icon: 'inbox' },
    { label: tr('부정수강 제보', 'Misconduct reports'), to: '/admin/cheating', grant: 'F1', icon: 'shield' },
  ] },
  { letter: 'G', label: GRANT_LABELS.G!, icon: 'settings', items: [
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

/** Grant code required for a pathname (longest matching menu `to`), or null for ungated pages like the dashboard. */
export function grantForPath(pathname: string, catalogue: AdminMenuGroup[] = ADMIN_MENU): string | null {
  let best: AdminMenuItem | null = null;
  for (const g of catalogue) for (const it of g.items) {
    if ((pathname === it.to || pathname.startsWith(`${it.to}/`)) && (!best || it.to.length > best.to.length)) best = it;
  }
  return best?.grant ?? null;
}
