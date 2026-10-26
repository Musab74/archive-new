import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './Support.module.css';
import { downloadLearnerFile, supportApi } from '../../shared/api/endpoints/support';
import { isAppError, newIdempotencyKey } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { Button } from '../../shared/ui/Button';
import { FormField, FormMessage, Input, Textarea } from '../../shared/ui/Form';
import { Icon } from '../../shared/ui/Icon';
import { LegacyHtml } from '../../shared/ui/LegacyHtml';
import { Pagination } from '../../shared/ui/Pagination';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StateBlock } from '../../shared/ui/StateBlock';
import { TypeLabel } from '../../shared/ui/Pill';
import { support as copy } from '../../shared/strings/ko';
import { formatDate } from '../../shared/utils/format';
import { fieldErrors } from './CounselPage';

/** archiving_ok.php / tab-company.php: allowed extensions and the 50 MB limit (checked again on the API). */
const ARCHIVING_EXT = ['mp4', 'vod', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'hwp'];
const ARCHIVING_MAX = 52_428_800;
const SIZE = 25;

/** 아카이빙 (archive/archiving/archiving.html + mypage 「등록 콘텐츠 관리」): guidance, my requests, the register form. */
export default function ArchivingPage() {
  const c = copy.archiving;
  const { isAuthed, phase } = useSession();
  const [sp, setSp] = useSearchParams();
  const page = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1);
  const query = useMemo(() => ({ page, size: SIZE }), [page]);
  const list = useQuery({ queryKey: ['support', 'archiving', query], queryFn: ({ signal }) => supportApi.archivingList(query, signal), placeholderData: keepPreviousData, enabled: isAuthed });
  return (
    <section aria-labelledby="ar-h">
      <h2 id="ar-h" className={styles.h2} style={{ marginTop: 0 }}>{c.title}</h2>
      <p>{c.lead}</p>
      <div className={`${styles.note} ${styles.warm}`}>{c.caution}</div>
      <div className={styles.cards}>
        <article className={styles.card}><h3>{c.goodTitle}</h3><ul className={styles.list}>{c.good.map((g) => <li key={g}>{g}</li>)}</ul></article>
        <article className={`${styles.card} ${styles.warmTop}`}><h3>{c.badTitle}</h3><ul className={styles.list}>{c.bad.map((g) => <li key={g}>{g}</li>)}</ul></article>
      </div>
      {phase !== 'booting' && !isAuthed ? <StateBlock code="LOGIN" center title={c.loginNeeded} /> : (
        <>
          <h3 className={styles.h2}>{c.listTitle}</h3>
          {list.isPending ? <Skeleton lines={4} /> : list.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void list.refetch()} /> : list.data.items.length === 0 ? (
            <StateBlock code="EMPTY" center title={c.empty} hideActions />
          ) : (
            <>
              <div className={styles.board} role="table" aria-label={c.listTitle}>
                <div className={styles.boardHead} role="row">
                  <span role="columnheader">{c.cols.no}</span><span role="columnheader">{c.cols.title}</span><span role="columnheader" className={styles.mh}>{c.cols.date}</span>
                  <span role="columnheader" className={styles.mh}>{c.cols.type}</span><span role="columnheader">{c.cols.status}</span>
                </div>
                {list.data.items.map((r) => (
                  <Link key={r.idx} to={`/support/archiving/${r.idx}`} className={styles.boardRow} role="row">
                    <span role="cell">{r.no}</span>
                    <span role="cell" className={styles.boardTitle}><span className="u-clamp-2">{r.title}</span></span>
                    <span role="cell" className={styles.mh}>{formatDate(r.regDate)}</span>
                    <span role="cell" className={styles.mh}>{r.fileType}</span>
                    <span role="cell"><TypeLabel small tone={r.status === 'B' ? 'mint' : 'warm'}>{r.statusLabel}</TypeLabel></span>
                  </Link>
                ))}
              </div>
              <Pagination page={page} total={list.data.total} size={SIZE} onChange={(p) => setSp(new URLSearchParams({ page: String(p) }))} label={c.listTitle} />
            </>
          )}
          <ArchivingForm />
        </>
      )}
    </section>
  );
}

function ArchivingForm() {
  const c = copy.archiving;
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: c.defaultTitle, contents: '' });
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [idem, setIdem] = useState(() => newIdempotencyKey());
  const submit = useMutation({
    mutationFn: () => supportApi.createArchiving({ title: form.title.trim(), contents: form.contents.trim(), file }, idem),
    onSuccess: () => { setForm({ title: c.defaultTitle, contents: '' }); setFile(null); setFileKey((k) => k + 1); setIdem(newIdempotencyKey()); void qc.invalidateQueries({ queryKey: ['support', 'archiving'] }); },
    onError: (e) => setErrors(fieldErrors(e)),
  });
  const onFile = (f: File | null) => {
    const errs = { ...errors }; delete errs.file;
    if (f) {
      const ext = (f.name.split('.').pop() ?? '').toLowerCase();
      if (!f.name.includes('.') || !ARCHIVING_EXT.includes(ext)) errs.file = c.fileType;
      else if (f.size > ARCHIVING_MAX) errs.file = c.fileTooBig;
    }
    setErrors(errs);
    setFile(errs.file ? null : f);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = c.titleRequired;
    if (!form.contents.trim()) errs.contents = c.contentsRequired;
    if (!file) errs.file = errors.file ?? c.fileRequired;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    submit.mutate();
  };
  return (
    <form className={styles.form} style={{ marginTop: 24 }} onSubmit={onSubmit} noValidate aria-labelledby="ar-form-h">
      <h3 id="ar-form-h" className={styles.subTitle} style={{ marginTop: 0 }}>{c.formTitle}</h3>
      <FormField label={c.titleField} required htmlFor="ar-title" error={errors.title}><Input id="ar-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={250} invalid={!!errors.title} /></FormField>
      <FormField label={c.contents} required htmlFor="ar-contents" error={errors.contents}><Textarea id="ar-contents" value={form.contents} onChange={(e) => setForm((f) => ({ ...f, contents: e.target.value }))} placeholder={c.contentsPlaceholder} rows={5} maxLength={20000} invalid={!!errors.contents} /></FormField>
      <FormField label={c.file} required htmlFor="ar-file" help={c.fileHelp} error={errors.file}>
        <input key={fileKey} id="ar-file" className={styles.fileInput} type="file" accept={ARCHIVING_EXT.map((x) => `.${x}`).join(',')} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      </FormField>
      {submit.isSuccess ? <FormMessage tone="ok">{c.done}</FormMessage> : null}
      <FormMessage>{submit.isError ? (isAppError(submit.error) ? submit.error.message : copy.form.fail) : ''}</FormMessage>
      <Button type="submit" square loading={submit.isPending}>{c.submit}</Button>
    </form>
  );
}

/** archiving_view.html / api/archiving-detail.php: own request; the answer and the download appear once it is 완료. */
export function ArchivingDetailPage() {
  const c = copy.archiving;
  const { id = '' } = useParams();
  const { isAuthed, phase } = useSession();
  const [dlError, setDlError] = useState('');
  const q = useQuery({ queryKey: ['support', 'archiving', 'detail', id], queryFn: ({ signal }) => supportApi.archiving(id, signal), enabled: isAuthed && /^\d+$/.test(id) });
  if (phase !== 'booting' && !isAuthed) return <StateBlock code="LOGIN" center title={c.loginNeeded} />;
  if (!/^\d+$/.test(id)) return <StateBlock code="NOT_FOUND" center />;
  if (q.isPending) return <Skeleton lines={6} />;
  if (q.isError) {
    const code = isAppError(q.error) && q.error.status === 404 ? 'NOT_FOUND' : 'LIST_ERROR';
    return <StateBlock code={code} center onRetry={() => void q.refetch()} actions={code === 'NOT_FOUND' ? <Button variant="secondary" square size="sm" to="/support/archiving">{c.backToList}</Button> : undefined} />;
  }
  const d = q.data;
  return (
    <article>
      <div className={styles.articleHead}>
        <span className="eyebrow">{c.crumb}</span>
        <h2>{d.title}</h2>
        <p className={styles.articleMeta}>{formatDate(d.regDate)} · <TypeLabel small tone={d.status === 'B' ? 'mint' : 'warm'}>{d.statusLabel}</TypeLabel></p>
      </div>
      {d.hasFile ? (
        <div className={styles.attach}>
          <b>{c.file}</b><br />
          {d.downloadUrl
            ? <button type="button" className={styles.fileLink} onClick={() => { setDlError(''); downloadLearnerFile(d.downloadUrl!, d.fileName ?? 'file').catch((e: unknown) => setDlError(isAppError(e) ? e.message : copy.form.fail)); }}><Icon name="download" size={14} />{d.fileName}</button>
            : <span className="muted"><Icon name="file" size={14} /> {d.fileName} — {c.downloadPending}</span>}
        </div>
      ) : null}
      <div className={styles.articleBody}><LegacyHtml html={d.contents} /></div>
      {d.answer ? (
        <section className={styles.answerBox} aria-label={copy.my.answerTitle}>
          <span className="eyebrow">{copy.my.answerTitle}</span>
          <b>{c.answerBy(d.answer.name)}</b>
          <small>{formatDate(d.answer.regDate)}</small>
          <LegacyHtml html={d.answer.contents} />
        </section>
      ) : null}
      <FormMessage>{dlError}</FormMessage>
      <div className="action-row"><Button variant="secondary" square size="sm" to="/support/archiving" icon={<Icon name="arrow-left" size={14} />}>{c.backToList}</Button></div>
    </article>
  );
}
