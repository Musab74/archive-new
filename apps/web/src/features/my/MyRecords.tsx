import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from './My.module.css';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { isAppError } from '../../shared/api/client';
import type { CompletionRecord } from '../../shared/api/schemas';
import { Button } from '../../shared/ui/Button';
import { Tabs } from '../../shared/ui/Tabs';
import { Pagination } from '../../shared/ui/Pagination';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { TypeLabel } from '../../shared/ui/Pill';
import { MetricCard } from '../../shared/ui/MetricCard';
import { my as copy, learnHome } from '../../shared/strings/ko';
import { fmtDate, fmtDateTime, modeOf } from './queries';
import { hm } from '../../shared/player/time';
import { cx } from '../../shared/utils/format';

const SIZE = 20;
const TABS = [{ key: 'records', label: copy.records.tabs.records }, { key: 'completion', label: copy.records.tabs.completion }];

/** Completion status pill (AR-12 이수내역): server flags only — never decides 수료 client-side. */
export function completionLabel(r: CompletionRecord): { label: string; note: string; tone: string } {
  const c = copy.records.completion;
  if (modeOf(r.serviceType) === 'general') return { label: c.general, note: c.generalNote, tone: styles.pillInfo };
  if (r.state === 'BEFORE') return { label: c.before, note: '', tone: styles.pill };
  if (r.studyEnd || r.state === 'ENDED') {
    if (r.passOk) return { label: c.pass, note: c.passNote, tone: styles.pillOk };
    if (r.studyEnd) return { label: c.fail, note: c.failNote, tone: styles.pillDanger };
    return { label: c.pending, note: c.pendingNote, tone: styles.pillWarn };
  }
  if (r.seconds >= 54000) return { label: c.achievedLearning, note: c.achievedNote, tone: styles.pillOk };
  return { label: c.learning, note: c.learningNote, tone: styles.pillInfo };
}

/** AR-12 학습기록·이수내역: tabs records|completion with q/from/to/page in the URL. */
export default function MyRecords() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'completion' ? 'completion' : 'records';
  const page = Math.max(1, Number(sp.get('page') ?? 1) || 1);
  const q = sp.get('q') ?? '';
  const from = sp.get('from') ?? '';
  const to = sp.get('to') ?? '';
  const [form, setForm] = useState({ q, from, to });
  const [rangeError, setRangeError] = useState<string | null>(null);
  const c = copy.records;
  const set = (patch: Record<string, string>) => { const n = new URLSearchParams(sp); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setSp(n); };

  const query = { page, size: SIZE, q: q || undefined, from: from || undefined, to: to || undefined };
  const records = useQuery({ queryKey: ['my', 'history', 'records', query], queryFn: ({ signal }) => myRoomApi.historyRecords(query, signal), enabled: tab === 'records', placeholderData: keepPreviousData });
  const completion = useQuery({ queryKey: ['my', 'history', 'completion', query], queryFn: ({ signal }) => myRoomApi.historyCompletion(query, signal), enabled: tab === 'completion', placeholderData: keepPreviousData });
  const active = tab === 'records' ? records : completion;
  const filtered = !!(q || from || to);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.from && form.to && form.from > form.to) { setRangeError(c.rangeError); return; }
    setRangeError(null);
    set({ q: form.q.trim(), from: form.from, to: form.to, page: '' });
  };
  const reset = () => { setForm({ q: '', from: '', to: '' }); setRangeError(null); set({ q: '', from: '', to: '', page: '' }); };

  if (active.isError && isAppError(active.error) && active.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;

  return (
    <div className={styles.page}>
      <div className={styles.head}><div><span className="eyebrow">{copy.crumb}</span><h1>{c.title}</h1><p>{c.lead}</p></div></div>
      <Tabs items={TABS} value={tab} onChange={(k) => set({ tab: k, page: '' })} label={c.tabsAria} />

      <form className={styles.filters} onSubmit={submit} noValidate aria-label={c.query}>
        <label style={{ flex: 1, minWidth: 200 }}>{c.search}<input type="search" value={form.q} placeholder={c.searchPlaceholder} maxLength={100} onChange={(e) => setForm({ ...form, q: e.target.value })} /></label>
        <label>{c.from}<input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} aria-invalid={!!rangeError || undefined} /></label>
        <label>{c.to}<input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} aria-invalid={!!rangeError || undefined} /></label>
        <Button square type="submit" size="sm">{c.query}</Button>
        <Button square variant="secondary" size="sm" onClick={reset}>{c.reset}</Button>
      </form>
      {rangeError ? <p role="alert" style={{ color: 'var(--c-danger)', fontSize: 13, margin: 0 }}>{rangeError}</p> : null}

      {active.isPending ? <Skeleton lines={6} /> : active.isError ? (
        <StateBlock code="LIST_ERROR" title={c.errorTitle} body={c.errorBody} onRetry={() => void active.refetch()} />
      ) : tab === 'records' ? (
        records.data!.items.length === 0 ? (
          <StateBlock code="EMPTY" title={filtered ? c.emptyFilteredTitle : c.emptyTitle} body={filtered ? c.emptyFilteredBody : c.emptyBody} actions={filtered ? <Button square size="sm" onClick={reset}>{c.reset}</Button> : <Button square size="sm" to="/catalog">{learnHome.browse}</Button>} />
        ) : (
          <>
            <p className={styles.count}>{c.count(records.data!.total)}<small>{c.sortNote}</small></p>
            <table className={styles.table}>
              <thead><tr><th scope="col">{c.cols.date}</th><th scope="col">{c.cols.content}</th><th scope="col">{c.cols.firstAt}</th><th scope="col" className={styles.num}>{c.cols.time}</th><th scope="col" className={styles.num}>{c.cols.progress}</th><th scope="col">{c.cols.detail}</th></tr></thead>
              <tbody>
                {records.data!.items.map((r) => (
                  <tr key={`${r.studySeq}-${r.lectureCode}-${r.contentsIdx ?? ''}`}>
                    <td>{fmtDate(r.lastAt)}</td>
                    <td><span className={styles.title}>{r.title}</span><span className={styles.sub}>{r.courseName} · {r.lectureCode}</span></td>
                    <td>{fmtDate(r.firstAt)}</td>
                    <td className={styles.num}>{r.formatted || hm(r.studyTime)}</td>
                    <td className={styles.num}>{Math.round(r.progress)}%</td>
                    <td><Link className="text-link" to={`/my/records/${r.studySeq}`}>{c.detail}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={records.data!.total} size={SIZE} onChange={(p) => set({ page: String(p) })} />
            <p className={styles.note}>{c.note}</p>
          </>
        )
      ) : (
        completion.data!.items.length === 0 ? <StateBlock code="EMPTY" title={c.completion.emptyTitle} body={c.completion.emptyBody} hideActions /> : (
          <>
            <table className={styles.table}>
              <thead><tr><th scope="col">{c.completion.cols.type}</th><th scope="col">{c.completion.cols.enrollment}</th><th scope="col">{c.completion.cols.period}</th><th scope="col" className={styles.num}>{c.completion.cols.seconds}</th><th scope="col" className={styles.num}>{c.completion.cols.progress}</th><th scope="col">{c.completion.cols.result}</th><th scope="col">{c.completion.chapters}</th></tr></thead>
              <tbody>
                {completion.data!.items.map((r) => {
                  const st = completionLabel(r);
                  const refund = modeOf(r.serviceType) === 'refund';
                  return (
                    <tr key={r.studySeq}>
                      <td><TypeLabel tone={refund ? 'navy' : 'mint'} small>{refund ? learnHome.refund : learnHome.general}</TypeLabel></td>
                      <td><span className={styles.title}>{r.courseName}</span><span className={styles.sub}>#{r.studySeq} · {r.lectureCode}</span></td>
                      <td>{r.period?.label ?? ''}</td>
                      <td className={styles.num}>{r.formatted || hm(r.seconds)}</td>
                      <td className={styles.num}>{refund ? `${Math.round(r.progress)}%` : '—'}</td>
                      <td><span className={cx(styles.pill, st.tone)}>{st.label}</span>{st.note ? <span className={styles.sub}>{st.note}</span> : null}</td>
                      <td><Link className="text-link" to={`/my/records/${r.studySeq}`}>{c.detail}</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} total={completion.data!.total} size={SIZE} onChange={(p) => set({ page: String(p) })} />
            <section className={cx(styles.card, styles.soft)}><h2>{c.completion.docsTitle}</h2><p className={styles.note}>{c.completion.docsBody}</p><div className="action-row"><Button variant="secondary" square size="sm" to="/my/certificates">{c.completion.docsCta}</Button></div></section>
          </>
        )
      )}
    </div>
  );
}

/** `/my/records/:studySeq` — chapter drill-down from GET /my/records/:studySeq/chapters. */
export function MyRecordChapters() {
  const { studySeq = '' } = useParams();
  const seq = Number(studySeq);
  const navigate = useNavigate();
  const c = copy.records.chapters;
  const data = useQuery({ queryKey: ['my', 'records', seq, 'chapters'], queryFn: ({ signal }) => myRoomApi.recordChapters(seq, signal), enabled: Number.isFinite(seq) && seq > 0 });
  const byCourse = useMemo(() => {
    const m = new Map<string, { name: string; rows: NonNullable<typeof data.data>['chapters'] }>();
    for (const ch of data.data?.chapters ?? []) { const g = m.get(ch.lectureCode) ?? { name: ch.courseName ?? ch.lectureCode, rows: [] }; g.rows.push(ch); m.set(ch.lectureCode, g); }
    return [...m.entries()];
  }, [data.data]);

  if (!Number.isFinite(seq) || seq <= 0) return <div className={styles.page}><StateBlock code="NOT_FOUND" /></div>;
  if (data.isPending) return <div className={styles.page} aria-busy="true"><Skeleton lines={6} /></div>;
  if (data.isError) {
    const code = isAppError(data.error) && data.error.isAuth ? 'SESSION_EXPIRED' : isAppError(data.error) && data.error.status === 404 ? 'NO_ACCESS' : 'LIST_ERROR';
    return <div className={styles.page}><StateBlock code={code} title={c.errorTitle} body={c.errorBody} onRetry={() => void data.refetch()} /></div>;
  }
  const d = data.data;
  return (
    <div className={styles.page}>
      <div className={styles.head}><div><span className="eyebrow">{copy.records.title}</span><h1>{c.title}</h1><p>{c.lead}</p></div><Button variant="secondary" square size="sm" onClick={() => navigate('/my/records')}>{c.back}</Button></div>
      <div className={styles.grid3}>
        <MetricCard compact title={copy.records.completion.cols.enrollment} value={`#${d.studySeq}`} caption={d.lectureCode} />
        <MetricCard compact title={c.cols.time} value={d.formatted || hm(d.totalSeconds)} caption={c.total(hm(d.totalSeconds))} />
        <MetricCard compact title={c.cols.course} value={String(d.codes.length || byCourse.length)} caption={d.isPackage ? d.codes.join(', ') : d.lectureCode} />
      </div>
      {byCourse.length === 0 ? <StateBlock code="EMPTY" title={copy.records.emptyTitle} body={copy.records.emptyBody} hideActions /> : byCourse.map(([code, g]) => (
        <section key={code} className={styles.card} aria-label={g.name}>
          <div className={styles.cardHead}><h2>{g.name}</h2><Link className="text-link" to={`/courses/${encodeURIComponent(code)}`}>{code}</Link></div>
          <table className={styles.table}>
            <thead><tr><th scope="col">{c.cols.chapter}</th><th scope="col" className={styles.num}>{c.cols.minutes}</th><th scope="col" className={styles.num}>{c.cols.progress}</th><th scope="col" className={styles.num}>{c.cols.time}</th><th scope="col">{c.cols.last}</th><th scope="col" /></tr></thead>
            <tbody>
              {g.rows.map((ch) => (
                <tr key={ch.chapterSeq}>
                  <td><span className={styles.title}>{String(ch.order).padStart(2, '0')} · {ch.title}</span></td>
                  <td className={styles.num}>{ch.lectureTimeMin}분</td>
                  <td className={styles.num}>{Math.round(ch.progress)}%</td>
                  <td className={styles.num}>{hm(ch.studyTime)}</td>
                  <td>{fmtDateTime(ch.lastStudiedAt) || '—'}</td>
                  <td><Button variant="secondary" size="xs" square to={`/learn/${d.studySeq}/${ch.chapterSeq}?lectureCode=${encodeURIComponent(code)}`}>{c.learn}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <p className={styles.note}>{c.note}</p>
    </div>
  );
}
