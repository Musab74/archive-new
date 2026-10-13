import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { pageVariants, pageVariantsReduced } from './variants';

/** Wraps routed content: fade + 8 px rise on every pathname change (220 ms), respecting reduced motion. */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const reduced = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={location.pathname} variants={reduced ? pageVariantsReduced : pageVariants} initial="initial" animate="enter" exit="exit" style={{ minHeight: '100%' }}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
