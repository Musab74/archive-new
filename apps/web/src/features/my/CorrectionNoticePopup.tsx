import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './My.module.css';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { Button } from '../../shared/ui/Button';
import { Modal } from '../../shared/ui/Modal';
import { my as copy } from '../../shared/strings/ko';
import { hm } from '../../shared/player/time';
import { qk } from './queries';

const c = copy.home;

/**
 * sections/correction-notice-popup.php (included on every 나의학습실 page, lecture_status.html:4870): the learner's unacknowledged
 * StudyCorrectionNotice row as a blocking modal with the PHP copy; the button or ESC acknowledges it (POST /my/notices/ack).
 */
export default function CorrectionNoticePopup() {
  const qc = useQueryClient();
  const notices = useQuery({ queryKey: qk.notices, queryFn: ({ signal }) => myRoomApi.notices(signal), staleTime: 60_000 });
  const [closed, setClosed] = useState(false);
  const ack = useMutation({ mutationFn: () => myRoomApi.ackNotices(), onSettled: () => void qc.invalidateQueries({ queryKey: qk.notices }) });
  const pending = notices.data?.items.find((n) => !n.acknowledged) ?? null;
  const close = () => { setClosed(true); ack.mutate(); };
  return (
    <Modal open={!!pending && !closed} onClose={close} title={c.correction.title} symbol="info" actions={<Button square onClick={close} loading={ack.isPending}>{c.correction.ack}</Button>}>
      <p>{c.correction.lead}</p>
      <p className={styles.alert} style={{ margin: '12px 0' }}><b>{c.correction.box(pending?.delta?.label ?? hm(Math.abs(pending?.totalDeltaSec ?? 0)))}</b></p>
      <p className={styles.note}>{c.correction.rule}</p>
      <p className={styles.note}>{c.correction.scope}</p>
      {pending?.appliedAt ? <p className={styles.note}>{c.correction.appliedAt(pending.appliedAt)}</p> : null}
      <p className={styles.note}>{c.correction.contact} <Link to="/my/notices" onClick={() => setClosed(true)}>{c.noticeDetail}</Link></p>
    </Modal>
  );
}
