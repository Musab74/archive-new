import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import styles from './Support.module.css';
import { supportApi } from '../../shared/api/endpoints/support';
import { Pill } from '../../shared/ui/Pill';
import { LegacyHtml } from '../../shared/ui/LegacyHtml';
import { Button } from '../../shared/ui/Button';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StateBlock } from '../../shared/ui/StateBlock';
import { support as copy } from '../../shared/strings/ko';

export default function FaqPage() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const faqs = useQuery({ queryKey: ['support', 'faqs'], queryFn: ({ signal }) => supportApi.faqs({}, signal), staleTime: 10 * 60_000 });
  const cats = useMemo(() => Array.from(new Set((faqs.data?.items ?? []).map((f) => f.category).filter((c): c is string => !!c))), [faqs.data]);
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (faqs.data?.items ?? []).filter((f) => (!cat || f.category === cat) && (!needle || `${f.question} ${f.answer}`.toLowerCase().includes(needle)));
  }, [faqs.data, q, cat]);
  const onSearch = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); setQ((new FormData(e.currentTarget).get('q') as string | null) ?? ''); };
  return (
    <section aria-labelledby="faq-h">
      <h2 id="faq-h" className={styles.h2} style={{ marginTop: 0 }}>{copy.faq.title}</h2>
      <form className={styles.search} role="search" onSubmit={onSearch}>
        <label>{copy.faq.searchLabel}<input name="q" type="search" placeholder={copy.faq.searchPlaceholder} /></label>
        <button type="submit">{copy.faq.search}</button>
      </form>
      {cats.length > 0 ? (
        <div className={styles.catPills} role="group" aria-label={copy.faq.title}>
          <Pill small pressed={cat === ''} onClick={() => setCat('')}>{copy.faq.all}</Pill>
          {cats.map((c) => <Pill key={c} small pressed={cat === c} onClick={() => setCat(c)}>{c}</Pill>)}
        </div>
      ) : null}
      {faqs.isPending ? <Skeleton lines={6} /> : faqs.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void faqs.refetch()} /> : items.length === 0 ? (
        <StateBlock code="EMPTY" center title={copy.faq.empty} actions={<Button variant="secondary" square size="sm" to="/support/counsel">{copy.faq.toCounsel}</Button>} />
      ) : (
        <div>
          {items.map((f) => (
            <details key={f.idx} className={styles.faq}>
              <summary>{f.question}</summary>
              <div className={styles.answer}><LegacyHtml html={f.answer} />{f.link ? <div className="action-row"><Button variant="text" size="xs" to={f.link}>{copy.faq.related} →</Button></div> : null}</div>
            </details>
          ))}
        </div>
      )}
      <div className="action-row" style={{ marginTop: 24 }}><Button square size="sm" to="/support/counsel">{copy.faq.toCounsel}</Button></div>
    </section>
  );
}
