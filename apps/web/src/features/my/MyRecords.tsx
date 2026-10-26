import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from './My.module.css';
import { myRoomApi, type CourseHistoryQuery } from '../../shared/api/endpoints/myroom';
import { isAppError } from '../../shared/api/client';
import type { CompletionRecord, CourseHistoryRow } from '../../shared/api/schemas';
import { useToast } from '../../app/providers/ToastProvider';
import { Button } from '../../shared/ui/Button';
import { Tabs, PillTabs } from '../../shared/ui/Tabs';
import { Pagination } from '../../shared/ui/Pagination';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { TypeLabel } from '../../shared/ui/Pill';
import { MetricCard } from '../../shared/ui/MetricCard';
import { my as copy, learnHome } from '../../shared/strings/ko';
import { fmtDateTime, modeOf, resumeLink } from './queries';
import { hm } from '../../shared/player/time';
import { cx } from '../../shared/utils/format';

const SIZE = 20;
const COURSE_SIZE = 10; // tab-history.php $historyPageSize
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

/** AR-12 학습기록·이수내역: 학습기록 = tab-history.php course rows (GET /my/courses), 이수내역 = enrollments (GET /my/history?tab=completion). */
export default function MyRecords() {
  const [sp, setSp] = useSearchParams();
  const { toast } = useToast();
  const tab = sp.get('tab') === 'completion' ? 'completion' : 'records';
  const page = Math.max(1, Number(sp.get('page') ?? 1) || 1);
  const q = sp.get('q') ?? '';
  const from = sp.get('from') ?? '';
  const to = sp.get('to') ?? '';
  const status = (['progress', 'completed'].includes(sp.get('status') ?? '') ? sp.get('status') : 'all') as 'all' | 'progress' | 'completed';
  const sort = (['progress', 'completed'].includes(sp.get('sort') ?? '') ? sp.get('sort') : 'latest') as 'latest' | 'progress' | 'completed';
  const year = Number(sp.get('year') ?? '') || undefined;
  const rating = (['rated', 'unrated'].includes(sp.get('rating') ?? '') ? sp.get('rating') : undefined) as 'rated' | 'unrated' | undefined;
  const studySeq = Number(sp.get('studySeq') ?? '') || undefined;
  const [form, setForm] = useState({ q, from, to });
  const [rangeError, setRangeError] = useState<string | null>(null);
  const c = copy.records;
  const cc = c.courses;
  const set = (patch: Record<string, string>) => { const n = new URLSearchParams(sp); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setSp(n); };

  const courseQuery: CourseHistoryQuery = { page, size: COURSE_SIZE, status, sort, year, q: q || undefined, from: from || undefined, to: to || undefined, rating, studySeq };
  const records = useQuery({ queryKey: ['my', 'courses', courseQuery], queryFn: ({ signal }) => myRoomApi.courses(courseQuery, signal), enabled: tab === 'records', placeholderData: keepPreviousData });
  const query = { page, size: SIZE, q: q || undefined, from: from || undefined, to: to || undefined };
  const completion = useQuery({ queryKey: ['my', 'history', 'completion', query], queryFn: ({ signal }) => myRoomApi.historyCompletion(query, signal), enabled: tab === 'completion', placeholderData: keepPreviousData });
  const active = tab === 'records' ? records : completion;
  const filtered = !!(q || from || to || year || rating || status !== 'all' || studySeq);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.from && form.to && form.from > form.to) { setRangeError(c.rangeError); return; }
    setRangeError(null);
    set({ q: form.q.trim(), from: form.from, to: form.to, page: '' });
  };
  const reset = () => { setForm({ q: '', from: '', to: '' }); setRangeError(null); set({ q: '', from: '', to: '', status: '', year: '', rating: '', sort: '', studySeq: '', page: '' }); };
  const printSubject = async (r: CourseHistoryRow) => {
    const win = window.open('', '_blank');
    try { await myRoomApi.subjectCertificatePdf(r.lectureCode, r.studySeq || undefined, win); } catch (e) { toast(isAppError(e) ? e.message : cc.certFail, { tone: 'danger' }); }
  };

  if (active.isError && isAppError(active.error) && active.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  const sum = records.data?.summary;

  return (
    <div className={styles.page}>
      <div className={styles.head}><div><span className="eyebrow">{copy.crumb}</span><h1>{c.title}</h1><p>{c.lead}</p></div><Button variant="secondary" square size="sm" to="/my">{copy.nav.home} →</Button></div>
      <Tabs items={TABS} value={tab} onChange={(k) => set({ tab: k, page: '' })} label={c.tabsAria} />

      {tab === 'records' ? (
        <section className={styles.card} aria-label={cc.summaryTitle}>
          <h2>{cc.summaryTitle}</h2>
          {records.isPending ? <Skeleton height={70} /> : sum ? (
            <div className={styles.grid4}>
              <MetricCard compact title={cc.summary.total} value={cc.unit(sum.totalCourses)} />
              <MetricCard compact title={cc.summary.completed} value={cc.unit(sum.completed)} />
              <MetricCard compact title={cc.summary.inProgress} value={cc.unit(sum.inProgress)} />
              <MetricCard compact title={cc.summary.time} value={sum.formatted} />
            </div>
          ) : null}
        </section>
      ) : null}

      <form className={styles.filters} onSubmit={submit} noValidate aria-label={c.query}>
        <label style={{ flex: 1, minWidth: 200 }}>{c.search}<input type="search" value={form.q} placeholder={tab === 'records' ? cc.searchPlaceholder : c.searchPlaceholder} maxLength={100} onChange={(e) => setForm({ ...form, q: e.target.value })} /></label>
        {tab === 'records' ? (
          <>
            <label>{cc.year}<select className={styles.select} value={year ?? ''} onChange={(e) => set({ year: e.target.value, page: '' })}><option value="">{cc.yearAll}</option>{cc.years.map((y) => <option key={y} value={y}>{cc.yearLabel(y)}</option>)}</select></label>
            <label>{cc.rating}<select className={styles.select} value={rating ?? ''} onChange={(e) => set({ rating: e.target.value, page: '' })}>{cc.ratings.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label>
            <label>{cc.sort}<select className={styles.select} value={sort} onChange={(e) => set({ sort: e.target.value === 'latest' ? '' : e.target.value, page: '' })}>{cc.sorts.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label>
          </>
        ) : null}
        <label>{c.from}<input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} aria-invalid={!!rangeError || undefined} /></label>
        <label>{c.to}<input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} aria-invalid={!!rangeError || undefined} /></label>
        <Button square type="submit" size="sm">{c.query}</Button>
        <Button square variant="secondary" size="sm" onClick={reset}>{c.reset}</Button>
      </form>
      {rangeError ? <p role="alert" style={{ color: 'var(--c-danger)', fontSize: 13, margin: 0 }}>{rangeError}</p> : null}
      {tab === 'records' ? <PillTabs small items={cc.status.map((x) => ({ key: x.key, label: x.label }))} value={status} onChange={(k) => set({ status: k === 'all' ? '' : k, page: '' })} label={cc.statusAria} /> : null}

      {active.isPending ? <Skeleton lines={6} /> : active.isError ? (
        <StateBlock code="LIST_ERROR" title={c.errorTitle} body={c.errorBody} onRetry={() => void active.refetch()} />
      ) : tab === 'records' ? (
        records.data!.items.length === 0 ? (
          <StateBlock code="EMPTY" title={filtered ? c.emptyFilteredTitle : cc.empty} body={filtered ? c.emptyFilteredBody : c.emptyBody} actions={filtered ? <Button square size="sm" onClick={reset}>{c.reset}</Button> : <Button square size="sm" to="/catalog">{learnHome.browse}</Button>} />
        ) : (
          <>
            <p className={styles.count}>{c.count(records.data!.total)}<small>{c.sortNote}</small></p>
            <table className={styles.table}>
              <thead><tr><th scope="col">{cc.cols.date}</th><th scope="col">{cc.cols.content}</th><th scope="col">{cc.cols.state}</th><th scope="col" className={styles.num}>{cc.cols.time}</th><th scope="col" className={styles.num}>{cc.cols.progress}</th><th scope="col">{cc.cols.rating}</th><th scope="col">{cc.cols.actions}</th></tr></thead>
              <tbody>
                {records.data!.items.map((r) => (
                  <tr key={`${r.lectureCode}-${r.studySeq}`}>
                    <td>{r.lastStudyDate ?? '-'}</td>
                    <td><span className={styles.title}>{r.name ?? r.lectureCode}</span><span className={styles.sub}>{r.serviceTypeName} · {r.progress >= 100 ? `${cc.completedAt(r.lastStudyDate ?? '-')} · ${cc.studyMinutes(r.minutes)}` : cc.lastAt(r.lastStudyDate ?? '-')}</span></td>
                    <td><span className={cx(styles.pill, r.completed ? styles.pillOk : styles.pillInfo)}>{r.statusText}</span></td>
                    <td className={styles.num}>{r.formatted}</td>
                    <td className={styles.num}>{r.progress}%</td>
                    <td>{r.rating != null ? cc.ratingValue(r.rating) : <Link className="text-link" to={`/courses/${encodeURIComponent(r.lectureCode)}#reviews`}>{cc.ratingTodo}</Link>}</td>
                    <td><div className={styles.segRow}>
                      {r.certificate?.eligible ? <Button variant="secondary" size="xs" square onClick={() => void printSubject(r)}>{cc.certificate}</Button> : null}
                      <Button variant={r.completed ? 'secondary' : 'primary'} size="xs" square to={resumeLink(r)}>{r.completed ? cc.review : cc.resume}</Button>
                      {r.studySeq ? <Link className="text-link" to={`/my/records/${r.studySeq}`}>{c.detail}</Link> : null}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.note}>{cc.pageInfo(records.data!.total, (page - 1) * COURSE_SIZE + 1, Math.min(page * COURSE_SIZE, records.data!.total), page, Math.max(1, Math.ceil(records.data!.total / COURSE_SIZE)))}</p>
            <Pagination page={page} total={records.data!.total} size={COURSE_SIZE} onChange={(p) => set({ page: String(p) })} />
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
                      <td className={styles.num}>{refund ? `${Math.floor(r.progress)}%` : '—'}</td>
                      <td><span className={cx(styles.pill, st.tone)}>{st.label}</span>{st.note ? <span className={styles.sub}>{st.note}</span> : null}</td>
                      <td><div className={styles.segRow}><Link className="text-link" to={`/my/records/${r.studySeq}`}>{c.detail}</Link><Link className="text-link" to={`/my/records?studySeq=${r.studySeq}`}>{c.tabs.records}</Link></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} total={completion.data!.total} size={SIZE} onChange={(p) => set({ page: String(p) })} />
            <section className={cx(styles.card, styles.soft)}><h2>{c.completion.docsTitle}</h2><p className={styles.note}>{c.completion.docsBody}</p><div className="action-row"><Button variant="secondary" square size="sm" to="/my/certificates">{c.completion.docsCta}</Button><Button variant="secondary" square size="sm" to="/my/report">{copy.nav.report}</Button></div></section>
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
                  <td className={styles.num}>{Math.floor(ch.progress)}%</td>
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
