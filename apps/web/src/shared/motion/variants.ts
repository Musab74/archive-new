import type { Variants } from 'framer-motion';
import { motionTokens as m } from './tokens';

/** Route transition: fade + 8 px rise, 220 ms. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: m.rise.page },
  enter: { opacity: 1, y: 0, transition: { duration: m.dur.base, ease: m.ease } },
  exit: { opacity: 0, y: -m.rise.page / 2, transition: { duration: m.dur.fast, ease: m.ease } },
};
export const pageVariantsReduced: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: m.dur.fast } },
  exit: { opacity: 0, transition: { duration: m.dur.fast } },
};

/** Scroll reveal: 16 px rise; children stagger 60 ms, capped at the 6th child. */
export const revealParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: m.stagger, delayChildren: 0 } },
};
export const revealChild: Variants = {
  hidden: { opacity: 0, y: m.rise.reveal },
  show: (i: number = 0) => ({ opacity: 1, y: 0, transition: { duration: m.dur.slow, ease: m.ease, delay: Math.min(i, m.maxStaggerChildren - 1) * m.stagger } }),
};
export const revealChildReduced: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: m.dur.fast } } };

export const fadeVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: m.dur.base } }, exit: { opacity: 0, transition: { duration: m.dur.fast } } };
export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98, y: 6 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: m.dur.base, ease: m.ease } },
  exit: { opacity: 0, scale: 0.98, y: 6, transition: { duration: m.dur.fast } },
};
export const sheetVariants: Variants = {
  hidden: { y: '100%' },
  show: { y: 0, transition: { duration: m.dur.slow, ease: m.ease } },
  exit: { y: '100%', transition: { duration: m.dur.base, ease: m.ease } },
};
