import { useEffect, useRef, useState } from 'react';
import { useReducedMotionConfig } from 'framer-motion';

/** Animates 0 → target over `duration` ms (ease-out) after an optional `delay` ms. Jumps straight to target with prefers-reduced-motion. */
export function useCountUp(target: number, opts: { duration?: number; enabled?: boolean; delay?: number } = {}): number {
  const { duration = 900, enabled = true, delay = 0 } = opts;
  const reduced = useReducedMotionConfig();
  const [value, setValue] = useState(reduced || !enabled ? target : 0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || !enabled || typeof requestAnimationFrame === 'undefined') { setValue(target); return; }
    const from = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    const timer = delay > 0 ? setTimeout(() => { raf.current = requestAnimationFrame(step); }, delay) : null;
    if (!timer) raf.current = requestAnimationFrame(step);
    return () => { if (timer) clearTimeout(timer); if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration, enabled, reduced, delay]);

  return value;
}
