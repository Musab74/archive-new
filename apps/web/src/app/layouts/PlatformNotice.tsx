import { useQuery } from '@tanstack/react-query';
import styles from './PlatformNotice.module.css';
import { platformApi } from '../../shared/api/endpoints/platform';
import { platform as copy } from '../../shared/strings/ko';

/**
 * On a copy of the production database (API DATA_COPY_MODE) every screen — learner, manager, admin — carries this notice, so study
 * or edits there are never taken for real records. Nothing is shown on production or when the API does not answer.
 */
export function PlatformNotice() {
  const info = useQuery({ queryKey: ['public', 'platform'], queryFn: ({ signal }) => platformApi.info(signal), staleTime: Infinity, retry: false });
  if (info.data?.dataMode !== 'copy') return null;
  return (
    <div className={styles.notice} role="status">
      <strong>{copy.label}</strong>
      <span>{info.data.notice}{info.data.snapshotAt ? ` ${copy.snapshot(info.data.snapshotAt)}` : ''}</span>
    </div>
  );
}
