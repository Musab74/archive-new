import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './My.module.css';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { isAppError } from '../../shared/api/client';
import { useToast } from '../../app/providers/ToastProvider';
import { Button } from '../../shared/ui/Button';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { my as copy } from '../../shared/strings/ko';
import { fmtDateTime, qk } from './queries';
import { hm } from '../../shared/player/time';

const c = copy.notices;

/** `/my/notices` — StudyCorrectionNotice (학습시간 보정 안내) + correction rows; POST /my/notices/ack. */
export default function MyNotices() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const data = useQuery({ queryKey: qk.notices, queryFn: ({ signal }) => myRoomApi.notices(signal) });
  const ack = useMutation({ mutationFn: () => myRoomApi.ackNotices(), onSuccess: () => { toast(c.acked, { tone: 'ok' }); void qc.invalidateQueries({ queryKey: qk.notices }); }, onError: () => toast(c.ackFail, { tone: 'danger' }) });
  if (data.isError && isAppError(data.error) && data.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  const pending = data.data?.items.filter((n) => !n.acknowledged) ?? [];
  return (
    <div className={styles.page}>
      <div className={styles.head}><div><span className="eyebrow">{copy.crumb}</span><h1>{c.title}</h1><p>{c.lead}</p></div></div>
      {data.isPending ? <Skeleton lines={4} /> : data.isError ? <StateBlock code="LIST_ERROR" title={c.errorTitle} body={c.errorBody} onRetry={() => void data.refetch()} /> : (
        <>
          {pending.map((n, i) => <div key={String(n.id ?? i)} className={styles.alert} role="status"><div><b>{c.pending(n.formatted || hm(n.totalDeltaSec))}</b> {n.appliedAt ? fmtDateTime(n.appliedAt) : ''}</div><Button size="xs" square onClick={() => ack.mutate()} loading={ack.isPending}>{c.ack}</Button></div>)}
          {data.data.corrections.length === 0 ? <StateBlock code="EMPTY" title={c.emptyTitle} body={c.emptyBody} hideActions /> : (
            <table className={styles.table}>
              <thead><tr><th scope="col">{c.cols.date}</th><th scope="col">{c.cols.action}</th><th scope="col" className={styles.num}>{c.cols.before}</th><th scope="col" className={styles.num}>{c.cols.after}</th><th scope="col" className={styles.num}>{c.cols.delta}</th><th scope="col">{c.cols.note}</th></tr></thead>
              <tbody>{data.data.corrections.map((r) => <tr key={r.idx}><td>{fmtDateTime(r.appliedAt)}</td><td>{r.action ?? ''}</td><td className={styles.num}>{hm(r.oldSeconds)}</td><td className={styles.num}>{hm(r.newSeconds)}</td><td className={styles.num}>{r.deltaSeconds >= 0 ? '+' : '−'}{hm(Math.abs(r.deltaSeconds))}</td><td>{r.note ?? ''}</td></tr>)}</tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
