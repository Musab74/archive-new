import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import styles from './Toast.module.css';
import { cx } from '../utils/format';
import { Icon } from './Icon';
import { common } from '../strings/ko';
import { fadeVariants, scaleInVariants } from '../motion/variants';

export type ToastTone = 'info' | 'ok' | 'warn' | 'danger';
export interface ToastItem { id: number; title?: string; message: string; tone: ToastTone; duration: number }

export function ToastViewport({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  const reduced = useReducedMotion();
  return (
    <div className={styles.region} aria-live="polite" aria-relevant="additions" role="status">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div key={t.id} layout={!reduced} variants={reduced ? fadeVariants : scaleInVariants} initial="hidden" animate="show" exit="exit" className={cx(styles.toast, t.tone !== 'info' && styles[t.tone])}>
            <span className={styles.icon}><Icon name={t.tone === 'ok' ? 'check' : t.tone === 'info' ? 'info' : 'alert'} size={18} /></span>
            <span className={styles.text}>{t.title ? <span className={styles.title}>{t.title}</span> : null}{t.message}</span>
            <button type="button" className={styles.close} onClick={() => onDismiss(t.id)} aria-label={common.close}><Icon name="close" size={16} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
