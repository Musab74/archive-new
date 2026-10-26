import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Chatbot.module.css';
import { chromeApi, type KobePayload } from '../../../shared/api/endpoints/chrome';
import { chatbot } from '../../../shared/strings/ko';
import { cx } from '../../../shared/utils/format';
import { RUBY_OPEN_EVENT } from './RubyWidget';

const copy = chatbot.kobe;
/** kobe-config.js: 4 s timeout, 2 retries (3 s, 6 s), refresh when the tab becomes visible after 60 s; first call 2.5 s after load. */
const TIMEOUT_MS = 4_000;
const MAX_RETRIES = 2;
const REFRESH_VISIBLE_MS = 60_000;
const FIRST_DELAY_MS = 2_500;

/** kobe-widget.js inferContext() for the new routes: page + event the trigger API expects. Pure; exported for tests. */
export function kobeContext(pathname: string): { page: string; event: string } {
  const p = pathname.toLowerCase();
  if (p.startsWith('/my')) {
    if (p.startsWith('/my/ranking')) return { page: 'ranking_badges', event: 'gamification_view' };
    if (p.startsWith('/my/assessment')) return { page: 'assessment', event: 'assessment_view' };
    if (p.startsWith('/my/report')) return { page: 'report_personal', event: 'report_view' };
    return { page: 'mypage', event: 'mypage_enter' };
  }
  if (p.startsWith('/assessment')) return { page: 'assessment', event: 'assessment_view' };
  if (p.startsWith('/roadmap')) return { page: 'roadmap', event: 'roadmap_view' };
  if (p.startsWith('/catalog') || p.startsWith('/courses') || p.startsWith('/contents')) return { page: 'contents', event: 'content_list_enter' };
  if (p.startsWith('/learn')) return { page: 'lesson', event: 'lesson_start' };
  if (p.startsWith('/manager')) return { page: 'manager', event: 'dashboard_enter' };
  if (p.startsWith('/ai-zone')) return { page: 'aizone', event: 'first_visit' };
  return { page: 'main', event: 'first_visit' };
}

/**
 * 코비 (chatbot/kobe-widget.js): 코비 AI button bottom left; the panel shows the coaching message for the current page, its
 * button and the hint to ask 러비. The panel opens on click only (autoOpenOnMessage false in kobe-config.js).
 */
export function KobeWidget() {
  const { pathname, hash } = useLocation();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<KobePayload | null>(null);
  const [failed, setFailed] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ctx = kobeContext(pathname);
    const fetchTrigger = (attempt: number) => {
      if (document.visibilityState === 'hidden') return;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      chromeApi.kobeTrigger({ page: ctx.page, event: ctx.event, pagePath: pathname, pageHash: hash.replace('#', '') }, ctrl.signal)
        .then((p) => { if (!cancelled && p?.ok) { setPayload(p); setFailed(false); last.current = Date.now(); } })
        .catch(() => {
          if (cancelled) return;
          if (attempt < MAX_RETRIES) timer = setTimeout(() => fetchTrigger(attempt + 1), Math.min(3000 * (attempt + 1), 9000));
          else setFailed(true);
        })
        .finally(() => clearTimeout(t));
    };
    timer = setTimeout(() => fetchTrigger(0), last.current ? 0 : FIRST_DELAY_MS);
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - last.current >= REFRESH_VISIBLE_MS) fetchTrigger(0); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [pathname, hash]);

  const askRuby = () => { setOpen(false); window.dispatchEvent(new Event(RUBY_OPEN_EVENT)); };
  const text = payload?.message ?? '';

  return (
    <div className={styles.kobeRoot}>
      <button type="button" className={cx(styles.kobeToggle, open && styles.on)} aria-expanded={open} aria-controls={panelId} aria-label={copy.open} onClick={() => setOpen((v) => !v)}>
        {copy.toggle}<small>{copy.toggleSub}</small>
      </button>
      {open ? (
        <section id={panelId} className={styles.kobePanel} aria-label={copy.title}>
          <header className={styles.head}><span>{copy.title}</span><button type="button" onClick={() => setOpen(false)} aria-label={copy.close}>×</button></header>
          <div className={styles.kobeBody} aria-live="polite">
            {failed && !payload ? <p>{copy.failed}</p> : text ? text.split('\n').map((line, i) => <p key={i}>{line}</p>) : <p>{copy.preparing}</p>}
            {payload?.recommended_courses?.length ? (
              <div className={styles.links}>
                <b>{copy.courses}</b>
                <ul>{payload.recommended_courses.filter((c) => c.url.startsWith('/')).map((c) => <li key={c.code}><Link to={c.url} onClick={() => setOpen(false)}>{c.name}</Link></li>)}</ul>
              </div>
            ) : null}
          </div>
          {payload?.cta ? <div className={styles.kobeCta}><Link to={payload.cta.url} onClick={() => setOpen(false)}>{payload.cta.label}</Link></div> : null}
          <p className={styles.kobeHint}>{copy.rubyHintBefore}<button type="button" className="text-link" onClick={askRuby}>{copy.rubyHintLink}</button>{copy.rubyHintAfter}</p>
        </section>
      ) : null}
    </div>
  );
}
