import { useEffect, useState, type ReactNode } from 'react';
import { AButton, Callout } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { adm } from '../../strings';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { hasGrant, legacyUrl } from '../../../../shared/auth/adminMenu';
import type { DateRange } from '../../../../shared/api/endpoints/admin-content-archive';

/** "검색항목 엑셀 출력" — the legacy xlsx buttons are CSV downloads here (UTF-8 BOM, opens in Excel). */
export function ExportButton({ run, disabled, label }: { run: () => Promise<void>; disabled?: boolean; label?: string }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const click = async () => {
    setBusy(true);
    try { await run(); } catch (err) { toast(isAppError(err) ? err.message : tr('목록을 내려받지 못했습니다.', 'Could not download the list.'), { tone: 'danger' }); } finally { setBusy(false); }
  };
  return <AButton onClick={() => void click()} loading={busy} disabled={disabled} icon="download">{label ?? tr('검색항목 엑셀(CSV) 출력', 'Export search results (CSV)')}</AButton>;
}

/** "N건 (start ~ end)" + the 30-day cap notice of ability_manager.php / satisfaction_manager.php. */
export function RangeSummary({ total, range }: { total: number; range: DateRange | undefined }) {
  if (!range) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>{tr(`${total.toLocaleString('ko-KR')}건 (${range.start} ~ ${range.end}) · 기본 오늘 · 최대 1개월`, `${total.toLocaleString('en-US')} rows (${range.start} ~ ${range.end}) · default today · 30 days max`)}</p>
      {range.capped ? <Callout tone="warn">{tr(`조회 기간은 최대 1개월(${range.maxDays}일)까지 가능하여 시작일이 ${range.start}로 자동 조정되었습니다.`, `The range is limited to ${range.maxDays} days; the start date was moved to ${range.start}.`)}</Callout> : null}
    </div>
  );
}

/** Link to the PHP screen for the parts that still live only there (MongoDB live meetings). */
export function LegacyLink({ file, label }: { file: string; label: string }) {
  const url = legacyUrl(file);
  return <a href={url} target="_blank" rel="noopener noreferrer">{label} <span className="mono" style={{ fontSize: 12 }}>({file})</span></a>;
}

/** include_top.php: $page_size = 30, $block_size = 10 — every list of these hrd_manager pages shows 30 rows. */
export const SIZE = 30;

/** include_submenu.php $ArchiveSubMenuKeys: 실시간 강의실 관리 opens for ANY archive sub-grant ($ArchiveHasAnySub). */
export const LIVE_GRANTS = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8'] as const;
export const LIVE_INSTRUCTOR_URL = 'https://live.hrdeedu.co.kr/instructor';

/** GrantGate for "any of these grants" (the API checks the same list with @Grant(...codes)). */
export function AnyGrantGate({ grants, children }: { grants: readonly string[]; children: ReactNode }) {
  const { admin } = useAdminSession();
  if (!grants.some((g) => hasGrant(admin, g))) return <StateBlock code="NO_ACCESS" page title={adm.noGrant.title} body={adm.noGrant.body} hideActions />;
  return <>{children}</>;
}

/**
 * ability_manager.php / satisfaction_manager.php print the RESOLVED range in the date inputs (today by default, the moved start after
 * the 30-day cap). Whenever the form's dates equal the applied (searched) ones but not the resolved range — first load, a capped search,
 * or 초기화 back to the default (form cleared to '' while the query and its range stay the same) — the inputs take the resolved range.
 * Dates the user has typed but not searched yet are left alone, and placeholder data of the previous query (`stale`) is ignored.
 */
export function useResolvedRangeInForm<F extends { from: string; to: string }>(range: DateRange | undefined, applied: { from: string; to: string }, form: { from: string; to: string }, setForm: (fn: (f: F) => F) => void, stale = false) {
  useEffect(() => {
    if (!range || stale) return;
    if (form.from !== applied.from || form.to !== applied.to) return;
    if (form.from === range.start && form.to === range.end) return;
    setForm((f) => ({ ...f, from: range.start, to: range.end }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.start, range?.end, applied.from, applied.to, form.from, form.to, stale]);
}

/** The live list route. Its sub-screens use query params on this one registered route (like course_read.php?idx=..&ctype=R). */
export const LIVE_LIST = '/admin/live-courses';
export const liveHref = {
  /** course_read.php?idx=..&ctype=R (edit: course_write.php?mode=edit&ctype=R) */
  detail: (idx: number | string, edit = false) => `${LIVE_LIST}?idx=${encodeURIComponent(String(idx))}${edit ? '&mode=edit' : ''}`,
  /** course_write.php?mode=new&ctype=R — 라이브 신규 등록 */
  create: `${LIVE_LIST}?idx=new`,
  /** course_write_excel.php?ctype=R — 엑셀로 등록 */
  excel: `${LIVE_LIST}?view=excel`,
} as const;
export const noOf = (total: number, page: number, size: number, i: number) => total - (page - 1) * size - i;
