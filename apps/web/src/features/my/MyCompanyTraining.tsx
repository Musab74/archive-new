import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './My.module.css';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { isAppError } from '../../shared/api/client';
import { useToast } from '../../app/providers/ToastProvider';
import { Button } from '../../shared/ui/Button';
import { Modal, Dialog } from '../../shared/ui/Modal';
import { FormField, Input, Textarea } from '../../shared/ui/Form';
import { StateBlock } from '../../shared/ui/StateBlock';
import { LegacyHtml } from '../../shared/ui/LegacyHtml';
import { Skeleton } from '../../shared/ui/Skeleton';
import { my as copy } from '../../shared/strings/ko';
import { cx } from '../../shared/utils/format';

const c = copy.company;
const a = c.archive;
const EXT = ['mp4', 'vod', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'hwp'];
const MAX = 52_428_800;
/** strcut_utf8($Title, 50): 47 characters + "..." when longer than 50; empty → "-". */
const cut = (t: string) => (!t ? '-' : [...t].length > 50 ? `${[...t].slice(0, 47).join('')}...` : t);

/**
 * AR-15 기업자체교육 = the old "기업자체교육(아카이빙)" tab (tab-company.php): the learner's own Archiving requests (list, register with an
 * optional file, detail with the admin answer, download once 완료). A per-company list of provided training (storyboard AR-15 cards)
 * has no table in hrdeArchive and is shown as not available.
 */
export default function MyCompanyTraining() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const list = useQuery({ queryKey: ['my', 'archiving'], queryFn: ({ signal }) => myRoomApi.archiving(signal) });
  const [openForm, setOpenForm] = useState(false);
  const [detailIdx, setDetailIdx] = useState<number | null>(null);
  const detail = useQuery({ queryKey: ['my', 'archiving', detailIdx], queryFn: ({ signal }) => myRoomApi.archivingDetail(detailIdx!, signal), enabled: detailIdx !== null });
  if (list.isError && isAppError(list.error) && list.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  const canWrite = !!list.data?.writesOpen;

  return (
    <div className={styles.page}>
      <div className={styles.head}><div><span className="eyebrow">{copy.crumb}</span><h1>{c.title}</h1><p>{c.lead}</p></div><Button variant="secondary" square size="sm" to="/my">{copy.nav.home} →</Button></div>
      <section className={cx(styles.card, styles.soft)}>
        <h2>{a.introTitle}</h2>
        <p className={styles.note} style={{ fontSize: 13 }}>{a.intro}</p>
        <h3 style={{ fontSize: 14, margin: '14px 0 6px' }}>{a.noticesTitle}</h3>
        {a.notices.map((n) => <p key={n} className={styles.note}>· {n}</p>)}
        <p className={styles.note} style={{ marginTop: 8 }}>{c.heroBody}</p>
      </section>

      <section className={styles.card} aria-labelledby="arc-h">
        <div className={styles.cardHead}><h2 id="arc-h">{a.listTitle}</h2><Button square size="sm" onClick={() => setOpenForm(true)} disabled={!canWrite}>{a.register}</Button></div>
        {!canWrite && list.data ? <p className={styles.note} style={{ marginBottom: 10 }}>{a.readOnly}</p> : null}
        {list.isPending ? <Skeleton lines={4} /> : list.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void list.refetch()} /> : list.data.items.length === 0 ? (
          <p className={styles.note}>{a.empty}</p>
        ) : (
          <table className={styles.table}>
            <thead><tr><th scope="col" className={styles.num}>{a.cols.no}</th><th scope="col">{a.cols.title}</th><th scope="col">{a.cols.regDate}</th><th scope="col">{a.cols.type}</th><th scope="col">{a.cols.status}</th></tr></thead>
            <tbody>
              {list.data.items.map((r, i) => (
                <tr key={r.idx}>
                  <td className={styles.num}>{i + 1}</td>
                  <td><button type="button" className="text-link" onClick={() => setDetailIdx(r.idx)}>{cut(r.title)}</button></td>
                  <td>{r.regDate || '-'}</td>
                  <td>{r.fileType}</td>
                  <td><span className={cx(styles.pill, r.status === 'B' ? styles.pillOk : styles.pillWarn)}>{r.statusText}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.card} aria-labelledby="ct-h">
        <h2 id="ct-h">{c.blockedTitle}</h2>
        <p className={styles.note}>{c.blockedBody}</p>
        <div className="action-row"><Button variant="secondary" square size="sm" to="/my/records">{copy.nav.records}</Button><Button variant="secondary" square size="sm" to="/support/counsel">{c.inquiry}</Button></div>
      </section>
      <p className={styles.note}>{c.note}</p>

      <RegisterModal open={openForm} uploadReady={!!list.data?.uploadReady} onClose={() => setOpenForm(false)} onDone={() => { setOpenForm(false); toast(a.done, { tone: 'ok' }); void qc.invalidateQueries({ queryKey: ['my', 'archiving'] }); }} />
      <Modal open={detailIdx !== null} onClose={() => setDetailIdx(null)} title={a.detailTitle} actions={<Button square variant="secondary" onClick={() => setDetailIdx(null)}>{a.close}</Button>}>
        {detail.isPending ? <Skeleton lines={4} /> : detail.isError ? <p role="alert" className={styles.note}>{isAppError(detail.error) && detail.error.status === 404 ? a.loadFail : a.loadError}</p> : (
          <div className={styles.formGrid}>
            <dl className={styles.kv}>
              <div><dt>{a.form.title}</dt><dd>{detail.data.title}</dd></div>
              <div><dt>{a.cols.regDate}</dt><dd>{detail.data.regDate}</dd></div>
              <div><dt>{a.cols.status}</dt><dd>{detail.data.statusText}</dd></div>
            </dl>
            <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 14 }}>{detail.data.content}</p>
            {detail.data.canDownload ? <div><Button size="sm" square variant="secondary" onClick={() => void myRoomApi.archivingDownload(detail.data.idx, detail.data.fileName ?? 'file').catch((e) => toast(isAppError(e) ? e.message : a.loadError, { tone: 'danger' }))}>{a.download} · {detail.data.fileName}</Button></div> : null}
            {detail.data.status === 'A' ? <p className={styles.note}>{a.downloadWait}</p> : null}
            {detail.data.hasAnswer ? <><h3 style={{ fontSize: 14, margin: 0 }}>{a.answerTitle}</h3><p className={styles.note}>{detail.data.answerName} · {detail.data.answerDate}</p><LegacyHtml html={detail.data.answerContent} /></> : detail.data.status === 'A' ? <p className={styles.note}>{a.answerWait}</p> : null}
          </div>
        )}
      </Modal>
    </div>
  );
}

/** tab-company.php:295-366 + 805-870 register modal: title / content / one file (client checks = the PHP alerts), confirm, POST. */
function RegisterModal({ open, uploadReady, onClose, onDone }: { open: boolean; uploadReady: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = useMutation({
    mutationFn: () => { const f = new FormData(); f.set('title', title); f.set('content', content); if (file) f.set('file', file); return myRoomApi.archivingCreate(f); },
    onSuccess: () => { setTitle(''); setContent(''); setFile(null); onDone(); },
    onError: (e) => toast(isAppError(e) ? e.message : a.fail, { tone: 'danger' }),
    onSettled: () => setConfirm(false),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError(a.need.title);
    if (!content.trim()) return setError(a.need.content);
    if (!file) return setError(a.need.file);
    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
    if (!EXT.includes(ext)) return setError(a.fileTypes);
    if (file.size > MAX) return setError(a.fileSize);
    setError(null); setConfirm(true);
  };
  return (
    <>
      <Modal open={open && !confirm} onClose={onClose} title={a.formTitle} size="lg">
        <form className={styles.formGrid} onSubmit={submit} noValidate>
          <FormField label={a.form.title} required htmlFor="arc-title"><Input id="arc-title" value={title} maxLength={250} placeholder={a.placeholderTitle} onChange={(e) => setTitle(e.target.value)} /></FormField>
          <FormField label={a.form.content} required htmlFor="arc-content"><Textarea id="arc-content" value={content} placeholder={a.placeholderContent} onChange={(e) => setContent(e.target.value)} /></FormField>
          <FormField label={a.form.file} required htmlFor="arc-file" help={uploadReady ? a.fileTypes : a.uploadOff}>
            <input id="arc-file" ref={fileRef} type="file" accept=".mp4,.vod,.pdf,.doc,.docx,.xls,.xlsx,.hwp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={!uploadReady} />
          </FormField>
          <div className={styles.grid2}>
            <div><b style={{ fontSize: 13 }}>{a.examplesTitle}</b>{a.examples.map((x) => <p key={x} className={styles.note}>· {x}</p>)}</div>
            <div><b style={{ fontSize: 13 }}>{a.limitsTitle}</b>{a.limits.map((x) => <p key={x} className={styles.note}>· {x}</p>)}</div>
          </div>
          {error ? <p role="alert" style={{ color: 'var(--c-danger)', fontSize: 13, margin: 0 }}>{error}</p> : null}
          <div className="action-row"><Button square variant="secondary" onClick={onClose}>{a.form.cancel}</Button><Button square type="submit">{a.form.submit}</Button></div>
        </form>
      </Modal>
      <Dialog open={open && confirm} title={a.confirm} confirmLabel={a.form.submit} cancelLabel={a.form.cancel} loading={save.isPending} onCancel={() => setConfirm(false)} onConfirm={() => save.mutate()} />
    </>
  );
}
