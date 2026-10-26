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
import { Pagination } from '../../shared/ui/Pagination';
import { my as copy, contentType, learnHome } from '../../shared/strings/ko';
import { fmtDate } from './queries';
import { formatMinutes, typeLabel } from '../../shared/utils/format';

const c = copy.saved;
const PAGE = 8;
const keyOf = (i: SavedItem) => String(i.likeIdx ?? i.lectureCode);

/**
 * AR-13 찜한 콘텐츠 (old 관심과정): GET /my/saved, DELETE /my/saved/:lectureCode (one card) and POST /my/saved/remove (checked cards,
 * archive_save_del.php) with confirm. Search / type / sort are client-side over the learner's own list.
 */
export default function MySaved() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [sort, setSort] = useState<'recent' | 'title'>('recent');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<SavedItem | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const list = useQuery({ queryKey: ['my', 'saved'], queryFn: ({ signal }) => myRoomApi.saved(signal) });
  const unsave = useMutation({
    mutationFn: (code: string) => myRoomApi.unsave(code),
    onMutate: (code) => { const prev = qc.getQueryData<SavedItem[]>(['my', 'saved']); qc.setQueryData<SavedItem[]>(['my', 'saved'], (prev ?? []).filter((i) => i.lectureCode !== code)); return { prev }; },
    onError: (_e, _c, ctx) => { if (ctx?.prev) qc.setQueryData(['my', 'saved'], ctx.prev); toast(c.unsaveFail, { tone: 'danger' }); },
    onSuccess: () => { toast(c.unsaved, { tone: 'ok' }); void qc.invalidateQueries({ queryKey: ['catalog'] }); },
    onSettled: () => setPending(null),
  });
  const removeMany = useMutation({
    mutationFn: (idx: number[]) => myRoomApi.removeSaved(idx),
    onSuccess: (r) => { toast(c.removed(r.removed ?? checked.size), { tone: 'ok' }); setChecked(new Set()); void qc.invalidateQueries({ queryKey: ['my', 'saved'] }); void qc.invalidateQueries({ queryKey: ['catalog'] }); },
    onError: (e) => toast(isAppError(e) ? e.message : c.unsaveFail, { tone: 'danger' }),
    onSettled: () => setBulkOpen(false),
  });
  const items = useMemo(() => {
    const all = list.data ?? [];
    const f = all.filter((i) => (!q || (i.name ?? '').toLowerCase().includes(q.toLowerCase())) && (!type || i.ctype === type));
    return sort === 'title' ? [...f].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko')) : [...f].sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));
  }, [list.data, q, type, sort]);
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const current = Math.min(page, pages);
  const shown = items.slice((current - 1) * PAGE, current * PAGE);
  const filtered = !!(q || type);
  const toggle = (k: string) => setChecked((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const checkedIdx = (list.data ?? []).filter((i) => checked.has(keyOf(i)) && i.likeIdx).map((i) => i.likeIdx!);
  if (list.isError && isAppError(list.error) && list.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;

  return (
    <div className={styles.page}>
      <div className={styles.head}><div><span className="eyebrow">{copy.crumb}</span><h1>{c.title}</h1><p>{c.lead}</p></div><Button variant="secondary" square size="sm" to="/my">{copy.nav.home} →</Button></div>
      <section className={`${styles.card} ${styles.soft}`}><h2 style={{ whiteSpace: 'pre-line', fontSize: 20 }}>{c.heroTitle}</h2><p className={styles.note} style={{ fontSize: 13 }}>{c.heroBody}</p></section>
      <div className={styles.filters}>
        <label style={{ flex: 1, minWidth: 200 }}>{c.search}<input type="search" value={q} placeholder={c.search} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
        <label>{c.type}<Select value={type} placeholder={copy.company.types[0]} options={['X', 'Y', 'Z'].map((k) => ({ value: k, label: contentType[k] ?? k }))} onValueChange={(v) => { setType(v); setPage(1); }} /></label>
        <label>{c.sort}<Select value={sort} options={[{ value: 'recent', label: c.sortRecent }, { value: 'title', label: c.sortTitle }]} onValueChange={(v) => setSort(v as 'recent' | 'title')} /></label>
        {checkedIdx.length ? <Button variant="secondary" square size="sm" onClick={() => setBulkOpen(true)}>{c.removeSelected(checkedIdx.length)}</Button> : null}
      </div>
      {list.isPending ? <Skeleton lines={5} /> : list.isError ? <StateBlock code="LIST_ERROR" title={c.errorTitle} body={c.errorBody} onRetry={() => void list.refetch()} /> : items.length === 0 ? (
        <StateBlock code="EMPTY" symbol="heart" title={filtered ? c.emptyFilteredTitle : c.emptyTitle} body={filtered ? c.emptyFilteredBody : c.emptyBody} actions={filtered ? <Button square size="sm" onClick={() => { setQ(''); setType(''); }}>{copy.records.reset}</Button> : <Button square size="sm" to="/catalog">{learnHome.browse}</Button>} />
      ) : (
        <>
          <p className={styles.count}>{c.title} {items.length}개<small>{c.count(items.length)}</small></p>
          <ul className={styles.list}>
            {shown.map((i) => (
              <li key={keyOf(i)} className={styles.item}>
                <div className={styles.itemCopy}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {i.likeIdx ? <label className={styles.check}><input type="checkbox" checked={checked.has(keyOf(i))} onChange={() => toggle(keyOf(i))} aria-label={`${c.select} ${i.name ?? i.lectureCode}`} /></label> : null}
                    <TypeLabel tone="gray" small>{typeLabel(i.ctype)}</TypeLabel>
                    {i.visible === false ? <TypeLabel tone="warm" small>{c.hidden}</TypeLabel> : null}
                    {i.visible !== false && i.category1 ? <span className={styles.cat}>{i.category1}{i.category2 ? ` · ${i.category2}` : ''}</span> : null}
                    {i.visible !== false && i.learning ? <span className={styles.pill}>{c.learning[i.learning]}</span> : null}
                  </div>
                  {i.visible === false ? <><span className={styles.itemTitle}>{c.hidden}</span><span className={styles.itemMeta}>{c.hiddenBody}</span></> : <Link to={`/courses/${encodeURIComponent(i.lectureCode)}`} className={styles.itemTitle}>{i.name}</Link>}
                  {i.visible !== false ? <span className={styles.itemMeta}>{i.contentsTime ? `${formatMinutes(Number(i.contentsTime))} · ` : ''}{i.professor ? `${i.professor} · ` : ''}{c.rating(i.rating)} · {c.views(i.viewCount ?? 0)}</span> : null}
                  <span className={styles.itemMeta}>{c.savedAt(fmtDate(i.savedAt))}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {i.visible !== false ? <Button variant="secondary" size="xs" square to={`/courses/${encodeURIComponent(i.lectureCode)}`}>{c.detail}</Button> : null}
                  <Button variant="ghost" size="xs" square onClick={() => setPending(i)}>♥ {c.unsave}</Button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={current} total={items.length} size={PAGE} onChange={setPage} />
          <p className={styles.note}>{c.note}</p>
        </>
      )}
      <Dialog open={!!pending} title={c.confirmTitle} body={c.confirmBody} confirmLabel={c.unsave} cancelLabel={copy.profile.editCancel} tone="warn" loading={unsave.isPending} onCancel={() => setPending(null)} onConfirm={() => { if (pending) unsave.mutate(pending.lectureCode); }} />
      <Dialog open={bulkOpen} title={c.removeConfirmTitle} body={c.removeConfirmBody(checkedIdx.length)} confirmLabel={c.unsave} cancelLabel={copy.profile.editCancel} tone="warn" loading={removeMany.isPending} onCancel={() => setBulkOpen(false)} onConfirm={() => removeMany.mutate(checkedIdx)} />
    </div>
  );
}
