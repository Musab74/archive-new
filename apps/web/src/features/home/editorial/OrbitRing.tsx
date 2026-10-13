import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { motionValue, useAnimationFrame, useReducedMotionConfig } from 'framer-motion';
import styles from './OrbitRing.module.css';
import { cx } from '../../../shared/utils/format';
import { OrbitBadge, type BadgeMotion, type OrbitBadgeSpec } from './OrbitBadge';
import { ORBIT, type OrbitClock } from './useOrbitClock';
import { arcPoint, arcWindow, badgeU, clamp01, easeMidFast, endFade, laneRadius, lerp, ringGeomFromVars, speedAt, tangentDeg, type Box, type RingGeom, type RingVars } from './orbitMath';

const DEFAULT_BOX: Box = { w: 600, h: 640 };
const DEFAULT_VARS: RingVars & { d: number; insetTop: number } = { r: 620, w: 170, cxOff: 260, cyFrac: 0.5, d: 56, insetTop: 82 };

/** Geometry CSS variables from the ring box (breakpoints change them); JS defaults when unavailable (jsdom, pre-paint). */
function readVars(el: HTMLElement): RingVars & { d: number; insetTop: number } {
  if (typeof getComputedStyle === 'undefined') return DEFAULT_VARS;
  const cs = getComputedStyle(el);
  const num = (name: string, fallback: number) => { const v = parseFloat(cs.getPropertyValue(name)); return Number.isFinite(v) ? v : fallback; };
  return { r: num('--ring-r', DEFAULT_VARS.r), w: num('--ring-w', DEFAULT_VARS.w), cxOff: num('--ring-cx-off', DEFAULT_VARS.cxOff), cyFrac: num('--ring-cy', DEFAULT_VARS.cyFrac), d: num('--badge-d', DEFAULT_VARS.d), insetTop: num('--ring-inset-top', DEFAULT_VARS.insetTop) };
}

const makeMotion = (): BadgeMotion => ({ x: motionValue(0), y: motionValue(0), o: motionValue(0), s: motionValue(1), rot: motionValue(0), sx: motionValue(1), so: motionValue(0) });

export interface OrbitRingProps { badges: OrbitBadgeSpec[]; clock: OrbitClock; className?: string }

/**
 * The hero ring: ONE SVG circle (flat taupe band, centre off-canvas right) plus badges that travel down its left arc
 * in an endless conveyor. One frame loop drives per-badge MotionValues (transforms/opacity only). Hover or keyboard
 * focus inside the ring slows the loop; reduced motion renders ~3 static badges with no streaks.
 */
export function OrbitRing({ badges, clock, className }: OrbitRingProps) {
  const reduced = useReducedMotionConfig();
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box>(DEFAULT_BOX);
  const [vars, setVars] = useState(DEFAULT_VARS);
  const inViewRef = useRef(true);
  const n = badges.length;
  const motions = useMemo(() => Array.from({ length: n }, makeMotion), [n]);

  // measure (ResizeObserver when available; otherwise once on mount)
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox(r.width > 10 && r.height > 10 ? { w: r.width, h: r.height } : DEFAULT_BOX);
      setVars(readVars(el));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // idle when scrolled away (assume visible when IntersectionObserver is missing)
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => { for (const e of entries) inViewRef.current = e.isIntersecting; }, { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const geom = useMemo(() => {
    const g: RingGeom = ringGeomFromVars(vars, box);
    const win = arcWindow(g, g.r, box, vars.d, 256, vars.insetTop);
    return { g, ...win };
  }, [vars, box]);

  const lastSpeed = useRef(-1);
  useAnimationFrame((_, deltaMs) => {
    if (reduced || !inViewRef.current || (typeof document !== 'undefined' && document.hidden)) return;
    const speed = clock.speed.get();
    const cycleDur = ORBIT.passDur / ORBIT.visFrac;
    clock.phaseRef.current = (clock.phaseRef.current + ((Math.min(deltaMs, 64) / 1000) * speed) / cycleDur) % 1;
    const { g, phiStart, phiEnd } = geom;
    const half = vars.d / 2;
    for (let i = 0; i < n; i++) {
      const mv = motions[i]!;
      const u = badgeU(clock.phaseRef.current, i, n);
      if (u >= ORBIT.visFrac) { mv.o.set(0); mv.so.set(0); continue; }
      const t = u / ORBIT.visFrac;
      const phi = lerp(phiStart, phiEnd, easeMidFast(t));
      const lane = badges[i]!.lane;
      const p = arcPoint(g, laneRadius(g, lane), phi);
      const fade = endFade(t);
      const inner = lane === 'inner';
      mv.x.set(p.x - half);
      mv.y.set(p.y - half);
      mv.o.set(fade * (inner ? 0.85 : 1));
      mv.s.set(inner ? 0.86 : 1);
      mv.rot.set(tangentDeg(phi) + 180);
      const v = speed * speedAt(t);
      mv.sx.set(Math.min(3, Math.max(0.4, v)));
      mv.so.set(clamp01(v) * fade);
    }
    if (Math.abs(speed - lastSpeed.current) > 0.01 && boxRef.current) { boxRef.current.dataset.speed = speed.toFixed(2); lastSpeed.current = speed; }
  });

  const onBlur = (e: FocusEvent<HTMLDivElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) clock.resume(); };

  // reduced motion: a static snapshot of ~3 badges on the arc, no streaks
  const staticBadges = useMemo(() => {
    if (!reduced) return null;
    const count = Math.ceil(n * ORBIT.visFrac);
    const ts = [0.2, 0.5, 0.8];
    return badges.slice(0, count).map((spec, i) => {
      const t = ts[i % ts.length]!;
      const phi = lerp(geom.phiStart, geom.phiEnd, t);
      const p = arcPoint(geom.g, laneRadius(geom.g, spec.lane), phi);
      const inner = spec.lane === 'inner';
      return { spec, at: { x: p.x - vars.d / 2, y: p.y - vars.d / 2, scale: inner ? 0.86 : 1, opacity: inner ? 0.85 : 1 } };
    });
  }, [reduced, badges, geom, n, vars.d]);

  return (
    <div ref={boxRef} className={cx(styles.box, className)} onPointerEnter={reduced ? undefined : clock.slow} onPointerLeave={reduced ? undefined : clock.resume} onFocusCapture={reduced ? undefined : clock.slow} onBlurCapture={reduced ? undefined : onBlur} data-orbit>
      <svg className={styles.svg} width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true" focusable="false">
        <circle cx={geom.g.cx} cy={geom.g.cy} r={geom.g.r} fill="none" stroke="var(--hero-ring)" strokeWidth={geom.g.w} />
      </svg>
      <ul className={styles.list}>
        {staticBadges
          ? staticBadges.map(({ spec, at }) => <OrbitBadge key={spec.key} spec={spec} staticAt={at} />)
          : badges.map((spec, i) => <OrbitBadge key={spec.key} spec={spec} mv={motions[i]} />)}
      </ul>
    </div>
  );
}
