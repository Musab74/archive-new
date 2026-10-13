import { useQuery } from '@tanstack/react-query';
import styles from './Support.module.css';
import { supportApi } from '../../shared/api/endpoints/support';
import { useDesign } from '../../shared/design/useDesign';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Button } from '../../shared/ui/Button';
import { support as copy } from '../../shared/strings/ko';
import { formatDate } from '../../shared/utils/format';

export default function EventsPage() {
  const { config } = useDesign();
  const q = useQuery({ queryKey: ['support', 'events'], queryFn: ({ signal }) => supportApi.events(signal) });
  return (
    <section aria-labelledby="ev-h">
      <h2 id="ev-h" className={styles.h2} style={{ marginTop: 0 }}>{copy.events.title}</h2>
      <p style={{ marginBottom: 16 }}>{copy.events.lead}</p>
      {q.isPending ? <Skeleton lines={5} /> : q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : q.data.items.length === 0 ? <StateBlock code="EMPTY" center title={copy.events.empty} hideActions /> : (
        <div className={styles.rows}>
          {q.data.items.map((ev) => (
            <div key={ev.idx} className={styles.row}>
              <div><b>{ev.title}</b><p>{formatDate(ev.startsAt)}{ev.endsAt ? ` ~ ${formatDate(ev.endsAt)}` : ''}{ev.place ? ` · ${ev.place}` : ''}</p>{ev.description ? <small>{ev.description}</small> : null}</div>
              {ev.url ? <Button variant="secondary" size="sm" square href={ev.url}>자세히</Button> : null}
            </div>
          ))}
        </div>
      )}
      {config.links.liveClassUrl ? <div className="action-row" style={{ marginTop: 24 }}><Button square size="sm" href={config.links.liveClassUrl}>{copy.events.live}</Button></div> : null}
    </section>
  );
}
