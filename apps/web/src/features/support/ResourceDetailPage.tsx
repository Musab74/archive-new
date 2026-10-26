import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './Support.module.css';
import { publicFileUrl, supportApi } from '../../shared/api/endpoints/support';
import { isAppError } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { Button } from '../../shared/ui/Button';
import { FormMessage } from '../../shared/ui/Form';
import { Icon } from '../../shared/ui/Icon';
import { LegacyHtml } from '../../shared/ui/LegacyHtml';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StateBlock } from '../../shared/ui/StateBlock';
import { support as copy } from '../../shared/strings/ko';
import { formatDate } from '../../shared/utils/format';

/** edudata_view.html: 분류, 등록일 · 조회, 첨부파일 (no login needed), body; 찜하기/찜 취소 (edudata_scrap.php) for signed-in learners. */
export default function ResourceDetailPage() {
  const c = copy.resources;
  const { id = '' } = useParams();
  const { isAuthed } = useSession();
  const qc = useQueryClient();
  const valid = /^\d+$/.test(id);
  const q = useQuery({ queryKey: ['support', 'edudata', 'detail', id, isAuthed], queryFn: ({ signal }) => supportApi.eduDataItem(id, signal), enabled: valid });
  const toggle = useMutation({
    mutationFn: (on: boolean) => (on ? supportApi.scrap(Number(id)) : supportApi.unscrap(Number(id))),
    onSuccess: (r) => { qc.setQueryData(['support', 'edudata', 'detail', id, isAuthed], (old: unknown) => (old ? { ...(old as object), scrapped: r.scrapped } : old)); void qc.invalidateQueries({ queryKey: ['support', 'edudata', 'scraps'] }); },
  });
  if (!valid) return <StateBlock code="NOT_FOUND" center />;
  if (q.isPending) return <Skeleton lines={6} />;
  if (q.isError) {
    const code = isAppError(q.error) && q.error.status === 404 ? 'NOT_FOUND' : 'LIST_ERROR';
    return <StateBlock code={code} center onRetry={() => void q.refetch()} actions={code === 'NOT_FOUND' ? <Button variant="secondary" square size="sm" to="/support/resources">{c.backToList}</Button> : undefined} />;
  }
  const d = q.data;
  return (
    <article>
      <div className={styles.articleHead}>
        <span className="eyebrow">{c.title} · {d.categoryName}</span>
        <h2>{d.title}</h2>
        <p className={styles.articleMeta}>{copy.notice.meta(formatDate(d.regDate), d.viewCount ?? 0)}</p>
      </div>
      <div className={styles.attach}>
        <b>{c.attachments}</b><br />
        {d.attachments.length ? d.attachments.map((a) => <a key={a.slot} href={publicFileUrl(a.url)} download={a.name} rel="noopener"><Icon name="download" size={14} />{a.name}</a>) : <span className="muted">{c.noAttachment}</span>}
      </div>
      <div className={styles.articleBody}><LegacyHtml html={d.content} /></div>
      {toggle.isSuccess ? <FormMessage tone="ok">{toggle.data.scrapped ? c.scrapDone : c.unscrapDone}</FormMessage> : null}
      <FormMessage>{toggle.isError ? (isAppError(toggle.error) ? toggle.error.message : copy.form.fail) : ''}</FormMessage>
      <div className="action-row">
        {isAuthed ? <Button square size="sm" variant={d.scrapped ? 'secondary' : 'primary'} icon={<Icon name="heart" size={14} />} loading={toggle.isPending} onClick={() => toggle.mutate(!d.scrapped)} aria-pressed={d.scrapped}>{d.scrapped ? c.unscrap : c.scrap}</Button> : null}
        <Button variant="secondary" square size="sm" to={`/support/resources?category=${encodeURIComponent(d.category)}`} icon={<Icon name="arrow-left" size={14} />}>{c.backToList}</Button>
      </div>
    </article>
  );
}
