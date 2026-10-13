import { useMemo, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from './Support.module.css';
import { supportApi } from '../../shared/api/endpoints/support';
import { Pagination } from '../../shared/ui/Pagination';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { TypeLabel } from '../../shared/ui/Pill';
import { support as copy } from '../../shared/strings/ko';
import { formatDate } from '../../shared/utils/format';

const SIZE = 15;

export default function NoticeListPage() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') ?? '';
  const page = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1);
  const query = useMemo(() => ({ q: q || undefined, page, size: SIZE }), [q, page]);
  const list = useQuery({ queryKey: ['support', 'notices', query], queryFn: ({ signal }) => supportApi.notices(query, signal), placeholderData: keepPreviousData });
  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = (new FormData(e.currentTarget).get('q') as string | null)?.trim() ?? '';
    const next = new URLSearchParams(); if (v) next.set('q', v); setSp(next);
  };
  return (
    <section aria-labelledby="notice-h">
      <h2 id="notice-h" className={styles.h2} style={{ marginTop: 0 }}>{copy.notice.title}</h2>
      <p style={{ marginBottom: 16 }}>{copy.notice.lead}</p>
      <form className={styles.search} role="search" onSubmit={onSearch}>
        <label>{copy.notice.searchLabel}<input name="q" type="search" defaultValue={q} key={q} placeholder={copy.notice.searchPlaceholder} /></label>
        <button type="submit">{copy.faq.search.replace('FAQ ', '')}</button>
      </form>
      {list.isPending ? <Skeleton lines={6} /> : list.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void list.refetch()} /> : list.data.items.length === 0 ? (
        <StateBlock code="EMPTY" center title={copy.notice.empty} hideActions />
      ) : (
        <>
          <p className={styles.count}>{copy.notice.count(list.data.total)}</p>
          <div className={styles.table}>
            {list.data.items.map((n) => (
              <Link key={n.idx} to={`/support/notice/${n.idx}`}>
                <span className={styles.title}>{n.pinned ? <TypeLabel small>{copy.notice.pinned}</TypeLabel> : null}<span className="u-clamp-2">{n.title}</span></span>
                <span className={styles.date}>{formatDate(n.regDate)}</span>
              </Link>
            ))}
          </div>
          <Pagination page={page} total={list.data.total} size={SIZE} onChange={(p) => { const next = new URLSearchParams(sp); next.set('page', String(p)); setSp(next); }} label={copy.notice.title} />
        </>
      )}
    </section>
  );
}
