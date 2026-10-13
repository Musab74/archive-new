import { useEffect, useId, useState, type ReactNode } from 'react';
import styles from './admin.module.css';
import { cx } from '../../utils/format';
import { Modal } from '../Modal';

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'info' | 'warn' | 'danger';
  /** Show a reason textarea; when `reasonRequired` the confirm button stays disabled until it is filled. */
  reason?: boolean;
  reasonRequired?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  loading?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/** Confirmation modal with an optional reason field (audit note). */
export function ConfirmDialog({ open, title, body, confirmLabel = '확인', cancelLabel = '취소', tone = 'warn', reason, reasonRequired, reasonLabel = '사유', reasonPlaceholder = '처리 사유를 입력하세요', loading, onConfirm, onCancel }: ConfirmDialogProps) {
  const [text, setText] = useState('');
  const id = useId();
  useEffect(() => { if (open) setText(''); }, [open]);
  const disabled = loading || (!!reason && !!reasonRequired && text.trim().length === 0);
  return (
    <Modal open={open} onClose={onCancel} title={title} symbol={tone === 'info' ? 'info' : 'alert'} symbolTone={tone === 'info' ? 'info' : 'warn'}
      actions={<>
        <button type="button" className={styles.btn} onClick={onCancel} disabled={loading}>{cancelLabel}</button>
        <button type="button" className={cx(styles.btn, tone === 'danger' ? styles.btnDanger : styles.btnPrimary)} onClick={() => onConfirm(text.trim())} disabled={disabled} aria-busy={loading || undefined}>{loading ? '처리 중…' : confirmLabel}</button>
      </>}>
      {body}
      {reason ? (
        <div className={cx(styles.field, 'u-mt-16')}>
          <label htmlFor={id}>{reasonLabel}{reasonRequired ? ' *' : ''}</label>
          <textarea id={id} className={cx(styles.input, styles.textarea)} value={text} onChange={(e) => setText(e.target.value)} placeholder={reasonPlaceholder} rows={3} maxLength={500} />
        </div>
      ) : null}
    </Modal>
  );
}
