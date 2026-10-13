import { useQuery } from '@tanstack/react-query';
import styles from './Support.module.css';
import { supportApi } from '../../shared/api/endpoints/support';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Button } from '../../shared/ui/Button';
import { support as copy } from '../../shared/strings/ko';
import { formatDate } from '../../shared/utils/format';
import { LegacyHtml } from '../../shared/ui/LegacyHtml';

export default function ResourcesPage() {
  const q = useQuery({ queryKey: ['support', 'resources'], queryFn: ({ signal }) => supportApi.resources(signal) });
  return (
    <section aria-labelledby="res-h">
      <h2 id="res-h" className={styles.h2} style={{ marginTop: 0 }}>{copy.resources.title}</h2>
      <p style={{ marginBottom: 16 }}>{copy.resources.lead}</p>
      {q.isPending ? <Skeleton lines={5} /> : q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : q.data.items.length === 0 ? <StateBlock code="EMPTY" center title={copy.resources.empty} hideActions /> : (
        <div className={styles.rows}>
          {q.data.items.map((r) => (
            <div key={r.idx} className={styles.row}>
              <div><b>{r.title}</b>{r.description ? <LegacyHtml html={r.description} /> : null}{r.regDate ? <small>{formatDate(r.regDate)}</small> : null}</div>
              {r.url ? <Button variant="secondary" size="sm" square href={r.url}>{copy.resources.download}</Button> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
