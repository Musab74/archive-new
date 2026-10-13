import { useEffect, useMemo, useRef } from 'react';
import { animate, useMotionValue, type AnimationPlaybackControls, type MotionValue } from 'framer-motion';
import { motionTokens } from '../../../shared/motion/tokens';

/** Orbit tunables: N badges in the cycle, the fraction of the cycle spent on the visible arc, seconds per visible pass. */
export const ORBIT = { n: 6, visFrac: 0.5, passDur: 7, slowSpeed: 0.35, introSpeed: 2.6 } as const;
/** Start the cycle so the first badges sit in the upper third of the arc and visibly settle during the intro. */
export const ORBIT_PHASE0 = ORBIT.visFrac - 0.17;

export interface OrbitClock {
  /** Cycle position 0..1, advanced by the frame loop (shared by every badge). */
  phaseRef: React.MutableRefObject<number>;
  /** Speed multiplier (1 = normal). Hover slows it, the intro boosts it. */
  speed: MotionValue<number>;
  slow: () => void;
  resume: () => void;
  boost: () => void;
}

export function useOrbitClock(initialPhase = ORBIT_PHASE0): OrbitClock {
  const phaseRef = useRef(initialPhase);
  const speed = useMotionValue(1);
  const ctrl = useRef<AnimationPlaybackControls | null>(null);
  useEffect(() => () => { ctrl.current?.stop(); }, []);
  return useMemo(() => {
    const run = (to: number, duration: number, delay = 0) => {
      ctrl.current?.stop();
      ctrl.current = animate(speed, to, { duration, delay, ease: motionTokens.ease });
    };
    return {
      phaseRef,
      speed,
      slow: () => run(ORBIT.slowSpeed, 0.6),
      resume: () => run(1, 0.8),
      boost: () => { speed.set(ORBIT.introSpeed); run(1, 1.3, 0.3); },
    };
  }, [speed]);
}
