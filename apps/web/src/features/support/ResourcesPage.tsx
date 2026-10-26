import { useMemo, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from './Support.module.css';
import { supportApi } from '../../shared/api/endpoints/support';
import { useSession } from '../../shared/auth/useSession';
import { Pill } from '../../shared/ui/Pill';
import { Icon } from '../../shared/ui/Icon';
import { Pagination } from '../../shared/ui/Pagination';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StateBlock } from '../../shared/ui/StateBlock';
import { support as copy } from '../../shared/strings/ko';
import { formatDate } from '../../shared/utils/format';

/** edudata.html: 분류 tabs ($Edudata_array, header link opens 공통역량), oldest first, 10 per page; plus the learner's 찜한 자료. */
const SIZE = 10;
const CATEGORIES = [{ value: 'A', label: '공통역량' }, { value: 'B', label: '직무역량' }, { value: 'C', label: '리더십' }, { value: 'D', label: 'HRDe++' }, { value: 'E', label: '기타' }];

export default function ResourcesPage() {
  const c = copy.resources;
  const { isAuthed } = useSession();
  const [sp, setSp] = useSearchParams();
  const cat = sp.get('category') ?? 'A';
  const q = sp.get('q') ?? '';
  const page = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1);
  const scraps = cat === 'scraps';
  const query = useMemo(() => ({ category: scraps ? undefined : cat, q: q || undefined, page, size: SIZE }), [cat, q, page, scraps]);
  const list = useQuery({ queryKey: ['support', 'edudata', query], queryFn: ({ signal }) => supportApi.eduData(query, signal), placeholderData: keepPreviousData, enabled: !scraps });
  const mine = useQuery({ queryKey: ['support', 'edudata', 'scraps', page], queryFn: ({ signal }) => supportApi.scraps({ page, size: SIZE }, signal), enabled: scraps && isAuthed });
  const go = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    if (!('page' in patch)) next.delete('page');
    setSp(next);
  };
  const onSearch = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); go({ q: ((new FormData(e.currentTarget).get('q') as string | null) ?? '').trim(), category: scraps ? 'A' : cat }); };
  const cats = list.data?.categories.length ? list.data.categories : CATEGORIES;
  const active = scraps ? mine : list;
  return (
    <section aria-labelledby="res-h">
      <h2 id="res-h" className={styles.h2} style={{ marginTop: 0 }}>{c.title}</h2>
      <p style={{ marginBottom: 16 }}>{c.lead}</p>
      <div className={styles.catPills} role="group" aria-label={c.title}>
        {cats.map((o) => <Pill key={o.value} small pressed={cat === o.value} onClick={() => go({ category: o.value })}>{o.label}</Pill>)}
        {isAuthed ? <Pill small pressed={scraps} onClick={() => go({ category: 'scraps', q: '' })}>{c.scrapsTab}</Pill> : null}
      </div>
      {!scraps ? (
        <form className={styles.search} role="search" onSubmit={onSearch}>
          <label>{c.searchLabel}<input name="q" type="search" defaultValue={q} key={q} placeholder={c.searchPlaceholder} maxLength={100} /></label>
          <button type="submit">{copy.notice.search}</button>
        </form>
      ) : null}
      {scraps && !isAuthed ? <StateBlock code="LOGIN" center title={c.loginForScraps} /> : active.isPending ? <Skeleton lines={5} /> : active.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void active.refetch()} /> : (
        (scraps ? mine.data?.items.length : list.data?.items.length) ? (
          <>
            <p className={styles.count}>{copy.notice.count((scraps ? mine.data?.total : list.data?.total) ?? 0)}</p>
            <div className={styles.board} role="table" aria-label={c.title}>
              <div className={styles.boardHead} role="row">
                <span role="columnheader">{c.cols.no}</span><span role="columnheader">{c.cols.title}</span><span role="columnheader" className={styles.mh}>{c.cols.file}</span>
                <span role="columnheader" className={styles.mh}>{c.cols.date}</span><span role="columnheader" className={styles.mh}>{scraps ? '' : c.cols.views}</span>
              </div>
              {scraps
                ? mine.data!.items.map((r, i) => (
                  <Link key={r.idx} to={`/support/resources/${r.idx}`} className={styles.boardRow} role="row">
                    <span role="cell">{mine.data!.total - (page - 1) * SIZE - i}</span>
                    <span role="cell" className={styles.boardTitle}><span className="u-clamp-2">[{r.categoryName}] {r.title}</span></span>
                    <span role="cell" className={styles.mh}>{r.hasAttachment ? <Icon name="file" size={15} /> : null}</span>
                    <span role="cell" className={styles.mh}>{formatDate(r.regDate)}</span>
                    <span role="cell" className={styles.mh} />
                  </Link>
                ))
                : list.data!.items.map((r) => (
                  <Link key={r.idx} to={`/support/resources/${r.idx}`} className={styles.boardRow} role="row">
                    <span role="cell">{r.no}</span>
                    <span role="cell" className={styles.boardTitle}><span className="u-clamp-2">{r.title}</span></span>
                    <span role="cell" className={styles.mh}>{r.hasAttachment ? <Icon name="file" size={15} /> : null}</span>
                    <span role="cell" className={styles.mh}>{formatDate(r.regDate)}</span>
                    <span role="cell" className={styles.mh}>{(r.viewCount ?? 0).toLocaleString('ko-KR')}</span>
                  </Link>
                ))}
            </div>
            <Pagination page={page} total={(scraps ? mine.data?.total : list.data?.total) ?? 0} size={SIZE} onChange={(p) => go({ page: String(p) })} label={c.title} />
          </>
        ) : <StateBlock code="EMPTY" center title={scraps ? c.scrapsEmpty : c.empty} hideActions />
      )}
    </section>
  );
}
