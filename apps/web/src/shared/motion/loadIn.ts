import { useReducedMotionConfig } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { motionTokens as m } from './tokens';

/** Mount-time stagger (above-the-fold hero): parent `animate`s on mount, children rise 12 px + fade, 80 ms apart. */
export const loadInParent = (delayChildren = 0, stagger = 0.08): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
});
export const loadInChild: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: m.ease } },
};
export const loadInChildReduced: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: m.dur.fast } } };

export interface LoadInProps { initial: 'hidden'; animate: 'show'; variants: Variants }

/** Props for the parent; `child` is the variants object for each staggered child. */
export function useLoadIn(delay = 0, stagger = 0.08): { parent: LoadInProps; child: { variants: Variants } } {
  const reduced = useReducedMotionConfig();
  return {
    parent: { initial: 'hidden', animate: 'show', variants: loadInParent(reduced ? 0 : delay, reduced ? 0 : stagger) },
    child: { variants: reduced ? loadInChildReduced : loadInChild },
  };
}
