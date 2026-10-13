import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ProgressTick } from '@ainex/contracts';
import type { PlayerDescriptor } from '../shared/api/schemas';

const sent: ProgressTick[] = [];
const beaconed: ProgressTick[] = [];
vi.mock('../shared/api/endpoints/player', () => ({
  playerApi: {
    open: vi.fn(() => Promise.resolve(descriptor)),
    close: vi.fn(() => Promise.resolve({ released: true })),
    heartbeat: vi.fn(() => Promise.resolve({ ok: true })),
    tick: vi.fn((body: ProgressTick) => { sent.push(body); return Promise.resolve({ ChkError: 'N', StudyTime: 10, PositionSec: body.positionSec || body.progressTime }); }),
    beaconTick: vi.fn((body: ProgressTick) => { beaconed.push(body); return true; }),
    chapters: vi.fn(),
    dailyTime: vi.fn(),
  },
}));

const descriptor: PlayerDescriptor = {
  playToken: 'tok',
  study: { seq: 7, lectureCode: 'ARC2026', serviceType: 'A', mode: 'REFUND', lectureStart: '2026-10-02', lectureEnd: '2026-12-31', passOk: false },
  contentLectureCode: 'B0502',
  chapter: { chapterSeq: 501, number: 1, title: '1차시', minutes: 30, contentsIdx: 88, contentsDetailSeq: 880, contentsType: 'A', url: '/contents/B/05/B0502/001/01/index.html', mobileUrl: null, progress: 0, studyTime: 0, lastStudy: null, total: 3, completeTimeSec: 1800 },
  chapters: [],
  resume: { positionSec: 300, studyTimeSec: 0 },
  totals: { recognizedSec: 0, todaySec: 0, dailyCapSec: 28800, dailyCapClientStopSec: 28770 },
  gates: { identity: 'ok', dailyCapReached: false, alreadyDone: false },
  tick: { intervalMs: 60000, heartbeatMs: 60000, idleTimeoutMs: 7200000 },
  identityUrl: null,
};

import { usePlayerEngine } from '../features/player/usePlayerEngine';

const target = { studySeq: 7, lectureCode: 'ARC2026', chapterNumber: '1' }; // stable identity, as PlayerPage memoizes it

const fakeIframe = (html: string | null) => {
  const doc = html === null ? null : document.implementation.createHTMLDocument('pkg');
  if (doc && html) doc.body.innerHTML = html;
  return { contentDocument: doc, contentWindow: null } as unknown as HTMLIFrameElement;
};

describe('usePlayerEngine with a type A chapter', () => {
  beforeEach(() => { vi.useFakeTimers(); sent.length = 0; beaconed.length = 0; });
  afterEach(() => { vi.useRealTimers(); });

  it('starts on iframe load, sends progressTime while no playhead is readable and positionSec once one is; End on exit', async () => {
    const { result, unmount } = renderHook(() => usePlayerEngine(target));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.state.phase.kind).toBe('ready');
    expect(result.current.isPackage).toBe(true);
    expect(sent).toEqual([]); // no Start before the frame is loaded

    // Frame loaded but cross-origin / no clock → elapsed fallback, auto-start.
    result.current.iframeRef.current = fakeIframe(null);
    await act(async () => { result.current.onPackageLoaded(); await Promise.resolve(); });
    expect(result.current.state.phase.kind).toBe('playing');
    expect(result.current.state.packageSource).toBe('elapsed');
    expect(sent[0]).toMatchObject({ progressStep: 'Start', positionSec: 0, progressTime: 300 }); // resume base, 0 s elapsed

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(sent[1]).toMatchObject({ progressStep: 'Middle', positionSec: 0, progressTime: 360 });
    expect(result.current.packageElapsedSec).toBe(60);
    expect(result.current.watchedSec()).toBe(60);
    expect(result.current.state.localElapsedSec).toBe(60);

    // The package now exposes its clock → real position, progressTime 0.
    result.current.iframeRef.current = fakeIframe('<div class="time1"><span class="playerText">05:09</span></div>');
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(result.current.state.packageSource).toBe('playhead');
    expect(result.current.packagePlayheadSec).toBe(309);
    expect(sent[2]).toMatchObject({ progressStep: 'Middle', positionSec: 309, progressTime: 0 });

    await act(async () => { await result.current.exit(); });
    expect(sent.at(-1)).toMatchObject({ progressStep: 'End', positionSec: 309, progressTime: 0 });
    expect(result.current.state.phase.kind).toBe('exiting');
    unmount();
  });

  it('pauses the elapsed counter while the tab is hidden and after 120 s without input', async () => {
    const { result, unmount } = renderHook(() => usePlayerEngine(target));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    result.current.iframeRef.current = fakeIframe(null);
    await act(async () => { result.current.onPackageLoaded(); await Promise.resolve(); });

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(result.current.packageElapsedSec).toBe(10);
    expect(result.current.packageCounting).toBe(true);

    const vis = vi.spyOn(document, 'visibilityState', 'get');
    vis.mockReturnValue('hidden');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.packageElapsedSec).toBe(10);
    expect(result.current.packageCounting).toBe(false);
    vis.mockReturnValue('visible');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(5_000); });
    expect(result.current.packageElapsedSec).toBe(15);

    // Idle: pointerdown re-arms the 120 s idle timeout; the 120th second is still credited, then the counter stops
    // (one extra second so the 1 s status poll has mirrored isCounting into state).
    await act(async () => { document.dispatchEvent(new Event('pointerdown')); await vi.advanceTimersByTimeAsync(121_000); });
    expect(result.current.packageElapsedSec).toBe(135);
    expect(result.current.packageCounting).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(result.current.packageElapsedSec).toBe(135);
    await act(async () => { document.dispatchEvent(new Event('keydown')); await vi.advanceTimersByTimeAsync(2_000); });
    expect(result.current.packageElapsedSec).toBe(137);
    expect(result.current.packageCounting).toBe(true);
    unmount();
    expect(beaconed.at(-1)).toMatchObject({ progressStep: 'End', positionSec: 0, progressTime: 437 });
  });
});
