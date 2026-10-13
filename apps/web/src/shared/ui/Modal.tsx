import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import styles from './Modal.module.css';
import { cx } from '../utils/format';
import { useFocusTrap } from '../utils/useFocusTrap';
import { useIsMobile } from '../utils/useMediaQuery';
import { fadeVariants, scaleInVariants, sheetVariants } from '../motion/variants';
import { IconButton } from './IconButton';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';
import { common } from '../strings/ko';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Small text above the title (e.g. "스토리보드 연결 확인"). */
  kicker?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  size?: 'md' | 'lg';
  /** Render as a bottom sheet (defaults to sheet on mobile when `responsive`). */
  sheet?: boolean;
  responsive?: boolean;
  /** When false the modal can only be closed with its actions (kick-out / forced flows). */
  dismissible?: boolean;
  symbol?: IconName;
  symbolTone?: 'info' | 'warn' | 'ok';
  labelledBy?: string;
}

/** Accessible dialog: portal, focus trap, Escape/backdrop close, aria-modal, body scroll lock. */
export function Modal({ open, onClose, title, kicker, children, actions, size = 'md', sheet, responsive = true, dismissible = true, symbol, symbolTone = 'info', labelledBy }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();
  const asSheet = sheet ?? (responsive && isMobile);
  const close = useCallback(() => { if (dismissible) onClose(); }, [dismissible, onClose]);
  useFocusTrap(ref, open, close);
  useEffect(() => { if (!open) return; const el = document.getElementById('root'); el?.setAttribute('aria-hidden', 'true'); return () => el?.removeAttribute('aria-hidden'); }, [open]);
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div className={cx(styles.backdrop, asSheet && styles.sheetBackdrop)} variants={fadeVariants} initial="hidden" animate="show" exit="exit" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? (title ? titleId : undefined)} tabIndex={-1} className={cx(styles.modal, size === 'lg' && styles.lg, asSheet && styles.sheet)} variants={reduced ? fadeVariants : asSheet ? sheetVariants : scaleInVariants} initial="hidden" animate="show" exit="exit">
            {asSheet ? <div className={styles.handle} aria-hidden="true" /> : null}
            {(kicker || dismissible) ? (
              <div className={styles.head}>
                <span>{kicker}</span>
                {dismissible ? <IconButton icon="close" label={common.close} size="sm" onClick={onClose} /> : null}
              </div>
            ) : null}
            {symbol ? <div className={cx(styles.symbol, symbolTone === 'warn' && styles.symbolWarn, symbolTone === 'ok' && styles.symbolOk)} aria-hidden="true"><Icon name={symbol} size={27} /></div> : null}
            {title ? <h2 id={titleId} className={styles.title}>{title}</h2> : null}
            {children ? <div className={styles.body}>{children}</div> : null}
            {actions ? <div className={styles.actions}>{actions}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/** Bottom sheet alias. */
export function Sheet(props: Omit<ModalProps, 'sheet'>) { return <Modal {...props} sheet />; }

export interface DialogProps { open: boolean; title: ReactNode; body?: ReactNode; confirmLabel?: string; cancelLabel?: string; onConfirm: () => void; onCancel?: () => void; tone?: 'info' | 'warn' | 'ok'; symbol?: IconName; loading?: boolean; dismissible?: boolean }

/** Confirm dialog with primary/secondary actions. */
export function Dialog({ open, title, body, confirmLabel = common.confirm, cancelLabel, onConfirm, onCancel, tone = 'info', symbol, loading, dismissible = true }: DialogProps) {
  return (
    <Modal open={open} onClose={onCancel ?? onConfirm} title={title} symbol={symbol ?? (tone === 'warn' ? 'alert' : tone === 'ok' ? 'check' : 'info')} symbolTone={tone} dismissible={dismissible && !!onCancel}
      actions={<>
        {onCancel && cancelLabel ? <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button> : null}
        <Button variant="primary" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </>}>
      {body}
    </Modal>
  );
}
