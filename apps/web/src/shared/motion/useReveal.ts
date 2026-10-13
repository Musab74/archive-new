import { useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { revealChild, revealChildReduced, revealParent } from './variants';

export interface RevealProps { initial: 'hidden'; whileInView: 'show'; viewport: { once: true; margin: string; amount: number }; variants: Variants }

/**
 * Props for a motion parent element that reveals once when scrolled into view.
 * Children use `useRevealChild()` with their index for the 60 ms stagger (max 6).
 */
export function useReveal(opts: { margin?: string; amount?: number } = {}): RevealProps {
  return {
    initial: 'hidden',
    whileInView: 'show',
    viewport: { once: true, margin: opts.margin ?? '0px 0px -40px 0px', amount: opts.amount ?? 0.15 },
    variants: revealParent,
  };
}

export function useRevealChild(): { variants: Variants } {
  const reduced = useReducedMotion();
  return { variants: reduced ? revealChildReduced : revealChild };
}
