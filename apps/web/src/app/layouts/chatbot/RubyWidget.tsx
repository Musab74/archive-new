import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Chatbot.module.css';
import { chromeApi, type RubyCourseLink, type RubyEscalation } from '../../../shared/api/endpoints/chrome';
import { isAppError } from '../../../shared/api/client';
import { useSession } from '../../../shared/auth/useSession';
import { chatbot } from '../../../shared/strings/ko';
import { cx } from '../../../shared/utils/format';

const copy = chatbot.ruby;
/** chatbot/ruby-config.js network.timeoutMs. */
export const RUBY_TIMEOUT_MS = 20_000;
export const RUBY_OPEN_EVENT = 'ruby:open';

interface Msg { id: number; who: 'bot' | 'user'; text: string; links?: RubyCourseLink[]; login?: boolean }

/** The bot message for a failed request (ruby-widget.js: timeout / network / unparsable / rate limit). Pure; exported for tests. */
export function failureText(err: unknown, timedOut: boolean): string {
  if (timedOut) return copy.timeout;
  if (isAppError(err)) {
    if (err.status === 429) return copy.rateLimited;
    if (err.status === 400 && err.code === 'VALIDATION') return copy.tooLong;
    if (err.code === 'NETWORK') return copy.network;
  }
  return copy.failed;
}

/**
 * 러비 (chatbot/ruby-widget.js): toggle bottom right, welcome + quick questions, 1,000-character limit, 20 s timeout. The
 * fallback counter and follow-up intent come back from the API each turn (the PHP kept them in the session). After a
 * 담당자 연결 offer the next message goes to the ticket endpoint first (name / phone), else it is a new question.
 */
export function RubyWidget() {
  const { isAuthed } = useSession();
  const location = useLocation();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, who: 'bot', text: copy.welcome }]);
  const state = useRef<{ fallbackCount: number; followupIntent: string; escalation: RubyEscalation | null }>({ fallbackCount: 0, followupIntent: '', escalation: null });
  const seq = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const push = useCallback((m: Omit<Msg, 'id'>) => setMsgs((list) => [...list, { ...m, id: seq.current++ }]), []);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(RUBY_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(RUBY_OPEN_EVENT, onOpen);
  }, []);
  // ruby-widget.js: a click outside the panel closes it. The listener is attached after the current event has finished: when
  // 러비 is opened from outside (코비's 「우측 하단 러비」 hint dispatches ruby:open), React runs this effect while that same click
  // is still bubbling, and a listener added right away would see it reach document and close the panel at once.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const t = window.setTimeout(() => document.addEventListener('click', onDoc), 0);
    return () => { window.clearTimeout(t); document.removeEventListener('click', onDoc); };
  }, [open]);

  const ask = async (text: string) => {
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, RUBY_TIMEOUT_MS);
    try {
      const r = await chromeApi.rubyReply({ message: text, fallbackCount: state.current.fallbackCount, followupIntent: state.current.followupIntent }, ctrl.signal);
      state.current = { fallbackCount: r.meta?.fallbackCount ?? 0, followupIntent: r.meta?.followupIntent ?? '', escalation: r.escalation ?? null };
      push({ who: 'bot', text: r.reply || copy.failed, links: r.courseLinks, login: r.meta?.intent === 'login_required' });
    } catch (err) {
      state.current = { ...state.current, fallbackCount: Math.min(4, state.current.fallbackCount + 1) };
      push({ who: 'bot', text: failureText(err, timedOut) });
    } finally {
      clearTimeout(timer);
    }
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    if (Array.from(text).length > 1000) { push({ who: 'bot', text: copy.tooLong }); return; }
    setSending(true);
    setInput('');
    push({ who: 'user', text });
    try {
      const pending = state.current.escalation;
      if (pending) {
        try {
          const t = await chromeApi.rubyTicket({ message: text, escalation: pending });
          if (!t.released) {
            if (!t.pending) state.current = { ...state.current, escalation: null };
            push({ who: 'bot', text: t.reply });
            return;
          }
          state.current = { ...state.current, escalation: null };
        } catch {
          state.current = { ...state.current, escalation: null };
          push({ who: 'bot', text: copy.ticketFailed });
          return;
        }
      }
      await ask(text);
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (e: FormEvent) => { e.preventDefault(); void send(input); };
  const loginHref = `/auth/login?next=${encodeURIComponent(location.pathname + location.search)}`;

  return (
    <div ref={rootRef} className={styles.rubyRoot}>
      <button type="button" className={cx(styles.rubyToggle, open && styles.on)} aria-expanded={open} aria-controls={panelId} aria-label={copy.open} onClick={() => setOpen((v) => !v)}>{copy.toggle}</button>
      {open ? (
        <section id={panelId} className={styles.rubyPanel} aria-label={copy.title}>
          <header className={styles.head}><span>{copy.title}</span><button type="button" onClick={() => setOpen(false)} aria-label={copy.close}>×</button></header>
          <div ref={listRef} className={styles.messages} role="log" aria-live="polite" aria-label={copy.messages}>
            <div className={styles.quick}>
              {copy.quick.map((q) => <button key={q} type="button" onClick={() => void send(q)} disabled={sending}>{q}</button>)}
            </div>
            {msgs.map((m) => (
              <div key={m.id} className={cx(styles.msg, m.who === 'user' ? styles.user : styles.bot)}>
                <p>{m.text}</p>
                {m.links?.length ? (
                  <div className={styles.links}>
                    <b>{copy.links}</b>
                    <ul>{m.links.filter((l) => l.url.startsWith('/')).map((l) => <li key={l.url}><Link to={l.url} onClick={() => setOpen(false)}>{l.label}</Link></li>)}</ul>
                  </div>
                ) : null}
                {m.login && !isAuthed ? <Link className={styles.loginLink} to={loginHref}>{copy.login}</Link> : null}
              </div>
            ))}
          </div>
          <form className={styles.inputRow} onSubmit={onSubmit}>
            <label className="sr-only" htmlFor={`${panelId}-in`}>{copy.placeholder}</label>
            <input id={`${panelId}-in`} ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={copy.placeholder} autoComplete="off" />
            <button type="submit" disabled={sending || !input.trim()}>{copy.send}</button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
