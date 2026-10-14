import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './StateBlock.module.css';
import { cx } from '../utils/format';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { states, type StateActionKind, type StateCode } from '../strings/ko';
import { useUiLang } from '../i18n/adminLang';
import { statesEn } from '../i18n/statesEn';

export interface StateBlockProps {
  code: StateCode;
  /** Override copy (e.g. a server message). */
  title?: ReactNode;
  body?: ReactNode;
  kicker?: ReactNode;
  onRetry?: () => void;
  /** Extra buttons appended to the defaults. */
  extraActions?: ReactNode;
  /** Replace the default actions entirely. */
  actions?: ReactNode;
  /** Hide default actions (keeps extraActions). */
  hideActions?: boolean;
  /** Centered empty-state layout (storyboard `.browse-state`). */
  center?: boolean;
  /** Full-page layout (route-level states like NOT_FOUND). */
  page?: boolean;
  /** Where the login action should return to; defaults to the current location. */
  returnTo?: string;
  className?: string;
  symbol?: IconName;
}

const symbolFor: Partial<Record<StateCode, IconName>> = { LOGIN: 'lock', GUEST: 'user', ACCOUNT: 'user', AUTH: 'lock', AUTH_ERROR: 'alert', DUPLICATE_LOGIN: 'alert', CONCURRENT: 'alert', ENDED: 'clock', BEFORE: 'calendar', NOT_FOUND: 'info', EMPTY: 'search', LIST_ERROR: 'alert', ACCESS_ERROR: 'alert', NO_ACCESS: 'lock', UNAVAILABLE: 'info', SESSION_EXPIRED: 'clock', IDLE_LOGOUT: 'clock' };

/**
 * Storyboard state card: code → Korean kicker/title/body/actions from strings/ko.ts (English inside an EN admin console).
 * Actions route to login (with ?next=), home, catalog, support, retry (onRetry), back, my, auth.
 */
export function StateBlock({ code, title, body, kicker, onRetry, extraActions, actions, hideActions, center, page, returnTo, className, symbol }: StateBlockProps) {
  const copy = (useUiLang() === 'en' ? statesEn : states)[code];
  const navigate = useNavigate();
  const location = useLocation();
  const next = returnTo ?? `${location.pathname}${location.search}`;

  const run = (kind: StateActionKind) => {
    switch (kind) {
      case 'login': navigate(`/auth/login?next=${encodeURIComponent(next)}`); break;
      case 'home': navigate('/'); break;
      case 'catalog': navigate('/catalog'); break;
      case 'support': navigate('/support/guide'); break;
      case 'my': navigate('/my/profile'); break;
      case 'findId': navigate('/auth/find-id'); break;
      case 'auth': navigate(`/auth/daily?next=${encodeURIComponent(next)}`); break;
      case 'back': if (window.history.length > 1) navigate(-1); else navigate('/'); break;
      case 'reload': window.location.reload(); break;
      case 'retry': if (onRetry) onRetry(); else window.location.reload(); break;
    }
  };

  const card = (
    <section className={cx(styles.card, center && styles.center, className)} role="region" aria-labelledby={`state-${code}`} data-state={code}>
      <div className={styles.symbol} aria-hidden="true"><Icon name={symbol ?? symbolFor[code] ?? 'info'} size={27} /></div>
      <span className={styles.kicker}>{kicker ?? copy.kicker}</span>
      <h3 id={`state-${code}`} className={styles.title}>{title ?? copy.title}</h3>
      <p className={styles.body}>{body ?? copy.body}</p>
      {actions ? <div className={styles.actions}>{actions}</div> : (!hideActions || extraActions) ? (
        <div className={styles.actions}>
          {!hideActions && copy.actions.map((a) => (
            <Button key={a.kind} variant={a.primary ? 'primary' : 'secondary'} square size="sm" onClick={() => run(a.kind)}>{a.label}</Button>
          ))}
          {extraActions}
        </div>
      ) : null}
    </section>
  );
  return page ? <div className={styles.page}>{card}</div> : card;
}
