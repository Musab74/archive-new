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

const legacy = (file: string, slug?: string) => ({ to: `/admin/legacy/${slug ?? file.replace(/\.php.*$/, '')}`, legacy: file });

/** Full menu catalogue (what dept 'A' sees). `grant` is the sub-menu code the API checks for the item's endpoints. */
export const ADMIN_MENU: AdminMenuGroup[] = [
  { key: 'members', letter: 'A', label: tr('회원 관리', 'Members'), icon: 'users', items: [
    { label: tr('사업주 관리', 'Companies'), to: '/admin/companies', grant: 'A1', icon: 'building' },
    { label: tr('수강생 관리', 'Learners'), to: '/admin/members', grant: 'A1', icon: 'users' },
    { label: tr('수강 등록', 'Enrol learners'), to: '/admin/enrollments/new', grant: 'A3', icon: 'edit' },
    { label: tr('탈퇴회원 관리', 'Withdrawn members'), to: '/admin/members/withdrawn', grant: 'A4', icon: 'user' },
    { label: tr('관리자/영업자/첨삭강사 카테고리', 'Staff categories'), to: '/admin/departments', grant: 'A5', icon: 'folders' },
    { label: tr('관리자 리스트', 'Administrators'), to: '/admin/staff-list/A', grant: 'A6', icon: 'user-cog' },
    { label: tr('영업자 리스트', 'Sales staff'), to: '/admin/staff-list/B', grant: 'A7', icon: 'briefcase' },
    { label: tr('첨삭강사 리스트', 'Tutors'), to: '/admin/staff-list/C', grant: 'A8', icon: 'graduation' },
    { label: tr('개인정보 열람내역', 'Personal-data access log'), to: '/admin/privacy-log', grant: 'A9', icon: 'eye' },
  ] },
  { key: 'learning', letter: 'B', label: tr('수강 관리', 'Learning'), icon: 'book', items: [
    { label: tr('학습관리', 'Enrollments'), to: '/admin/studies', grant: 'B1', icon: 'book' },
    { label: tr('학습내역관리', 'Study history'), grant: 'B5', icon: 'checklist', ...legacy('study2.php') },
    { label: tr('수강마감', 'Close enrollments'), grant: 'B6', icon: 'flag', ...legacy('study_end.php') },
    { label: tr('IP모니터링', 'IP monitoring'), grant: 'B1', icon: 'monitor', ...legacy('study_ip.php') },
    { label: tr('본인인증 모니터링', 'Identity-check monitoring'), grant: 'B2', icon: 'shield', ...legacy('certification_list.php') },
    { label: tr('일자별 학습시간 관리', 'Daily study time'), to: '/admin/monitoring/daily', grant: 'B1', icon: 'calendar-clock' },
    { label: tr('리포트 부정훈련', 'Misconduct report'), grant: 'B4', icon: 'file-warning', ...legacy('negative_training.php') },
    { label: tr('AI 로그·로드맵 분석', 'AI log · roadmap analysis'), grant: 'B9', icon: 'brain', ...legacy('ai_log_roadmap_analysis.php') },
    { label: tr('과정 이수데이터 관리', 'Completion data'), grant: 'B7', icon: 'chart', ...legacy('course_data.php') },
    { label: tr('과목별 이수증', 'Certificates by course'), grant: 'B8', icon: 'award', ...legacy('study_end2.php') },
    { label: tr('수료증/이수증 테스트', 'Certificate test'), grant: 'B1', icon: 'award', ...legacy('certificate_test.php') },
  ] },
  { key: 'live', letter: 'L', label: tr('실시간 강의', 'Live classes'), icon: 'video', dept: ['C'], items: [
    { label: tr('실시간 강의 관리', 'Live class management'), grant: 'L1', icon: 'video', ...legacy('live_class.php') },
  ] },
  { key: 'nudge', letter: 'C', label: tr('독려 관리', 'Nudges'), icon: 'phone', items: [
    { label: tr('학습참여독려', 'Study nudges'), grant: 'C1', icon: 'send', ...legacy('study_sms.php') },
    { label: tr('예약문자발송', 'Scheduled SMS'), grant: 'C1', icon: 'clock', ...legacy('study_sms_res_list.php') },
    { label: tr('알림발송내역', 'Notification log'), grant: 'C2', icon: 'bell', ...legacy('study_alarm_log.php') },
    { label: tr('메일발송내역(교육담당자)', 'Mail log (managers)'), grant: 'C3', icon: 'mail', ...legacy('study_email_log_for_edumanager.php') },
    { label: tr('메일발송내역(훈련생)', 'Mail log (learners)'), grant: 'C4', icon: 'mail', ...legacy('study_email_log.php') },
    { label: tr('문자/템플릿관리', 'SMS templates'), grant: 'C5', icon: 'file', ...legacy('smsdata.php') },
  ] },
  { key: 'content', letter: 'D', label: tr('컨텐츠관리', 'Content'), icon: 'lightbulb', items: [
    { label: tr('과정카테고리 관리', 'Course categories'), to: '/admin/categories', grant: 'D1', icon: 'tags' },
    { label: tr('기초차시 관리', 'Base contents'), to: '/admin/contents', grant: 'D1', icon: 'monitor' },
    { label: tr('역량진단 문항관리', 'Assessment questions'), grant: 'D3', icon: 'checklist', ...legacy('ability_question_manager.php') },
    { label: tr('역량진단관리', 'Assessments'), grant: 'D4', icon: 'target', ...legacy('ability_manager.php') },
    { label: tr('만족도조사', 'Satisfaction surveys'), grant: 'D5', icon: 'star', ...legacy('satisfaction_manager.php') },
    { label: tr('패키지컨텐츠관리', 'Package contents'), to: '/admin/courses?packageYN=Y', grant: 'D1', icon: 'layers' },
  ] },
  { key: 'archive', letter: 'E', label: tr('아카이브', 'Archive'), icon: 'library', items: [
    { label: tr('이러닝 컨텐츠 관리', 'E-learning contents'), to: '/admin/courses?ctype=X', grant: 'D1', icon: 'graduation' },
    { label: tr('마이크로닝 컨텐츠 관리', 'Micro-learning contents'), to: '/admin/courses?ctype=Z', grant: 'D1', icon: 'bolt' },
    { label: tr('숏폼 컨텐츠 관리', 'Short-form contents'), to: '/admin/courses?ctype=Y', grant: 'D1', icon: 'shorts' },
    { label: tr('실시간 강의실 관리', 'Live classrooms'), grant: 'E1', icon: 'video', ...legacy('course.php?ctype=R', 'course-live') },
    { label: tr('컨텐츠 키워드 관리', 'Content keywords'), grant: 'E4', icon: 'tags', ...legacy('contents_keyword.php') },
    { label: tr('PICK/TOP/NEW 컨텐츠 관리', 'PICK / TOP / NEW'), to: '/admin/lists', grant: 'D1', icon: 'ordered' },
    { label: tr('관심강의 관리', 'Favourites'), grant: 'E6', icon: 'heart', ...legacy('contents_like.php') },
    { label: tr('과정조회 관리', 'Course views'), grant: 'E6', icon: 'eye', ...legacy('contents_count.php') },
    { label: tr('수강신청관리', 'Enrolment requests'), to: '/admin/inquiries', grant: 'F1', icon: 'inbox' },
    { label: tr('실시간 컨텐츠 관리', 'Live contents'), grant: 'E8', icon: 'broadcast', ...legacy('real_time_content_management.php') },
  ] },
  { key: 'community', letter: 'F', label: tr('커뮤니티관리', 'Community'), icon: 'message', items: [
    { label: tr('공지사항', 'Notices'), to: '/admin/notices', grant: 'F1', icon: 'megaphone' },
    { label: tr('자주 묻는 질문', 'FAQ'), to: '/admin/faqs', grant: 'F1', icon: 'info' },
    { label: tr('1:1 상담 / 학습상담', '1:1 questions'), to: '/admin/counsel', grant: 'F1', icon: 'headset' },
    { label: tr('수강후기', 'Reviews'), grant: 'F4', icon: 'star', ...legacy('survey.php') },
    { label: tr('아카이빙', 'Archiving'), grant: 'F5', icon: 'folders', ...legacy('archiving.php') },
    { label: tr('부정제보', 'Misconduct reports'), to: '/admin/cheating', grant: 'F1', icon: 'shield' },
    { label: tr('학습자료실', 'Learning resources'), grant: 'F7', icon: 'download', ...legacy('edudata.php') },
    { label: tr('이벤트관리', 'Events'), grant: 'F7', icon: 'calendar', ...legacy('lecture_event.php') },
  ] },
  { key: 'site', letter: 'G', label: tr('사이트관리', 'Site'), icon: 'settings', items: [
    { label: tr('사이트 정보 관리', 'Site information'), to: '/admin/site-info', grant: 'G1', icon: 'file' },
    { label: tr('팝업 관리', 'Pop-ups'), grant: 'G2', icon: 'grid', ...legacy('popup.php') },
    { label: tr('백업 목록', 'Backups'), grant: 'G3', icon: 'download', ...legacy('backup_list.php') },
    { label: tr('접속통계 관리', 'Visit statistics'), grant: 'G3', icon: 'chart', ...legacy('sta.php') },
    { label: tr('운영자·권한', 'Operators · permissions'), to: '/admin/staff', grant: 'G1', icon: 'user-cog' },
    { label: tr('웹사이트 디자인', 'Website design'), to: '/admin/design', grant: 'G1', icon: 'palette' },
  ] },
  { key: 'ruby', letter: 'F', label: tr('Ruby 관리', 'Ruby (AI)'), icon: 'bot', items: [
    { label: tr('Ruby FAQ 관리', 'Ruby FAQ'), grant: 'F2', icon: 'info', ...legacy('ruby_faq.php') },
    { label: tr('Ruby 지식베이스', 'Ruby knowledge base'), grant: 'F2', icon: 'library', ...legacy('ruby_kb.php') },
    { label: tr('Ruby 프롬프트', 'Ruby prompts'), grant: 'F2', icon: 'wand', ...legacy('ruby_prompt.php') },
    { label: tr('Ruby 런타임 설정', 'Ruby runtime'), grant: 'F2', icon: 'sliders', ...legacy('ruby_runtime.php') },
    { label: tr('Ruby 지원티켓', 'Ruby support tickets'), grant: 'F2', icon: 'inbox', ...legacy('ruby_tickets.php') },
    { label: tr('Ruby 임베딩 작업', 'Ruby embeddings'), grant: 'F2', icon: 'sparkles', ...legacy('ruby_embeddings.php') },
  ] },
  { key: 'monitoring', letter: 'B', label: tr('모니터링', 'Monitoring'), icon: 'activity', items: [
    { label: tr('이상 데이터', 'Anomalies'), to: '/admin/monitoring/abnormal', grant: 'B1', icon: 'file-warning' },
    { label: tr('중복 학습', 'Overlapping study'), to: '/admin/monitoring/overlap', grant: 'B1', icon: 'copy' },
    { label: tr('EMON 전송함', 'EMON outbox'), to: '/admin/emon', grant: 'B1', icon: 'send' },
    { label: tr('IP 모니터링', 'IP monitoring'), grant: 'B1', icon: 'activity', ...legacy('abnormal_data_dashboard.php') },
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
