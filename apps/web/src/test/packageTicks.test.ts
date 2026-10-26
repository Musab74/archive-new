import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressTick } from '@ainex/contracts';
import { TickScheduler, type TickStep } from '../shared/player/tickScheduler';
import { ElapsedCounter, packageTickPosition } from '../shared/player/packageSource';
import { initialPlayerState, playerReducer } from '../shared/player/playerReducer';
import { tickBody } from '../features/player/usePlayerEngine';
import type { PlayerDescriptor } from '../shared/api/schemas';

const packageDescriptor = (resumeSec = 0): PlayerDescriptor => ({
  playToken: 'tok',
  study: { seq: 7, lectureCode: 'ARC2026', serviceType: 'A', mode: 'REFUND', lectureStart: '2026-10-02', lectureEnd: '2026-12-31', passOk: false },
  contentLectureCode: 'B0502',
  chapter: { chapterSeq: 501, number: 1, title: '1차시', minutes: 30, contentsIdx: 88, contentsDetailSeq: 880, contentsType: 'A', url: '/contents/B/05/B0502/001/01/index.html', mobileUrl: null, progress: 0, studyTime: 0, lastStudy: null, total: 3, completeTimeSec: 1800 },
  chapters: [],
  resume: { positionSec: resumeSec, studyTimeSec: 0 },
  totals: { recognizedSec: 0, todaySec: 0, dailyCapSec: 28800, dailyCapClientStopSec: 28770 },
  gates: { identity: 'ok', dailyCapReached: false, dailyCapApplies: true, alreadyDone: false },
  tick: { intervalMs: 60000, heartbeatMs: 60000, idleTimeoutMs: 7200000 },
  identityUrl: null,
  review: { mine: 0 },
  assessment: { postDone: false },
});

const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('type A ticks', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('tickBody carries progressTime (0 by default, floored otherwise)', () => {
    const d = packageDescriptor();
    expect(tickBody(d, 'Middle', 309, 'tok')).toMatchObject({ positionSec: 309, progressTime: 0, chapterNumber: '1', completeTime: 1800 });
    expect(tickBody(d, 'Middle', 0, 'tok', 650.7)).toMatchObject({ positionSec: 0, progressTime: 650 });
  });

  it('scheduler + elapsed counter: no playhead → positionSec 0 / progressTime = resume base + elapsed; playhead detected → positionSec / progressTime 0', async () => {
    const d = packageDescriptor(600);
    const sent: ProgressTick[] = [];
    let playhead: number | null = null;
    const counter = new ElapsedCounter({ idleMs: 10 * 60_000 }); // idle gating is covered in packageSource.test.ts
    const pair = () => packageTickPosition(playhead, counter.seconds, d.resume.positionSec);
    const s = new TickScheduler<{ ok: true }>({
      intervalMs: d.tick.intervalMs,
      getPosition: () => pair().positionSec,
      getProgressTime: () => pair().progressTime,
      send: (step: TickStep, pos, pt) => { sent.push(tickBody(d, step, pos, d.playToken, pt)); return Promise.resolve({ ok: true as const }); },
    });
    counter.start(); s.start();
    await flush();
    expect(sent[0]).toMatchObject({ progressStep: 'Start', positionSec: 0, progressTime: 600 });

    await vi.advanceTimersByTimeAsync(60_000); // elapsed 60 s, still no playhead
    expect(sent[1]).toMatchObject({ progressStep: 'Middle', positionSec: 0, progressTime: 660 });

    playhead = 309; // package exposes .time1 .playerText "05:09"
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sent[2]).toMatchObject({ progressStep: 'Middle', positionSec: 309, progressTime: 0 });

    playhead = null; // lost again (e.g. package navigated to a page without a clock) → back to the fallback, still cumulative
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sent[3]).toMatchObject({ progressStep: 'Middle', positionSec: 0, progressTime: 780 });

    s.end();
    await flush();
    expect(sent[4]).toMatchObject({ progressStep: 'End', positionSec: 0, progressTime: 780 });
    counter.dispose(); s.dispose();
  });

  it('the beacon End carries the same pair', async () => {
    const d = packageDescriptor(100);
    const beacon = vi.fn((_step: TickStep, _pos: number, _pt: number) => true);
    const s = new TickScheduler<{ ok: true }>({ intervalMs: 60_000, getPosition: () => 0, getProgressTime: () => 130, send: () => Promise.resolve({ ok: true as const }), beacon });
    s.start();
    await flush();
    s.end({ beacon: true });
    expect(beacon).toHaveBeenCalledWith('End', 0, 130, '');
    expect(tickBody(d, 'End', 0, d.playToken, 130).progressTime).toBe(130);
  });

  it('reducer tracks the package source for the status line', () => {
    const opened = [{ type: 'OPEN' as const }, { type: 'OPENED' as const, descriptor: packageDescriptor() }].reduce(playerReducer, initialPlayerState);
    expect(opened.packageSource).toBeNull();
    const elapsed = playerReducer(opened, { type: 'PACKAGE_SOURCE', source: 'elapsed' });
    expect(elapsed.packageSource).toBe('elapsed');
    expect(playerReducer(elapsed, { type: 'PACKAGE_SOURCE', source: 'elapsed' })).toBe(elapsed); // no churn
    expect(playerReducer(elapsed, { type: 'PACKAGE_SOURCE', source: 'playhead' }).packageSource).toBe('playhead');
    expect(playerReducer(elapsed, { type: 'OPEN' }).packageSource).toBeNull();
  });
});
