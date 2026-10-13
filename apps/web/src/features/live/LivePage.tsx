import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import styles from './LivePage.module.css';
import { liveApi } from '../../shared/api/endpoints/live';
import { isAppError } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { useDesign } from '../../shared/design/useDesign';
import { Breadcrumb } from '../../shared/ui/Breadcrumb';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { PillTabs } from '../../shared/ui/Tabs';
import { StateBlock } from '../../shared/ui/StateBlock';
import { live as copy, nav } from '../../shared/strings/ko';

const TABS = [{ key: 'all', label: copy.tabs.all }, { key: 'live', label: copy.tabs.live }, { key: 'discussion', label: copy.tabs.discussion }];

/**
 * AR-16 토론방·라이브. No live/discussion listing endpoint exists in the API, so the storyboard structure renders with
 * the EMPTY state; the launcher issues the SSO token (POST /auth/sso/live-token) and opens `launchUrl` in a new window.
 */
export default function LivePage() {
  const { isAuthed } = useSession();
  const { config } = useDesign();
  const [tab, setTab] = useState('all');
  const [note, setNote] = useState<string | null>(null);
  const launch = useMutation({
    mutationFn: () => liveApi.launch(),
    onSuccess: (r) => { const w = window.open(r.launchUrl, '_blank', 'noopener'); if (!w) setNote(copy.popupBlocked); else setNote(null); },
    onError: (e) => setNote(isAppError(e) && e.isAuth ? copy.loginNeeded : copy.launchFail),
  });
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
          {isAuthed ? <Button size="lg" square onClick={() => launch.mutate()} loading={launch.isPending} icon={<Icon name="play" size={16} />}>{launch.isPending ? copy.launching : copy.launch}</Button>
            : <Button size="lg" square to={`/auth/login?next=${encodeURIComponent('/live')}`}>{copy.loginNeeded}</Button>}
          {config.links.liveClassUrl ? <a className="text-link" href={config.links.liveClassUrl} target="_blank" rel="noopener noreferrer">{config.links.liveClassUrl.replace(/^https?:\/\//, '')} ↗</a> : null}
          {note ? <p role="alert" className={styles.note}>{note}</p> : null}
        </div>
      </section>
      <PillTabs items={TABS} value={tab} onChange={setTab} label={copy.tabsAria} />
      <StateBlock code="EMPTY" symbol="calendar" center title={copy.emptyTitle} body={copy.emptyBody} actions={isAuthed ? <Button square size="sm" onClick={() => launch.mutate()} loading={launch.isPending}>{copy.launch}</Button> : <Button square size="sm" to={`/auth/login?next=${encodeURIComponent('/live')}`}>{nav.login}</Button>} />
      <div className={styles.cards}>{copy.cards.map((c) => <div key={c.title} className={styles.card}><b>{c.title}</b><p>{c.body}</p></div>)}</div>
      <section className={styles.faq}><h2>{copy.recordTitle}</h2><p>{copy.recordBody}</p><small>{copy.timezone}</small></section>
    </div>
  );
}
