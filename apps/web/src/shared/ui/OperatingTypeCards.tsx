import { motion } from 'framer-motion';
import styles from './OperatingTypeCards.module.css';
import { TypeLabel } from './Pill';
import { Button } from './Button';
import { Icon } from './Icon';
import { home } from '../strings/ko';
import { cx } from '../utils/format';
import { useReveal, useRevealChild } from '../motion/useReveal';

/** 환급형 / 비환급형 cards (AR-01 `.mode-card`). */
export function OperatingTypeCards() {
  const reveal = useReveal();
  const child = useRevealChild();
  const items = [
    { key: 'refund', tone: 'navy' as const, cls: '', data: home.modes.refund, to: '/support/guide#refund' },
    { key: 'general', tone: 'mint' as const, cls: styles.general, data: home.modes.general, to: '/support/guide#general' },
  ];
  return (
    <motion.div className={styles.grid} {...reveal}>
      {items.map((it, i) => (
        <motion.article key={it.key} className={cx(styles.card, it.cls)} {...child} custom={i}>
          <TypeLabel tone={it.tone}>{it.data.label}</TypeLabel>
          <h3>{it.data.title}</h3>
          <p className={styles.key}>{it.data.key}</p>
          <p>{it.data.p1}</p>
          <p>{it.data.p2}</p>
          <Button variant="text" size="sm" to={it.to} className={styles.link} iconRight={<Icon name="arrow" size={15} />}>{it.data.link}</Button>
        </motion.article>
      ))}
    </motion.div>
  );
}
