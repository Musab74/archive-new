/** Last 수강생 관리 list query string (member.php pg/col/sw) so 목록 on the detail page returns to the same search after a reload. Per-tab convenience only. */
export const MEMBERS_LIST_SEARCH_KEY = 'admin.members.listSearch';

export function rememberMembersSearch(search: string): void {
  try { sessionStorage.setItem(MEMBERS_LIST_SEARCH_KEY, search); } catch { /* storage blocked */ }
}

/** `/admin/members` plus the list's query string: navigation state first, then the remembered one. */
export function membersListHref(state: unknown): string {
  const st = (state as { from?: unknown } | null)?.from;
  let from = typeof st === 'string' ? st : '';
  if (!from) { try { from = sessionStorage.getItem(MEMBERS_LIST_SEARCH_KEY) ?? ''; } catch { from = ''; } }
  return `/admin/members${from.startsWith('?') ? from : ''}`;
}
