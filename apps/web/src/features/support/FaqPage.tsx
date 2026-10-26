import { useMemo, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from './Support.module.css';
import { supportApi } from '../../shared/api/endpoints/support';
import { Pill } from '../../shared/ui/Pill';
import { LegacyHtml } from '../../shared/ui/LegacyHtml';
import { Button } from '../../shared/ui/Button';
import { Pagination } from '../../shared/ui/Pagination';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StateBlock } from '../../shared/ui/StateBlock';
import { support as copy } from '../../shared/strings/ko';

/** faq.html: 분류 tabs (전체 + $Faq_array), search in question/answer, admin order, 10 per page, answers fold open. */
const SIZE = 10;
const FAQ_FALLBACK = [{ value: 'A', label: '일반' }, { value: 'B', label: '동영상' }, { value: 'C', label: '학습진도' }, { value: 'D', label: '로그인' }, { value: 'E', label: '기타문의' }];

export default function FaqPage() {
  const c = copy.faq;
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') ?? '';
  const cat = sp.get('category') ?? '';
  const page = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1);
  /** faq.html?idx=N opened that answer (`$idxA == $idx`). */
  const openIdx = Number(sp.get('idx') ?? 0);
  const query = useMemo(() => ({ q: q || undefined, category: cat || undefined, page, size: SIZE }), [q, cat, page]);
  const faqs = useQuery({ queryKey: ['support', 'faqs', query], queryFn: ({ signal }) => supportApi.faqs(query, signal), placeholderData: keepPreviousData, staleTime: 5 * 60_000 });
  const cats = faqs.data?.categories.length ? faqs.data.categories : FAQ_FALLBACK;
  const go = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    if (!('page' in patch)) next.delete('page');
    setSp(next);
  };
  const onSearch = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); go({ q: ((new FormData(e.currentTarget).get('q') as string | null) ?? '').trim() }); };
  return (
    <section aria-labelledby="faq-h">
      <h2 id="faq-h" className={styles.h2} style={{ marginTop: 0 }}>{c.title}</h2>
      <form className={styles.search} role="search" onSubmit={onSearch}>
        <label>{c.searchLabel}<input name="q" type="search" defaultValue={q} key={q} placeholder={c.searchPlaceholder} maxLength={100} /></label>
        <button type="submit">{c.search}</button>
      </form>
      <div className={styles.catPills} role="group" aria-label={c.title}>
        <Pill small pressed={cat === ''} onClick={() => go({ category: '' })}>{c.all}</Pill>
        {cats.map((o) => <Pill key={o.value} small pressed={cat === o.value} onClick={() => go({ category: o.value })}>{o.label}</Pill>)}
      </div>
      {faqs.isPending ? <Skeleton lines={6} /> : faqs.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void faqs.refetch()} /> : faqs.data.items.length === 0 ? (
        <StateBlock code="EMPTY" center title={c.empty} actions={<Button variant="secondary" square size="sm" to="/support/counsel">{c.toCounsel}</Button>} />
      ) : (
        <>
          <p className={styles.count}>{c.count(faqs.data.total)}</p>
          <div>
            {faqs.data.items.map((f) => (
              <details key={f.idx} className={styles.faq} open={f.idx === openIdx || undefined}>
                <summary><span className={styles.faqCat}>[{f.categoryName}]</span>{f.title}</summary>
                <div className={styles.answer}><LegacyHtml html={f.content} /></div>
              </details>
            ))}
          </div>
          <Pagination page={page} total={faqs.data.total} size={SIZE} onChange={(p) => go({ page: String(p) })} label={c.title} />
        </>
      )}
      <div className="action-row" style={{ marginTop: 24 }}><Button square size="sm" to="/support/counsel">{c.toCounsel}</Button></div>
    </section>
  );
}
