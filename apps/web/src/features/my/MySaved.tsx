import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './My.module.css';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { isAppError } from '../../shared/api/client';
import type { SavedItem } from '../../shared/api/schemas';
import { useToast } from '../../app/providers/ToastProvider';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Modal';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { TypeLabel } from '../../shared/ui/Pill';
import { Select } from '../../shared/ui/Form';
import { my as copy, contentType, learnHome } from '../../shared/strings/ko';
import { fmtDate } from './queries';
import { formatMinutes, typeLabel } from '../../shared/utils/format';

const c = copy.saved;

/** AR-13 찜한 콘텐츠: GET /my/saved (array), DELETE /my/saved/:lectureCode with optimistic removal + confirm. */
export default function MySaved() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [sort, setSort] = useState<'recent' | 'title'>('recent');
  const [pending, setPending] = useState<SavedItem | null>(null);
  const list = useQuery({ queryKey: ['my', 'saved'], queryFn: ({ signal }) => myRoomApi.saved(signal) });
  const unsave = useMutation({
    mutationFn: (code: string) => myRoomApi.unsave(code),
    onMutate: (code) => { const prev = qc.getQueryData<SavedItem[]>(['my', 'saved']); qc.setQueryData<SavedItem[]>(['my', 'saved'], (prev ?? []).filter((i) => i.lectureCode !== code)); return { prev }; },
    onError: (_e, _c, ctx) => { if (ctx?.prev) qc.setQueryData(['my', 'saved'], ctx.prev); toast(c.unsaveFail, { tone: 'danger' }); },
    onSuccess: () => { toast(c.unsaved, { tone: 'ok' }); void qc.invalidateQueries({ queryKey: ['catalog'] }); },
    onSettled: () => setPending(null),
  });
  const items = useMemo(() => {
    const all = list.data ?? [];
    const f = all.filter((i) => (!q || (i.name ?? '').toLowerCase().includes(q.toLowerCase())) && (!type || i.ctype === type));
    return sort === 'title' ? [...f].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko')) : [...f].sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));
  }, [list.data, q, type, sort]);
  const filtered = !!(q || type);
  if (list.isError && isAppError(list.error) && list.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;

  return (
    <div className={styles.page}>
      <div className={styles.head}><div><span className="eyebrow">{copy.crumb}</span><h1>{c.title}</h1><p>{c.lead}</p></div></div>
      <section className={`${styles.card} ${styles.soft}`}><h2 style={{ whiteSpace: 'pre-line', fontSize: 20 }}>{c.heroTitle}</h2><p className={styles.note} style={{ fontSize: 13 }}>{c.heroBody}</p></section>
      <div className={styles.filters}>
        <label style={{ flex: 1, minWidth: 200 }}>{c.search}<input type="search" value={q} placeholder={c.search} onChange={(e) => setQ(e.target.value)} /></label>
        <label>{c.type}<Select value={type} placeholder={copy.company.types[0]} options={['X', 'Y', 'Z'].map((k) => ({ value: k, label: contentType[k] ?? k }))} onChange={(e) => setType(e.target.value)} /></label>
        <label>{c.sort}<Select value={sort} options={[{ value: 'recent', label: c.sortRecent }, { value: 'title', label: c.sortTitle }]} onChange={(e) => setSort(e.target.value as 'recent' | 'title')} /></label>
      </div>
      {list.isPending ? <Skeleton lines={5} /> : list.isError ? <StateBlock code="LIST_ERROR" title={c.errorTitle} body={c.errorBody} onRetry={() => void list.refetch()} /> : items.length === 0 ? (
        <StateBlock code="EMPTY" symbol="heart" title={filtered ? c.emptyFilteredTitle : c.emptyTitle} body={filtered ? c.emptyFilteredBody : c.emptyBody} actions={filtered ? <Button square size="sm" onClick={() => { setQ(''); setType(''); }}>{copy.records.reset}</Button> : <Button square size="sm" to="/catalog">{learnHome.browse}</Button>} />
      ) : (
        <>
          <p className={styles.count}>{c.count(items.length)}</p>
          <ul className={styles.list}>
            {items.map((i) => (
              <li key={i.lectureCode} className={styles.item}>
                <div className={styles.itemCopy}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><TypeLabel tone="gray" small>{typeLabel(i.ctype)}</TypeLabel>{i.visible === false ? <TypeLabel tone="warm" small>{c.hidden}</TypeLabel> : null}{i.category1 ? <span className={styles.cat}>{i.category1}{i.category2 ? ` · ${i.category2}` : ''}</span> : null}</div>
                  {i.visible === false ? <span className={styles.itemTitle}>{c.hidden}</span> : <Link to={`/courses/${encodeURIComponent(i.lectureCode)}`} className={styles.itemTitle}>{i.name}</Link>}
                  <span className={styles.itemMeta}>{i.contentsTime ? `${formatMinutes(Number(i.contentsTime))} · ` : ''}{i.professor ? `${i.professor} · ` : ''}{c.savedAt(fmtDate(i.savedAt))}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {i.visible !== false ? <Button variant="secondary" size="xs" square to={`/courses/${encodeURIComponent(i.lectureCode)}`}>{c.detail}</Button> : null}
                  <Button variant="ghost" size="xs" square onClick={() => setPending(i)}>{c.unsave}</Button>
                </div>
              </li>
            ))}
          </ul>
          <p className={styles.note}>{c.note}</p>
        </>
      )}
      <Dialog open={!!pending} title={c.confirmTitle} body={c.confirmBody} confirmLabel={c.unsave} cancelLabel={copy.profile.editCancel} tone="warn" loading={unsave.isPending} onCancel={() => setPending(null)} onConfirm={() => { if (pending) unsave.mutate(pending.lectureCode); }} />
    </div>
  );
}
