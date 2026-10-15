import { tr } from '../../../../shared/i18n/adminLang';

/** Pure helpers shared by the staff list, the category picker and the category page (unit-tested in test/staff-parity.test.tsx). */

export type StaffDept = 'A' | 'B' | 'C';
/** Per-department wording of staff01/02/03.php and dept_category.php. */
export const STAFF_DEPT_TEXT: Record<StaffDept, { name: string; nameEn: string }> = {
  A: { name: '관리자', nameEn: 'administrator' },
  B: { name: '영업자', nameEn: 'sales staff' },
  C: { name: '첨삭강사', nameEn: 'tutor' },
};
/** Sub-menu code of each staff list (include_submenu.php: A6 staff01.php, A7 staff02.php, A8 staff03.php). */
export const STAFF_LIST_GRANT: Record<StaffDept, string> = { A: 'A6', B: 'A7', C: 'A8' };
/**
 * include_submenu.php shows 관리자/영업자/첨삭강사 리스트 only with the exact sub-menu code (in_array('A7', SubMenuGrant)) —
 * the top letter 'A' alone is not enough, unlike hasGrant(). Department A sees every list (the API's canManageStaffDept).
 */
export function staffListAllowed(src: { dept: string; subGrants: readonly string[] } | null | undefined, dept: StaffDept): boolean {
  if (!src) return false;
  return src.dept === 'A' || src.subGrants.includes(STAFF_LIST_GRANT[dept]);
}
/** Excel file name the API sends (staff02_excel.php "영업자목록_YYYYMMDD.xlsx"); used only when Content-Disposition is unreadable. */
export const staffExportFallbackName = (dept: StaffDept, ymd: string) => `${STAFF_DEPT_TEXT[dept].name}목록_${ymd}.xlsx`;

export const emptyStaffText = (dept: StaffDept) => tr(`등록된 ${STAFF_DEPT_TEXT[dept].name}가 없습니다.`, `No ${STAFF_DEPT_TEXT[dept].nameEn} registered.`);

/** include_function_cron.php $Bank_array, in the PHP order. */
export const BANKS = ['국민은행', '농협', '우리은행', 'SC은행', '기업은행', '하나은행', '수협중앙회', '신한은행', '한국씨티은행', '대구은행', '부산은행', '광주은행', '제주은행', '전북은행', '경남은행', '우체국', '새마을금고', '신협', 'KDB산업은행', '카카오뱅크'] as const;

/** function.js ID_Validity(): required, 4–20 chars, letters/digits only. Returns the PHP alert text, or null when valid. */
export function staffIdError(id: string): string | null {
  if (id === '') return tr('아이디를 입력하세요.', 'Enter a user ID.');
  if (id.length < 4 || id.length > 20) return tr('아이디는 4자이상 20자 이내로 입력하세요.', 'User ID must be 4–20 characters.');
  if (!/^[A-Za-z0-9]+$/.test(id)) return tr('아이디는 영문/숫자만 입력 가능합니다.', 'User ID may contain letters and digits only.');
  return null;
}

export interface StaffFormValues {
  ID: string; Pwd: string; Dept_idx: string; Name: string; Team: string;
  Mobile1: string; Mobile2: string; Mobile3: string; Phone1: string; Phone2: string; Phone3: string;
  Email: string; BankName: string; BankNumber: string; UseYN: 'Y' | 'N'; CommissionRatio: string;
}
/** staffNN_write.php: password prefilled 1111, 사용 selected. */
export const emptyStaffForm = (): StaffFormValues => ({ ID: '', Pwd: '1111', Dept_idx: '', Name: '', Team: '', Mobile1: '', Mobile2: '', Mobile3: '', Phone1: '', Phone2: '', Phone3: '', Email: '', BankName: '', BankNumber: '', UseYN: 'Y', CommissionRatio: '' });
/** "010-1234-5678" → ['010','1234','5678'] like explode('-') in staffNN_write.php. */
export const splitPhone = (v: string | null | undefined): [string, string, string] => { const p = String(v ?? '').split('-'); return [p[0] ?? '', p[1] ?? '', p.slice(2).join('-')]; };
/** staffNN_script.php: Mobile01."-".Mobile02."-".Mobile03 ("" when all three are empty). */
export const joinPhone = (a: string, b: string, c: string) => (a || b || c ? `${a.trim()}-${b.trim()}-${c.trim()}` : '');

/**
 * staffNN_write.php SubmitOk() in the same order: 카테고리, 아이디 (new), 이름, 소속, 비밀번호 (new), 휴대폰 (3 parts), 이메일,
 * 영업자 수수료율 (B: required + integer). The ID also gets the 중복 검색 format rule (ID_Validity).
 * Returns field → message; the first entry is what the PHP alert would have shown.
 */
export function validateStaffForm(f: StaffFormValues, mode: 'create' | 'edit', dept: StaffDept): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.Dept_idx) e.Dept_idx = tr('카테고리를 선택하세요.', 'Choose a category.');
  if (mode === 'create') { const idErr = staffIdError(f.ID.trim()); if (idErr) e.ID = idErr; }
  if (!f.Name.trim()) e.Name = tr('이름을 입력하세요.', 'Enter a name.');
  if (!f.Team.trim()) e.Team = tr('소속을 입력하세요.', 'Enter a team.');
  if (mode === 'create' && f.Pwd === '') e.Pwd = tr('비밀번호를 입력하세요.', 'Enter a password.');
  if (!f.Mobile1.trim() || !f.Mobile2.trim() || !f.Mobile3.trim()) e.Mobile = tr('휴대폰을 입력하세요.', 'Enter a mobile number.');
  if (!f.Email.trim()) e.Email = tr('이메일을 입력하세요.', 'Enter an e-mail.');
  if (dept === 'B') {
    if (f.CommissionRatio.trim() === '') e.CommissionRatio = tr('영업자 수수료율을 입력하세요.', 'Enter the commission rate.');
    else if (!/^\d+$/.test(f.CommissionRatio.trim())) e.CommissionRatio = tr('영업자 수수료율은 숫자만(정수) 입력하세요.', 'Commission must be a whole number.');
  }
  return e;
}

export interface TreeNode { idx: number; parent?: number | null; deep: number; name?: string | null }
/** Depth-first order with siblings by idx ASC — the order dept_category.php / dept_category_sub.php print (ORDER BY idx ASC). */
export function treeByIdx<T extends TreeNode>(items: readonly T[]): T[] {
  const byParent = new Map<number, T[]>();
  for (const n of items) { const k = n.parent ?? 0; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k)!.push(n); }
  for (const arr of byParent.values()) arr.sort((a, b) => a.idx - b.idx);
  const out: T[] = [];
  const seen = new Set<number>();
  const walk = (parent: number) => { for (const n of byParent.get(parent) ?? []) { if (seen.has(n.idx)) continue; seen.add(n.idx); out.push(n); walk(n.idx); } };
  walk(0);
  for (const n of [...items].sort((a, b) => a.idx - b.idx)) if (!seen.has(n.idx)) { seen.add(n.idx); out.push(n); walk(n.idx); } // orphans (parent outside this site)
  return out;
}

/** Visible rows of a collapsible tree: roots always, a child only when every ancestor is expanded (dept_category.php starts collapsed). */
export function visibleTree<T extends TreeNode>(ordered: readonly T[], expanded: ReadonlySet<number>): T[] {
  const byIdx = new Map(ordered.map((n) => [n.idx, n]));
  const shown = (n: T): boolean => { const p = n.parent ? byIdx.get(n.parent) : undefined; return !p || (expanded.has(p.idx) && shown(p)); };
  return ordered.filter(shown);
}

/** 영업부서 정렬 row colours by Deep (dept_category.php), blended into the theme paper colour so dark mode stays readable. */
const DEEP_COLOURS: Record<number, string> = { 1: '#f2f2f2', 2: '#ffffe1', 3: '#ffdddd', 4: '#d9d9ff', 5: '#d9ecff', 6: '#d9ffd9', 7: '#e6ffe6', 8: '#ebf5f5', 9: '#e6f2f2' };
export const deepColour = (deep: number) => DEEP_COLOURS[deep] ?? null;
export const deepTint = (deep: number) => { const c = deepColour(deep); return c ? `color-mix(in srgb, ${c} 55%, var(--c-paper))` : 'var(--c-paper)'; };
