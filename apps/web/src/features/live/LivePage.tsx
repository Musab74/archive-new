import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import styles from './LivePage.module.css';
import { liveApi, type LiveEnrollment } from '../../shared/api/endpoints/live';
import { isAppError } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { useDesign } from '../../shared/design/useDesign';
import { Breadcrumb } from '../../shared/ui/Breadcrumb';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { TypeLabel } from '../../shared/ui/Pill';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StateBlock } from '../../shared/ui/StateBlock';
import { live as copy, nav } from '../../shared/strings/ko';
import { formatDate } from '../../shared/utils/format';

const WINDOW_TONE: Record<LiveEnrollment['window'], 'mint' | 'warm' | 'gray'> = { open: 'mint', before: 'warm', ended: 'gray' };

/**
 * header.html openLiveClass(): the Live Class opens in a new tab. `window.open(url, '_blank', 'noopener')` always returns null
 * (HTML spec), which made the page report a blocked popup after every successful entry; open the tab, then drop its opener.
 */
export function openLiveTab(url: string): Window | null {
  const w = window.open(url, '_blank');
  if (w) { try { w.opener = null; } catch { /* already navigated cross-origin */ } }
  return w;
}

/**
 * AR-16 토론방·라이브. The old site only had the header "Live Class" button (openLiveClass: login check, then
 * live.hrdeedu.co.kr?token=<SSO JWT> in a new tab). From MariaDB the page adds the learner's 실시간 강의실 enrolments with
 * their date window; live schedules/attendance (MongoDB) and discussion boards (no tables) are stated as not available.
 */
export default function LivePage() {
  const { isAuthed } = useSession();
  const { config } = useDesign();
  const [note, setNote] = useState<string | null>(null);
  const overview = useQuery({ queryKey: ['live', 'overview', isAuthed], queryFn: ({ signal }) => liveApi.overview(signal) });
  const liveUrl = overview.data?.liveClassUrl || config.links.liveClassUrl;
  const launch = useMutation({
    mutationFn: () => liveApi.entry(),
    onSuccess: (r) => { const w = openLiveTab(r.launchUrl); setNote(w ? null : copy.popupBlocked); },
    onError: (e) => setNote(isAppError(e) && e.isAuth ? copy.loginNeeded : isAppError(e) && e.status === 503 ? copy.notConfigured : copy.launchFail),
  });
  const enter = isAuthed
    ? <Button size="lg" square onClick={() => launch.mutate()} loading={launch.isPending} icon={<Icon name="play" size={16} />}>{launch.isPending ? copy.launching : copy.launch}</Button>
    : <Button size="lg" square to={`/auth/login?next=${encodeURIComponent('/live')}`}>{copy.loginNeeded}</Button>;
  return (
    <div className={styles.page}>
      <Breadcrumb items={[{ label: nav.archive, to: '/' }, { label: copy.crumb }]} />
      <section className={styles.hero}>
        <div>
          <span className="eyebrow">{copy.eyebrow}</span>
          <h1 style={{ whiteSpace: 'pre-line' }}>{copy.title}</h1>
          <p>{copy.lead}</p>
        </div>
        <div className={styles.launch}>
          {enter}
          {liveUrl ? <a className="text-link" href={liveUrl} target="_blank" rel="noopener noreferrer">{liveUrl.replace(/^https?:\/\//, '')} ↗</a> : null}
          {note ? <p role="alert" className={styles.note}>{note}</p> : null}
        </div>
      </section>

      <section aria-labelledby="live-mine-h">
        <h2 id="live-mine-h" className={styles.h2}>{copy.myLiveTitle}</h2>
        {overview.isPending ? <Skeleton lines={3} /> : overview.isError ? <StateBlock code="LIST_ERROR" center title={copy.listError} onRetry={() => void overview.refetch()} /> : !overview.data.signedIn ? (
          <StateBlock code="GUEST" center title={copy.myLiveGuest} actions={<Button square size="sm" to={`/auth/login?next=${encodeURIComponent('/live')}`}>{nav.login}</Button>} />
        ) : overview.data.enrollments.length === 0 ? (
          <StateBlock code="EMPTY" symbol="calendar" center title={copy.myLiveEmpty} hideActions />
        ) : (
          <div className={styles.list}>
            {overview.data.enrollments.map((e) => (
              <article key={e.studySeq} className={styles.item}>
                <div>
                  <TypeLabel small tone={WINDOW_TONE[e.window]}>{e.windowLabel}</TypeLabel>
                  <h3>{e.title}</h3>
                  <p>{copy.period(formatDate(e.lectureStart), formatDate(e.lectureEnd))}{e.professor ? ` · ${copy.professor(e.professor)}` : ''}</p>
                </div>
                {e.window === 'open' ? <Button square size="sm" onClick={() => launch.mutate()} loading={launch.isPending}>{copy.enter}</Button> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {overview.data ? (
        <div className={styles.blocked}>
          <section aria-labelledby="live-sched-h" className={styles.card}>
            <b id="live-sched-h">{copy.scheduleTitle}</b>
            <p>{overview.data.schedule.reason}</p>
            {liveUrl ? <Button variant="text" size="sm" href={liveUrl}>{copy.scheduleLink}</Button> : null}
          </section>
          <section aria-labelledby="live-disc-h" className={styles.card}>
            <b id="live-disc-h">{copy.discussionTitle}</b>
            <p>{overview.data.discussions.reason}</p>
          </section>
        </div>
      ) : null}

      <div className={styles.cards}>{copy.cards.map((c) => <div key={c.title} className={styles.card}><b>{c.title}</b><p>{c.body}</p></div>)}</div>
      <section className={styles.faq}><h2>{copy.recordTitle}</h2><p>{copy.recordBody}</p><small>{copy.timezone}</small></section>
    </div>
  );
}
