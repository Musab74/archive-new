import { useState } from 'react';
import { AButton, Callout } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { legacyUrl } from '../../../../shared/auth/adminMenu';
import type { DateRange } from '../../../../shared/api/endpoints/admin-content-archive';

/** "검색항목 엑셀 출력" — the legacy xlsx buttons are CSV downloads here (UTF-8 BOM, opens in Excel). */
export function ExportButton({ run, disabled }: { run: () => Promise<void>; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const click = async () => {
    setBusy(true);
    try { await run(); } catch (err) { toast(isAppError(err) ? err.message : tr('목록을 내려받지 못했습니다.', 'Could not download the list.'), { tone: 'danger' }); } finally { setBusy(false); }
  };
  return <AButton onClick={() => void click()} loading={busy} disabled={disabled} icon="download">{tr('검색항목 엑셀(CSV) 출력', 'Export search results (CSV)')}</AButton>;
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

export const SIZE = 20;
export const noOf = (total: number, page: number, size: number, i: number) => total - (page - 1) * size - i;
