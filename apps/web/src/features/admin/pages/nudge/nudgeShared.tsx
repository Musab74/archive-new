import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Callout } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';

/** Rule 10: the new API has no SMS/알림톡/mail provider; sending still runs on the PHP admin. Shown on every screen with a "send" action. */
export function SendStubCallout({ children }: { children?: ReactNode }) {
  return (
    <Callout tone="warn">
      <b>{tr('발송 기능 안내', 'Sending notice')}</b> — {tr('새 콘솔에는 문자/알림톡/메일 발송 설정이 아직 없습니다. 여기서 "발송"을 누르면 기존 사이트와 같은 발송 로그만 남고 실제 전송은 되지 않습니다. 실제 발송은 기존 관리자 사이트(hrd_manager)에서 진행하세요.', 'The new console has no SMS/Kakao/mail provider yet. "Send" here only writes the same log rows as the legacy site; nothing is transmitted. Use the legacy admin (hrd_manager) for real sends.')}
      {children}
    </Callout>
  );
}

/** First `n` characters with an ellipsis (table cells); full text goes in the drawer. */
export function clip(text: string | null | undefined, n = 60): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/** Multi-line message block (pre-wrap, monospace-free) used by previews and drawers. */
export function MessageBlock({ text, maxHeight = 320 }: { text: string | null | undefined; maxHeight?: number }) {
  return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid var(--c-border, #e5e7eb)', borderRadius: 8, padding: 12, maxHeight, overflow: 'auto', background: 'var(--c-surface-2, #fafafa)' }}>{text || <span className="muted">{tr('내용 없음', 'No content')}</span>}</div>;
}

export function MemberLink({ id, children }: { id: string | null | undefined; children?: ReactNode }) {
  if (!id) return <>{children ?? ''}</>;
  return <Link to={`/admin/members/${encodeURIComponent(id)}`}>{children ?? id}</Link>;
}

export const YEAR_OPTIONS = (years: number[]) => years.slice().reverse().map((y) => ({ value: String(y), label: `${y}년` }));
export const MONTH_OPTIONS = [{ value: '', label: tr('전체', 'All') }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: `${i + 1}월` }))];
export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({ value: String(i), label: `${String(i).padStart(2, '0')}시` }));
export const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
export const addDaysIso = (iso: string, days: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
