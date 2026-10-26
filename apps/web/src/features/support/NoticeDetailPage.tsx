import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import styles from './Support.module.css';
import { publicFileUrl, supportApi } from '../../shared/api/endpoints/support';
import { isAppError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StateBlock } from '../../shared/ui/StateBlock';
import { TypeLabel } from '../../shared/ui/Pill';
import { support as copy } from '../../shared/strings/ko';
import { formatDate } from '../../shared/utils/format';
import { LegacyHtml } from '../../shared/ui/LegacyHtml';

/** notice_view.html: title (공지 label), 등록일 · 조회, attachments (include/download.php → API file route), body. */
export default function NoticeDetailPage() {
  const c = copy.notice;
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['support', 'notice', id], queryFn: ({ signal }) => supportApi.notice(id, signal), enabled: /^\d+$/.test(id) });
  if (!/^\d+$/.test(id)) return <StateBlock code="NOT_FOUND" center />;
  if (q.isPending) return <Skeleton lines={6} />;
  if (q.isError) {
    const code = isAppError(q.error) && q.error.status === 404 ? 'NOT_FOUND' : 'LIST_ERROR';
    return <StateBlock code={code} center onRetry={() => void q.refetch()} actions={code === 'NOT_FOUND' ? <Button variant="secondary" square size="sm" to="/support/notice">{c.backToList}</Button> : undefined} />;
  }
  const n = q.data;
  return (
    <article>
      <div className={styles.articleHead}>
        <span className="eyebrow">{c.title}</span>
        <h2>{n.pinned ? <TypeLabel small>{c.pinned}</TypeLabel> : null} {n.title}</h2>
        <p className={styles.articleMeta}>{c.meta(formatDate(n.regDate), n.viewCount ?? 0)}</p>
      </div>
      {n.attachments.length > 0 ? (
        <div className={styles.attach}><b>{c.attachments}</b><br />{n.attachments.map((a) => <a key={a.slot} href={publicFileUrl(a.url)} download={a.name} rel="noopener"><Icon name="download" size={14} />{a.name}</a>)}</div>
      ) : null}
      <div className={styles.articleBody}><LegacyHtml html={n.content} /></div>
      <div className="action-row">
        <Button variant="secondary" square size="sm" to="/support/notice" icon={<Icon name="arrow-left" size={14} />}>{c.backToList}</Button>
        <Button variant="text" size="sm" to="/support/counsel">{c.related}</Button>
      </div>
    </article>
  );
}
