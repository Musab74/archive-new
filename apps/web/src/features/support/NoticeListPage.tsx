import { useMemo, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from './Support.module.css';
import { supportApi } from '../../shared/api/endpoints/support';
import { Pagination } from '../../shared/ui/Pagination';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { TypeLabel } from '../../shared/ui/Pill';
import { Icon } from '../../shared/ui/Icon';
import { support as copy } from '../../shared/strings/ko';
import { formatDate } from '../../shared/utils/format';

/** notice.html: 25 per page, 공지 rows first, 번호 / 제목 / 파일 / 등록일 / 조회, search in title + body. */
const SIZE = 25;

export default function NoticeListPage() {
  const c = copy.notice;
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
      <h2 id="notice-h" className={styles.h2} style={{ marginTop: 0 }}>{c.title}</h2>
      <p style={{ marginBottom: 16 }}>{c.lead}</p>
      <form className={styles.search} role="search" onSubmit={onSearch}>
        <label>{c.searchLabel}<input name="q" type="search" defaultValue={q} key={q} placeholder={c.searchPlaceholder} maxLength={100} /></label>
        <button type="submit">{c.search}</button>
      </form>
      {list.isPending ? <Skeleton lines={6} /> : list.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void list.refetch()} /> : list.data.items.length === 0 ? (
        <StateBlock code="EMPTY" center title={q ? c.emptySearch : c.empty} hideActions />
      ) : (
        <>
          <p className={styles.count}>{c.count(list.data.total)}</p>
          <div className={styles.board} role="table" aria-label={c.title}>
            <div className={styles.boardHead} role="row">
              <span role="columnheader">{c.cols.no}</span><span role="columnheader">{c.cols.title}</span><span role="columnheader" className={styles.mh}>{c.cols.file}</span>
              <span role="columnheader" className={styles.mh}>{c.cols.date}</span><span role="columnheader" className={styles.mh}>{c.cols.views}</span>
            </div>
            {list.data.items.map((n) => (
              <Link key={n.idx} to={`/support/notice/${n.idx}`} className={styles.boardRow} role="row">
                <span role="cell">{n.pinned ? <TypeLabel small>{c.pinned}</TypeLabel> : n.no}</span>
                <span role="cell" className={styles.boardTitle}><span className="u-clamp-2">{n.title}</span><small className={styles.mobileMeta}>{formatDate(n.regDate)}{n.hasAttachment ? ' · 첨부' : ''}</small></span>
                <span role="cell" className={styles.mh}>{n.hasAttachment ? <Icon name="file" size={15} title={c.hasFile} /> : null}</span>
                <span role="cell" className={styles.mh}>{formatDate(n.regDate)}</span>
                <span role="cell" className={styles.mh}>{(n.viewCount ?? 0).toLocaleString('ko-KR')}</span>
              </Link>
            ))}
          </div>
          <Pagination page={page} total={list.data.total} size={SIZE} onChange={(p) => { const next = new URLSearchParams(sp); next.set('page', String(p)); setSp(next); }} label={c.title} />
        </>
      )}
    </section>
  );
}
