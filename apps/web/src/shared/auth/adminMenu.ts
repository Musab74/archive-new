/**
 * Admin console menu — the structure of the previous PHP admin (hrd_manager/include/include_top.php +
 * include_submenu.php): TOP sections (회원 관리 · 수강 관리 · 독려 관리 · 컨텐츠관리 · 아카이브 · 커뮤니티관리 · 사이트관리 · Ruby · 모니터링)
 * and each section's menus in the LEFT column. Every old menu entry is present: items that are rebuilt in this console
 * point at their new route; the rest carry `legacy` (the PHP page) and open at /admin/legacy/<slug>, which links to the
 * existing admin page until the screen is ported.
 *
 * Visibility follows DeptStructure grants like the API AdminGuard: dept 'A' sees everything; otherwise an item is visible
 * when its sub-grant code (e.g. 'A1') is in subGrants or its top letter is in topGrants. A group with `dept` is shown only
 * to those departments (old site: 실시간 강의 for 첨삭강사 C). A group's `key` is unique; its `letter` is the grant letter.
 */
import type { IconName } from '../ui/Icon';
import { tr } from '../i18n/adminLang';

export interface AdminGrantSource { dept: string; topGrants: string[]; subGrants: string[] }
export interface AdminMenuItem { label: string; to: string; grant: string; end?: boolean; icon?: IconName; /** PHP page under /hrd_manager/ when not yet rebuilt. */ legacy?: string }
export interface AdminMenuGroup { key: string; letter: string; label: string; items: AdminMenuItem[]; icon?: IconName; /** Only these departments see the group (grants ignored). */ dept?: string[] }

export const GRANT_LABELS: Record<string, string> = {
  A: tr('회원관리', 'Members'), B: tr('수강관리', 'Learning'), C: tr('독려관리', 'Nudges'), D: tr('컨텐츠관리', 'Content'), E: tr('아카이브', 'Archive'), F: tr('커뮤니티', 'Community'), G: tr('사이트관리', 'Site'),
};

/** Full menu catalogue (what dept 'A' sees). `grant` is the sub-menu code the API checks for the item's endpoints. */
export const ADMIN_MENU: AdminMenuGroup[] = [
  { key: 'members', letter: 'A', label: tr('회원 관리', 'Members'), icon: 'users', items: [
    { label: tr('사업주 관리', 'Companies'), to: '/admin/companies', grant: 'A1', icon: 'building' },
    { label: tr('수강생 관리', 'Learners'), to: '/admin/members', grant: 'A2', icon: 'users' },
    { label: tr('수강 등록', 'Enrol learners'), to: '/admin/enrollments/new', grant: 'A3', icon: 'edit' },
    { label: tr('엑셀 일괄 수강등록', 'Bulk enrolment (Excel)'), to: '/admin/enrollments/import', grant: 'A3', icon: 'download' },
    { label: tr('탈퇴회원 관리', 'Withdrawn members'), to: '/admin/members/withdrawn', grant: 'A4', icon: 'user' },
    { label: tr('관리자/영업자/첨삭강사 카테고리', 'Staff categories'), to: '/admin/departments', grant: 'A5', icon: 'folders' },
    { label: tr('관리자 리스트', 'Administrators'), to: '/admin/staff-list/A', grant: 'A6', icon: 'user-cog' },
    { label: tr('영업자 리스트', 'Sales staff'), to: '/admin/staff-list/B', grant: 'A7', icon: 'briefcase' },
    { label: tr('첨삭강사 리스트', 'Tutors'), to: '/admin/staff-list/C', grant: 'A8', icon: 'graduation' },
    { label: tr('개인정보 열람내역', 'Personal-data access log'), to: '/admin/privacy-log', grant: 'A9', icon: 'eye' },
  ] },
  { key: 'learning', letter: 'B', label: tr('수강 관리', 'Learning'), icon: 'book', items: [
    { label: tr('학습관리', 'Enrollments'), to: '/admin/studies', grant: 'B5', icon: 'book' },
    { label: tr('학습내역관리', 'Study history'), to: '/admin/learning/history', grant: 'B5', icon: 'checklist' },
    { label: tr('수강마감', 'Close enrollments'), to: '/admin/learning/closings', grant: 'B6', icon: 'flag' },
    { label: tr('IP모니터링', 'IP monitoring'), to: '/admin/learning/ip-monitor', grant: 'B1', icon: 'monitor' },
    { label: tr('본인인증 모니터링', 'Identity-check monitoring'), to: '/admin/learning/identity-checks', grant: 'B2', icon: 'shield' },
    { label: tr('일자별 학습시간 관리', 'Daily study time'), to: '/admin/monitoring/daily', grant: 'B3', icon: 'calendar-clock' },
    { label: tr('리포트 부정훈련', 'Misconduct report'), to: '/admin/learning/negative-training', grant: 'B4', icon: 'file-warning' },
    { label: tr('AI 로그·로드맵 분석', 'AI log · roadmap analysis'), to: '/admin/learning/ai-analysis', grant: 'B9', icon: 'brain' },
    { label: tr('과정 이수데이터 관리', 'Completion data'), to: '/admin/learning/completion-data', grant: 'B7', icon: 'chart' },
    { label: tr('과목별 이수증', 'Certificates by course'), to: '/admin/learning/subject-certificates', grant: 'B8', icon: 'award' },
    { label: tr('수료증/이수증 테스트', 'Certificate test'), to: '/admin/learning/certificate-test', grant: 'B8', icon: 'award' },
  ] },
  { key: 'live', letter: 'L', label: tr('실시간 강의', 'Live classes'), icon: 'video', dept: ['C'], items: [
    { label: tr('실시간 강의 관리', 'Live class management'), to: '/admin/live-class', grant: 'L1', icon: 'video' },
  ] },
  { key: 'nudge', letter: 'C', label: tr('독려 관리', 'Nudges'), icon: 'phone', items: [
    { label: tr('학습참여독려', 'Study nudges'), to: '/admin/nudge', grant: 'C1', icon: 'send' },
    { label: tr('예약문자발송', 'Scheduled SMS'), to: '/admin/nudge/reservations', grant: 'C1', icon: 'clock' },
    { label: tr('알림발송내역', 'Notification log'), to: '/admin/nudge/alarm-log', grant: 'C2', icon: 'bell' },
    { label: tr('메일발송내역(교육담당자)', 'Mail log (managers)'), to: '/admin/nudge/manager-mail-log', grant: 'C3', icon: 'mail' },
    { label: tr('메일발송내역(훈련생)', 'Mail log (learners)'), to: '/admin/nudge/mail-log', grant: 'C4', icon: 'mail' },
    { label: tr('문자/템플릿관리', 'SMS templates'), to: '/admin/nudge/templates', grant: 'C5', icon: 'file' },
  ] },
  { key: 'content', letter: 'D', label: tr('컨텐츠관리', 'Content'), icon: 'lightbulb', items: [
    { label: tr('과정카테고리 관리', 'Course categories'), to: '/admin/categories', grant: 'D1', icon: 'tags' },
    { label: tr('기초차시 관리', 'Base contents'), to: '/admin/contents', grant: 'D2', icon: 'monitor' },
    { label: tr('역량진단 문항관리', 'Assessment questions'), to: '/admin/archive-questions', grant: 'D3', icon: 'checklist' },
    { label: tr('역량진단관리', 'Assessments'), to: '/admin/ability-results', grant: 'D4', icon: 'target' },
    { label: tr('만족도조사', 'Satisfaction surveys'), to: '/admin/satisfaction-results', grant: 'D5', icon: 'star' },
    { label: tr('패키지컨텐츠관리', 'Package contents'), to: '/admin/courses?packageYN=Y', grant: 'D6', icon: 'layers' },
  ] },
  { key: 'archive', letter: 'E', label: tr('아카이브', 'Archive'), icon: 'library', items: [
    { label: tr('이러닝 컨텐츠 관리', 'E-learning contents'), to: '/admin/courses?ctype=X', grant: 'E1', icon: 'graduation' },
    { label: tr('마이크로닝 컨텐츠 관리', 'Micro-learning contents'), to: '/admin/courses?ctype=Z', grant: 'E2', icon: 'bolt' },
    { label: tr('숏폼 컨텐츠 관리', 'Short-form contents'), to: '/admin/courses?ctype=Y', grant: 'E3', icon: 'shorts' },
    { label: tr('실시간 강의실 관리', 'Live classrooms'), to: '/admin/live-courses', grant: 'E1', icon: 'video' },
    { label: tr('컨텐츠 키워드 관리', 'Content keywords'), to: '/admin/content-keywords', grant: 'E4', icon: 'tags' },
    { label: tr('PICK/TOP/NEW 컨텐츠 관리', 'PICK / TOP / NEW'), to: '/admin/lists', grant: 'E5', icon: 'ordered' },
    { label: tr('관심강의 관리', 'Favourites'), to: '/admin/course-likes', grant: 'E6', icon: 'heart' },
    { label: tr('과정조회 관리', 'Course views'), to: '/admin/course-views', grant: 'E6', icon: 'eye' },
    { label: tr('수강신청관리', 'Enrolment requests'), to: '/admin/inquiries', grant: 'E7', icon: 'inbox' },
    { label: tr('실시간 컨텐츠 관리', 'Live contents'), to: '/admin/live-courses?view=contents', grant: 'E8', icon: 'broadcast' }, // old page was an empty file; shows the live (ctype R) course list
  ] },
  { key: 'community', letter: 'F', label: tr('커뮤니티관리', 'Community'), icon: 'message', items: [
    { label: tr('공지사항', 'Notices'), to: '/admin/notices', grant: 'F1', icon: 'megaphone' },
    { label: tr('자주 묻는 질문', 'FAQ'), to: '/admin/faqs', grant: 'F2', icon: 'info' },
    { label: tr('1:1 상담 / 학습상담', '1:1 questions'), to: '/admin/counsel', grant: 'F3', icon: 'headset' },
    { label: tr('수강후기', 'Reviews'), to: '/admin/reviews', grant: 'F4', icon: 'star' },
    { label: tr('아카이빙', 'Archiving'), to: '/admin/archiving', grant: 'F5', icon: 'folders' },
    { label: tr('부정제보', 'Misconduct reports'), to: '/admin/cheating', grant: 'F6', icon: 'shield' },
    { label: tr('학습자료실', 'Learning resources'), to: '/admin/edudata', grant: 'F7', icon: 'download' },
    { label: tr('이벤트관리', 'Events'), to: '/admin/lecture-events', grant: 'F7', icon: 'calendar' },
  ] },
  { key: 'site', letter: 'G', label: tr('사이트관리', 'Site'), icon: 'settings', items: [
    { label: tr('사이트 정보 관리', 'Site information'), to: '/admin/site-info', grant: 'G1', icon: 'file' },
    { label: tr('팝업 관리', 'Pop-ups'), to: '/admin/popups', grant: 'G2', icon: 'grid' },
    { label: tr('백업 목록', 'Backups'), to: '/admin/backups', grant: 'G3', icon: 'download' },
    { label: tr('접속통계 관리', 'Visit statistics'), to: '/admin/visit-stats', grant: 'G3', icon: 'chart' },
    { label: tr('운영자·권한', 'Operators · permissions'), to: '/admin/staff', grant: 'G1', icon: 'user-cog' },
    { label: tr('웹사이트 디자인', 'Website design'), to: '/admin/design', grant: 'G1', icon: 'palette' },
  ] },
  { key: 'ruby', letter: 'F', label: tr('Ruby 관리', 'Ruby (AI)'), icon: 'bot', items: [
    { label: tr('Ruby FAQ 관리', 'Ruby FAQ'), to: '/admin/ruby/faq', grant: 'F2', icon: 'info' },
    { label: tr('Ruby 지식베이스', 'Ruby knowledge base'), to: '/admin/ruby/kb', grant: 'F2', icon: 'library' },
    { label: tr('Ruby 프롬프트', 'Ruby prompts'), to: '/admin/ruby/prompts', grant: 'F2', icon: 'wand' },
    { label: tr('Ruby 런타임 설정', 'Ruby runtime'), to: '/admin/ruby/runtime', grant: 'F2', icon: 'sliders' },
    { label: tr('Ruby 지원티켓', 'Ruby support tickets'), to: '/admin/ruby/tickets', grant: 'F2', icon: 'inbox' },
    { label: tr('Ruby 임베딩 작업', 'Ruby embeddings'), to: '/admin/ruby/embeddings', grant: 'F2', icon: 'sparkles' },
  ] },
  { key: 'monitoring', letter: 'B', label: tr('모니터링', 'Monitoring'), icon: 'activity', items: [
    { label: tr('이상 데이터', 'Anomalies'), to: '/admin/monitoring/abnormal', grant: 'B1', icon: 'file-warning' },
    { label: tr('중복 학습', 'Overlapping study'), to: '/admin/monitoring/overlap', grant: 'B1', icon: 'copy' },
    { label: tr('EMON 전송함', 'EMON outbox'), to: '/admin/emon', grant: 'B1', icon: 'send' },
    { label: tr('HLS 변환 (영상 경량화)', 'HLS conversion'), to: '/admin/hls', grant: 'D2', icon: 'play' },
    { label: tr('IP 모니터링', 'IP monitoring'), to: '/admin/monitoring/ip', grant: 'B1', icon: 'activity' },
    { label: tr('실시간 트래픽 (학습자별)', 'Live traffic by learner'), to: '/admin/monitoring/traffic', grant: 'B1', icon: 'activity' },
  ] },
];

/** Base URL of the previous PHP admin (legacy items open there in a new tab). */
export const LEGACY_ADMIN_BASE = (import.meta.env.VITE_LEGACY_ADMIN_URL ?? 'https://hrdeedu.co.kr/hrd_manager').replace(/\/+$/, '');
export const legacyUrl = (file: string) => `${LEGACY_ADMIN_BASE}/${file}`;

/** True when the staff member may open endpoints guarded by `grant` (e.g. 'A1'). */
export function hasGrant(src: AdminGrantSource | null | undefined, grant: string): boolean {
  if (!src) return false;
  if (src.dept === 'A') return true;
  return src.subGrants.includes(grant) || src.topGrants.includes(grant.charAt(0));
}

/** Menu groups filtered by grants / department; groups with no visible item are dropped. */
export function buildAdminMenu(src: AdminGrantSource | null | undefined, catalogue: AdminMenuGroup[] = ADMIN_MENU): AdminMenuGroup[] {
  if (!src) return [];
  return catalogue
    .filter((g) => (g.dept ? g.dept.includes(src.dept) : true))
    .map((g) => ({ ...g, items: g.dept ? g.items : g.items.filter((it) => hasGrant(src, it.grant)) }))
    .filter((g) => g.items.length > 0);
}

const splitTo = (to: string): [string, string] => { const i = to.indexOf('?'); return i < 0 ? [to, ''] : [to.slice(0, i), to.slice(i)]; };

/**
 * The menu item that owns the location (longest matching path; among equal paths the one whose query matches `search`,
 * else the one without a query) with its group, or null (dashboard, unknown page).
 */
export function menuEntryForPath(pathname: string, catalogue: AdminMenuGroup[] = ADMIN_MENU, search = ''): { group: AdminMenuGroup; item: AdminMenuItem } | null {
  let best: { group: AdminMenuGroup; item: AdminMenuItem; score: number } | null = null;
  for (const g of catalogue) for (const it of g.items) {
    const [base, q] = splitTo(it.to);
    if (!(pathname === base || pathname.startsWith(`${base}/`))) continue;
    const score = base.length * 4 + (q ? (q === search ? 2 : -1) : 1);
    if (!best || score > best.score) best = { group: g, item: it, score };
  }
  return best ? { group: best.group, item: best.item } : null;
}

/** Grant code required for a pathname (longest matching menu `to`), or null for ungated pages like the dashboard. */
export function grantForPath(pathname: string, catalogue: AdminMenuGroup[] = ADMIN_MENU): string | null {
  return menuEntryForPath(pathname, catalogue)?.item.grant ?? null;
}
