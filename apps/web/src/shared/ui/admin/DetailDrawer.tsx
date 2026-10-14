import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import styles from './admin.module.css';
import { cx } from '../../utils/format';
import { useT } from '../../i18n/adminLang';
import { useFocusTrap } from '../../utils/useFocusTrap';
import { fadeVariants } from '../../motion/variants';
import { IconButton } from '../IconButton';

export interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

const slide = { hidden: { x: '100%' }, show: { x: 0, transition: { duration: 0.22, ease: [0.2, 0.7, 0.2, 1] } }, exit: { x: '100%', transition: { duration: 0.16 } } } as const;

/** Right-side detail panel (portal, focus trap, Escape/backdrop close). */
export function DetailDrawer({ open, onClose, title, subtitle, children, footer, wide }: DetailDrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const t = useT();
  const reduced = useReducedMotion();
  const close = useCallback(() => onClose(), [onClose]);
  useFocusTrap(ref, open, close);
  useEffect(() => { if (!open) return; const el = document.getElementById('root'); el?.setAttribute('aria-hidden', 'true'); return () => el?.removeAttribute('aria-hidden'); }, [open]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div className={styles.drawerBackdrop} variants={fadeVariants} initial="hidden" animate="show" exit="exit" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={cx(styles.drawer, wide && styles.drawerWide)} variants={reduced ? fadeVariants : slide} initial="hidden" animate="show" exit="exit">
            <div className={styles.drawerHead}>
              <div><h2 id={titleId}>{title}</h2>{subtitle ? <small>{subtitle}</small> : null}</div>
              <IconButton icon="close" label={t('닫기', 'Close')} size="sm" onClick={close} />
            </div>
            <div className={styles.drawerBody}>{children}</div>
            {footer ? <div className={styles.drawerFoot}>{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
