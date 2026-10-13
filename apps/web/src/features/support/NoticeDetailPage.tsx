import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import styles from './Support.module.css';
import { supportApi } from '../../shared/api/endpoints/support';
import { isAppError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StateBlock } from '../../shared/ui/StateBlock';
import { support as copy } from '../../shared/strings/ko';
import { formatDate } from '../../shared/utils/format';
import { LegacyHtml } from '../../shared/ui/LegacyHtml';

export default function NoticeDetailPage() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['support', 'notice', id], queryFn: ({ signal }) => supportApi.notice(id, signal), enabled: !!id });
  if (q.isPending) return <Skeleton lines={6} />;
  if (q.isError) {
    const code = isAppError(q.error) && q.error.status === 404 ? 'NOT_FOUND' : isAppError(q.error) && q.error.status === 403 ? 'NO_ACCESS' : 'LIST_ERROR';
    return <StateBlock code={code} center onRetry={() => void q.refetch()} />;
  }
  const n = q.data;
  return (
    <article>
      <div className={styles.articleHead}>
        <span className="eyebrow">{n.category ?? copy.notice.title}</span>
        <h2>{n.title}</h2>
        <p className={styles.articleMeta}>{formatDate(n.regDate)}{n.viewCount !== undefined ? ` · 조회 ${n.viewCount.toLocaleString('ko-KR')}` : ''}</p>
      </div>
      <div className={styles.articleBody}><LegacyHtml html={n.contents ?? ''} /></div>
      {n.attachments && n.attachments.length > 0 ? (
        <div className={styles.attach}><b>{copy.notice.attachments}</b><br />{n.attachments.map((a) => <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer"><Icon name="file" size={14} />{a.name}</a>)}</div>
      ) : null}
      <div className="action-row">
        <Button variant="secondary" square size="sm" to="/support/notice" icon={<Icon name="arrow-left" size={14} />}>{copy.notice.backToList}</Button>
        <Button variant="text" size="sm" to="/support/counsel">{copy.notice.related}</Button>
      </div>
    </article>
  );
}
