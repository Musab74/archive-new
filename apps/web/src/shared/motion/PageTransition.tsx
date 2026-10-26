import { motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useEffect, useRef, type ReactNode } from 'react';
import { pageVariants, pageVariantsReduced } from './variants';

/**
 * Wraps routed content: fade + 8 px rise on every pathname change (220 ms), respecting reduced motion; no animation on the first
 * page of the visit. There is deliberately no exit phase: with AnimatePresence mode="wait" the fading-out wrapper kept rendering
 * <Outlet/> — already the NEW page — which was then mounted a second time when the fade ended, so whatever the learner typed (or
 * the browser autofilled) in those first ~300 ms was wiped and the page's mount effects and requests ran twice.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const reduced = useReducedMotion();
  const first = useRef(true);
  useEffect(() => { first.current = false; }, []);
  return (
    <motion.div key={location.pathname} variants={reduced ? pageVariantsReduced : pageVariants} initial={first.current ? false : 'initial'} animate="enter" style={{ minHeight: '100%' }}>
      {children}
    </motion.div>
  );
}
