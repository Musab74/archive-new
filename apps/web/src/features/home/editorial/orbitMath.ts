/**
 * Pure geometry for the hero orbit ring. The band is ONE circle centred off-canvas to the right; badges ride its
 * left arc from top to bottom. Angle φ is measured from the circle's leftmost point (φ = 0 → (cx − R, cy)),
 * increasing φ moves DOWN the arc, so the visible left half is φ ∈ (−π/2, π/2) with no wrap-around.
 * No DOM access: everything is analytic, so it is exact, jsdom-safe and shared by the SVG band and the badges.
 */

export interface RingGeom { cx: number; cy: number; r: number; w: number }
export interface Box { w: number; h: number }
export type Lane = 'outer' | 'inner';

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const wrap01 = (v: number): number => v - Math.floor(v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Radius a badge travels on: outer lane slightly outside the band's centreline, inner lane inside (depth). */
export const laneRadius = (g: RingGeom, lane: Lane): number => g.r + (lane === 'outer' ? 0.15 : -0.2) * g.w;

export const arcPoint = (g: RingGeom, radius: number, phi: number): { x: number; y: number } => ({
  x: g.cx - radius * Math.cos(phi),
  y: g.cy + radius * Math.sin(phi),
});

/** Direction of travel (down the arc) in CSS degrees: 0° = +x, 90° = +y. */
export const tangentDeg = (phi: number): number => (Math.atan2(Math.cos(phi), Math.sin(phi)) * 180) / Math.PI;

/** With an `insetTop` (floating header) the window starts AT the inset, so a badge is fully faded before it reaches the header. */
const inside = (p: { x: number; y: number }, box: Box, pad: number, insetTop = 0): boolean => p.x >= -pad && p.x <= box.w + pad && p.y >= (insetTop > 0 ? insetTop : -pad) && p.y <= box.h + pad;

/**
 * The φ-interval of the left arc that lies inside `box` (grown by `pad` so badges fade in/out just outside the edges;
 * `insetTop` keeps the top of the window below the floating header).
 * Works for every breakpoint: centre right of the box (desktop), at the top-right corner (tablet), above-right (mobile).
 */
export function arcWindow(g: RingGeom, radius: number, box: Box, pad: number, samples = 256, insetTop = 0): { phiStart: number; phiEnd: number } {
  const lo = -Math.PI / 2;
  const hi = Math.PI / 2;
  const at = (i: number) => lo + ((hi - lo) * i) / samples;
  let first = -1;
  let last = -1;
  for (let i = 0; i <= samples; i++) {
    if (inside(arcPoint(g, radius, at(i)), box, pad, insetTop)) {
      if (first < 0) first = i;
      last = i;
    } else if (first >= 0) break; // first contiguous run only
  }
  if (first < 0) return { phiStart: -0.2, phiEnd: 0.2 }; // degenerate geometry: a short arc around the leftmost point
  // refine both bounds by bisection between the last outside sample and the first inside one
  const refine = (outside: number, insideP: number): number => {
    let a = outside;
    let b = insideP;
    for (let k = 0; k < 12; k++) {
      const m = (a + b) / 2;
      if (inside(arcPoint(g, radius, m), box, pad, insetTop)) b = m; else a = m;
    }
    return b;
  };
  const phiStart = first === 0 ? lo : refine(at(first - 1), at(first));
  const phiEnd = last === samples ? hi : refine(at(last + 1), at(last));
  return { phiStart, phiEnd };
}

/** Monotonic easing with s(0)=0, s(1)=1: slower near the ends, faster through the middle (a ∈ [0,1)). */
export const easeMidFast = (t: number, a = 0.35): number => t - (a / (2 * Math.PI)) * Math.sin(2 * Math.PI * t);
/** ds/dt of easeMidFast — mean 1, (1 − a) at the ends, (1 + a) mid-arc. Drives streak length. */
export const speedAt = (t: number, a = 0.35): number => 1 - a * Math.cos(2 * Math.PI * t);

/** 0 at both ends of the visible arc, 1 in the middle, ramping over the first/last `ramp` fraction. */
export const endFade = (t: number, ramp = 0.1): number => clamp01(Math.min(t / ramp, (1 - t) / ramp));

/** Cycle position of badge i of n for the shared phase (evenly spaced, wraps 0..1). */
export const badgeU = (phase: number, i: number, n: number): number => wrap01(phase + i / n);

export interface RingVars { r: number; w: number; cxOff: number; cyFrac: number }
/** Ring geometry from the CSS variables on the ring box: centre sits `cxOff` px right of the box, at `cyFrac` of its height. */
export const ringGeomFromVars = (v: RingVars, box: Box): RingGeom => ({ cx: box.w + v.cxOff, cy: box.h * v.cyFrac, r: v.r, w: v.w });
