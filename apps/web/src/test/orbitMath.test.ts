import { describe, expect, it } from 'vitest';
import { arcPoint, arcWindow, badgeU, easeMidFast, endFade, laneRadius, ringGeomFromVars, speedAt, tangentDeg } from '../features/home/editorial/orbitMath';

const desktop = ringGeomFromVars({ r: 620, w: 170, cxOff: 260, cyFrac: 0.5 }, { w: 660, h: 640 });

describe('orbitMath', () => {
  it('arcPoint: φ=0 is the leftmost point and φ increases downwards', () => {
    expect(arcPoint(desktop, desktop.r, 0)).toEqual({ x: desktop.cx - desktop.r, y: desktop.cy });
    const a = arcPoint(desktop, desktop.r, -0.3);
    const b = arcPoint(desktop, desktop.r, 0.3);
    expect(a.y).toBeLessThan(b.y);
    expect(a.x).toBeCloseTo(b.x, 6);
  });
  it('arcWindow (desktop, centre right of the box) spans above and below the leftmost point and ends near the edges', () => {
    const pad = 56;
    const { phiStart, phiEnd } = arcWindow(desktop, desktop.r, { w: 660, h: 640 }, pad);
    expect(phiStart).toBeLessThan(0);
    expect(phiEnd).toBeGreaterThan(0);
    const top = arcPoint(desktop, desktop.r, phiStart);
    const bottom = arcPoint(desktop, desktop.r, phiEnd);
    expect(Math.abs(top.y - -pad)).toBeLessThan(2);
    expect(Math.abs(bottom.y - (640 + pad))).toBeLessThan(2);
  });
  it('arcWindow (tablet, centre at the top edge) starts at the leftmost point', () => {
    const g = ringGeomFromVars({ r: 420, w: 120, cxOff: 120, cyFrac: 0 }, { w: 900, h: 520 });
    const { phiStart, phiEnd } = arcWindow(g, g.r, { w: 900, h: 520 }, 48);
    expect(phiStart).toBeGreaterThan(-0.2);
    expect(phiStart).toBeLessThan(0.05);
    expect(phiEnd).toBeGreaterThan(phiStart);
  });
  it('arcWindow (mobile quarter-arc) still yields a non-empty window', () => {
    const g = ringGeomFromVars({ r: 240, w: 70, cxOff: 60, cyFrac: -0.15 }, { w: 390, h: 520 });
    const { phiStart, phiEnd } = arcWindow(g, g.r, { w: 390, h: 520 }, 40);
    expect(phiEnd - phiStart).toBeGreaterThan(0.3);
  });
  it('easeMidFast is anchored and monotonic; speed peaks mid-arc', () => {
    expect(easeMidFast(0)).toBeCloseTo(0, 9);
    expect(easeMidFast(1)).toBeCloseTo(1, 9);
    let prev = -1;
    for (let i = 0; i <= 1000; i++) { const v = easeMidFast(i / 1000); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
    expect(speedAt(0.5)).toBeGreaterThan(speedAt(0));
    expect(speedAt(0)).toBeCloseTo(0.65, 6);
    expect(speedAt(0.5)).toBeCloseTo(1.35, 6);
  });
  it('endFade, badgeU, laneRadius, tangentDeg', () => {
    expect(endFade(0)).toBe(0);
    expect(endFade(1)).toBe(0);
    expect(endFade(0.5)).toBe(1);
    expect(endFade(0.05)).toBeCloseTo(0.5, 6);
    expect(badgeU(0.9, 1, 4)).toBeCloseTo(0.15, 9);
    expect(badgeU(0.1, 0, 4)).toBeCloseTo(0.1, 9);
    expect(laneRadius(desktop, 'inner')).toBeLessThan(laneRadius(desktop, 'outer'));
    expect(tangentDeg(0)).toBeCloseTo(90, 6); // at the leftmost point travel is straight down (+y)
  });
});
