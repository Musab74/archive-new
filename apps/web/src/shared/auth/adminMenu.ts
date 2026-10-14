/**
 * Admin console menu built from DeptStructure grants (same rule as the API AdminGuard):
 * dept 'A' sees everything; otherwise an item is visible when its sub-grant code (e.g. 'A1') is in subGrants
 * or its top letter is in topGrants. Letters: A=회원관리 B=수강관리 D=컨텐츠관리 E=아카이브 F=커뮤니티 G=사이트관리.
 */
import type { IconName } from '../ui/Icon';

export interface AdminGrantSource { dept: string; topGrants: string[]; subGrants: string[] }
export interface AdminMenuItem { label: string; to: string; grant: string; end?: boolean; icon?: IconName }
export interface AdminMenuGroup { letter: string; label: string; items: AdminMenuItem[]; icon?: IconName }

export const GRANT_LABELS: Record<string, string> = { A: '회원관리', B: '수강관리', C: '첨삭관리', D: '컨텐츠관리', E: '아카이브', F: '커뮤니티', G: '사이트관리' };

/** Full menu catalogue (what dept 'A' sees). `grant` is the sub-menu code the API checks for the item's endpoints. */
export const ADMIN_MENU: AdminMenuGroup[] = [
  { letter: 'A', label: GRANT_LABELS.A!, icon: 'users', items: [
    { label: '회원 목록', to: '/admin/members', grant: 'A1', icon: 'users' },
  ] },
  { letter: 'B', label: GRANT_LABELS.B!, icon: 'graduation', items: [
    { label: '수강 목록', to: '/admin/studies', grant: 'B1', icon: 'book' },
    { label: '일별 학습시간', to: '/admin/monitoring/daily', grant: 'B1', icon: 'calendar-clock' },
    { label: '중복 학습', to: '/admin/monitoring/overlap', grant: 'B1', icon: 'copy' },
    { label: '이상 데이터', to: '/admin/monitoring/abnormal', grant: 'B1', icon: 'file-warning' },
    { label: 'EMON 전송함', to: '/admin/emon', grant: 'B1', icon: 'send' },
  ] },
  { letter: 'D', label: GRANT_LABELS.D!, icon: 'library', items: [
    { label: '과정', to: '/admin/courses', grant: 'D1', icon: 'graduation' },
    { label: '기초 차시', to: '/admin/contents', grant: 'D1', icon: 'monitor' },
    { label: '분류·키워드', to: '/admin/categories', grant: 'D1', icon: 'tags' },
    { label: '메인 큐레이션', to: '/admin/lists', grant: 'D1', icon: 'ordered' },
  ] },
  { letter: 'F', label: GRANT_LABELS.F!, icon: 'message', items: [
    { label: '공지사항', to: '/admin/notices', grant: 'F1', icon: 'megaphone' },
    { label: 'FAQ', to: '/admin/faqs', grant: 'F1', icon: 'info' },
    { label: '기업교육 문의', to: '/admin/inquiries', grant: 'F1', icon: 'building' },
    { label: '1:1 문의', to: '/admin/counsel', grant: 'F1', icon: 'inbox' },
    { label: '부정수강 제보', to: '/admin/cheating', grant: 'F1', icon: 'shield' },
  ] },
  { letter: 'G', label: GRANT_LABELS.G!, icon: 'settings', items: [
    { label: '사이트 정보', to: '/admin/site-info', grant: 'G1', icon: 'file' },
    { label: '운영자·권한', to: '/admin/staff', grant: 'G1', icon: 'user-cog' },
    { label: '웹사이트 디자인', to: '/admin/design', grant: 'G1', icon: 'palette' },
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
