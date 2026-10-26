import { useMemo, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from './Support.module.css';
import { supportApi } from '../../shared/api/endpoints/support';
import { isAppError } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { Button } from '../../shared/ui/Button';
import { Pagination } from '../../shared/ui/Pagination';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { TypeLabel } from '../../shared/ui/Pill';
import { support as copy } from '../../shared/strings/ko';
import { cx, formatDate } from '../../shared/utils/format';

/** ask.html: own questions only, 25 per page — 번호, 문의종류, 제목, 등록일, 처리일, 답변(대기/완료). */
const SIZE = 25;

export default function MyCounselPage() {
  const c = copy.my;
  const { isAuthed, phase } = useSession();
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') ?? '';
  const page = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1);
  const query = useMemo(() => ({ q: q || undefined, page, size: SIZE }), [q, page]);
  const list = useQuery({ queryKey: ['support', 'counsel', 'mine', query], queryFn: ({ signal }) => supportApi.counselList(query, signal), placeholderData: keepPreviousData, enabled: isAuthed });
  if (phase !== 'booting' && !isAuthed) return <StateBlock code="LOGIN" center title={c.loginNeeded} />;
  if (list.isError && isAppError(list.error) && list.error.isAuth) return <StateBlock code="SESSION_EXPIRED" center />;
  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = (new FormData(e.currentTarget).get('q') as string | null)?.trim() ?? '';
    const next = new URLSearchParams(); if (v) next.set('q', v); setSp(next);
  };
  return (
    <section aria-labelledby="my-h">
      <div className={styles.sectionHead}>
        <div><h2 id="my-h" className={styles.h2} style={{ marginTop: 0 }}>{c.title}</h2><p>{c.lead}</p></div>
        <Button square size="sm" to="/support/counsel">{c.newTicket}</Button>
      </div>
      <form className={styles.search} role="search" onSubmit={onSearch}>
        <label>{c.searchLabel}<input name="q" type="search" defaultValue={q} key={q} placeholder={c.searchPlaceholder} maxLength={100} /></label>
        <button type="submit">{copy.notice.search}</button>
      </form>
      {list.isPending ? <Skeleton lines={5} /> : list.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void list.refetch()} /> : list.data.items.length === 0 ? (
        <StateBlock code="EMPTY" center title={c.empty} actions={<Button square size="sm" to="/support/counsel">{c.newTicket}</Button>} />
      ) : (
        <>
          <p className={styles.count}>{copy.notice.count(list.data.total)}</p>
          <div className={cx(styles.board, styles.board6)} role="table" aria-label={c.title}>
            <div className={styles.boardHead} role="row">
              <span role="columnheader">{c.cols.no}</span><span role="columnheader" className={styles.mh}>{c.cols.category}</span><span role="columnheader">{c.cols.title}</span>
              <span role="columnheader" className={styles.mh}>{c.cols.date}</span><span role="columnheader" className={styles.mh}>{c.cols.answered}</span><span role="columnheader">{c.cols.status}</span>
            </div>
            {list.data.items.map((t) => (
              <Link key={t.idx} to={`/support/my/${t.idx}`} className={styles.boardRow} role="row">
                <span role="cell">{t.no}</span>
                <span role="cell" className={styles.mh}>{t.categoryName ?? ''}</span>
                <span role="cell" className={styles.boardTitle}><span className="u-clamp-2">{t.title}</span><small className={styles.mobileMeta}>{t.categoryName ?? ''} · {formatDate(t.regDate)}</small></span>
                <span role="cell" className={styles.mh}>{formatDate(t.regDate)}</span>
                <span role="cell" className={styles.mh}>{t.answeredAt ? formatDate(t.answeredAt) : '-'}</span>
                <span role="cell"><TypeLabel small tone={t.status === 'B' ? 'mint' : 'warm'}>{t.statusLabel}</TypeLabel></span>
              </Link>
            ))}
          </div>
          <Pagination page={page} total={list.data.total} size={SIZE} onChange={(p) => { const next = new URLSearchParams(sp); next.set('page', String(p)); setSp(next); }} label={c.title} />
        </>
      )}
    </section>
  );
}

