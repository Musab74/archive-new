import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import styles from './Support.module.css';
import { downloadLearnerFile, supportApi } from '../../shared/api/endpoints/support';
import { isAppError } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { Button } from '../../shared/ui/Button';
import { FormMessage } from '../../shared/ui/Form';
import { Icon } from '../../shared/ui/Icon';
import { LegacyHtml } from '../../shared/ui/LegacyHtml';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StateBlock } from '../../shared/ui/StateBlock';
import { TypeLabel } from '../../shared/ui/Pill';
import { support as copy } from '../../shared/strings/ko';
import { formatDate } from '../../shared/utils/format';

/** ask_view.html: own question + attachment; the answer block (Contents2) with its files once staff answered. */
export default function CounselDetailPage() {
  const c = copy.my;
  const { id = '' } = useParams();
  const { isAuthed, phase } = useSession();
  const [dlError, setDlError] = useState('');
  const q = useQuery({ queryKey: ['support', 'counsel', 'detail', id], queryFn: ({ signal }) => supportApi.counsel(id, signal), enabled: isAuthed && /^\d+$/.test(id) });
  if (phase !== 'booting' && !isAuthed) return <StateBlock code="LOGIN" center title={c.loginNeeded} />;
  if (!/^\d+$/.test(id)) return <StateBlock code="NOT_FOUND" center />;
  if (q.isPending) return <Skeleton lines={6} />;
  if (q.isError) {
    const code = isAppError(q.error) && q.error.status === 404 ? 'NOT_FOUND' : isAppError(q.error) && q.error.isAuth ? 'SESSION_EXPIRED' : 'LIST_ERROR';
    return <StateBlock code={code} center onRetry={() => void q.refetch()} actions={code === 'NOT_FOUND' ? <Button variant="secondary" square size="sm" to="/support/my">{c.backToList}</Button> : undefined} />;
  }
  const t = q.data;
  const download = (url: string, name: string) => { setDlError(''); downloadLearnerFile(url, name).catch((e: unknown) => setDlError(isAppError(e) ? e.message : copy.form.fail)); };
  return (
    <article>
      <div className={styles.articleHead}>
        <span className="eyebrow">{c.title}</span>
        <h2>{t.title}</h2>
        <p className={styles.articleMeta}>{c.meta(t.categoryName ?? '', formatDate(t.regDate))} · <TypeLabel small tone={t.status === 'B' ? 'mint' : 'warm'}>{t.statusLabel}</TypeLabel></p>
        {t.courseName || t.lectureCode ? <p className={styles.articleMeta}>{c.course}: {t.courseName ?? t.lectureCode}</p> : null}
      </div>
      {t.studentFile ? (
        <div className={styles.attach}><b>{c.studentFile}</b><br /><button type="button" className={styles.fileLink} onClick={() => download(t.studentFile!.url, t.studentFile!.name)}><Icon name="download" size={14} />{t.studentFile.name}</button></div>
      ) : null}
      <h3 className={styles.subTitle}>{c.question}</h3>
      <div className={styles.articleBody}><LegacyHtml html={t.contents} /></div>
      {t.answer ? (
        <section className={styles.answerBox} aria-label={c.answerTitle}>
          <span className="eyebrow">{c.answerTitle}</span>
          <b>{c.answerBy(t.answer.name)}</b>
          <small>{formatDate(t.answer.regDate)}</small>
          <LegacyHtml html={t.answer.contents} />
          {t.answer.attachments.length ? (
            <div className={styles.attach}><b>{c.answerFiles}</b><br />{t.answer.attachments.map((a) => <button key={a.slot} type="button" className={styles.fileLink} onClick={() => download(a.url, a.name)}><Icon name="download" size={14} />{a.name}</button>)}</div>
          ) : null}
        </section>
      ) : <div className={styles.note}>{c.waiting}</div>}
      <FormMessage>{dlError}</FormMessage>
      <div className="action-row">
        <Button variant="secondary" square size="sm" to="/support/my" icon={<Icon name="arrow-left" size={14} />}>{c.backToList}</Button>
      </div>
    </article>
  );
}
