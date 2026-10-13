import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from './My.module.css';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { isAppError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { Pagination } from '../../shared/ui/Pagination';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { my as copy } from '../../shared/strings/ko';
import { fmtDate } from './queries';
import { cx } from '../../shared/utils/format';

const c = copy.tickets;
const SIZE = 20;

/** `/my/tickets` — the learner's own 1:1 문의 (GET /support/counsel). */
export default function MyTickets() {
  const [sp, setSp] = useSearchParams();
  const page = Math.max(1, Number(sp.get('page') ?? 1) || 1);
  const list = useQuery({ queryKey: ['support', 'counsel', page], queryFn: ({ signal }) => myRoomApi.counsel({ page, size: SIZE }, signal), placeholderData: keepPreviousData });
  if (list.isError && isAppError(list.error) && list.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  return (
    <div className={styles.page}>
      <div className={styles.head}><div><span className="eyebrow">{copy.crumb}</span><h1>{c.title}</h1><p>{c.lead}</p></div><Button square size="sm" to="/support/counsel">{c.newTicket}</Button></div>
      {list.isPending ? <Skeleton lines={4} /> : list.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void list.refetch()} /> : list.data.items.length === 0 ? <StateBlock code="EMPTY" title={c.emptyTitle} body={c.emptyBody} actions={<Button square size="sm" to="/support/counsel">{c.newTicket}</Button>} /> : (
        <>
          <table className={styles.table}>
            <thead><tr><th scope="col">{c.cols.date}</th><th scope="col">{c.cols.category}</th><th scope="col">{c.cols.title}</th><th scope="col">{c.cols.status}</th></tr></thead>
            <tbody>{list.data.items.map((t) => <tr key={t.idx}><td>{fmtDate(t.regDate)}</td><td>{t.categoryName ?? t.category ?? ''}</td><td><span className={styles.title}>{t.title}</span></td><td><span className={cx(styles.pill, t.answered ? styles.pillOk : styles.pillWarn)}>{t.statusLabel ?? (t.answered ? c.answered : c.waiting)}</span></td></tr>)}</tbody>
          </table>
          <Pagination page={page} total={list.data.total} size={SIZE} onChange={(p) => { const n = new URLSearchParams(sp); n.set('page', String(p)); setSp(n); }} />
        </>
      )}
    </div>
  );
}
