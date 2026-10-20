import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { PlayerDescriptor } from '../shared/api/schemas';
import { playerApi } from '../shared/api/endpoints/player';

let nextToken = 'tok-1';
vi.mock('../shared/api/endpoints/player', () => ({
  playerApi: {
    open: vi.fn(() => Promise.resolve({ ...descriptor, playToken: nextToken })),
    close: vi.fn(() => Promise.resolve({ released: true })),
    heartbeat: vi.fn(() => Promise.resolve({ ok: true })),
    tick: vi.fn(() => Promise.resolve({ ChkError: 'N', StudyTime: 0, PositionSec: 0 })),
    beaconTick: vi.fn(() => true),
    release: vi.fn(() => true),
    chapters: vi.fn(),
    dailyTime: vi.fn(),
  },
}));

const descriptor: PlayerDescriptor = {
  playToken: 'tok-1',
  study: { seq: 7, lectureCode: 'ARC2026', serviceType: 'A', mode: 'REFUND', lectureStart: '2026-10-02', lectureEnd: '2026-12-31', passOk: false },
  contentLectureCode: 'B0502',
  chapter: { chapterSeq: 501, number: 1, title: '1차시', minutes: 30, contentsIdx: 88, contentsDetailSeq: 880, contentsType: 'B', url: '/contents/B0502/01.mp4', mobileUrl: null, progress: 0, studyTime: 0, lastStudy: null, total: 3, completeTimeSec: 1800 },
  chapters: [],
  resume: { positionSec: 0, studyTimeSec: 0 },
  totals: { recognizedSec: 0, todaySec: 0, dailyCapSec: 28800, dailyCapClientStopSec: 28770 },
  gates: { identity: 'ok', dailyCapReached: false, alreadyDone: false },
  tick: { intervalMs: 60000, heartbeatMs: 60000, idleTimeoutMs: 7200000 },
  identityUrl: null,
};

import { usePlayerEngine } from '../features/player/usePlayerEngine';

const target = { studySeq: 7, lectureCode: 'ARC2026', chapterNumber: '1' };
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const lastOpenBody = () => vi.mocked(playerApi.open).mock.calls.at(-1)?.[0];

describe('usePlayerEngine PlayLock lifecycle', () => {
  beforeEach(() => { vi.clearAllMocks(); nextToken = 'tok-1'; window.sessionStorage.clear(); });
  afterEach(() => { window.sessionStorage.clear(); });

  it('releases the lock on pagehide (tab closed) and re-opens after a back/forward-cache restore', async () => {
    const { result, unmount } = renderHook(() => usePlayerEngine(target));
    await settle();
    expect(result.current.state.phase.kind).toBe('ready');

    act(() => { window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })); });
    expect(playerApi.release).toHaveBeenCalledWith('tok-1');

    nextToken = 'tok-2';
    await act(async () => { window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); await Promise.resolve(); await Promise.resolve(); });
    expect(playerApi.open).toHaveBeenCalledTimes(2);
    expect(result.current.state.descriptor?.playToken).toBe('tok-2');

    unmount();
    expect(playerApi.release).toHaveBeenLastCalledWith('tok-2'); // SPA navigation away also frees the lock
    expect(window.sessionStorage.getItem('ainex.player.playToken')).toBeNull();
  });

  it('a reload of the same tab sends the stored token back, so its own lock does not block it', async () => {
    const first = renderHook(() => usePlayerEngine(target));
    await settle();
    expect(window.sessionStorage.getItem('ainex.player.playToken')).toBe('tok-1');
    // A reload drops React state without unmount cleanup: simulate by opening a second engine while the token is stored.
    const reloaded = renderHook(() => usePlayerEngine(target));
    await settle();
    expect(lastOpenBody()).toMatchObject({ playToken: 'tok-1' });
    first.unmount(); reloaded.unmount();
  });

  it('「여기서 학습 계속하기」 re-opens with takeover', async () => {
    const { result, unmount } = renderHook(() => usePlayerEngine(target));
    await settle();
    expect(lastOpenBody()).not.toHaveProperty('takeover');
    await act(async () => { result.current.open({ takeover: true }); await Promise.resolve(); await Promise.resolve(); });
    expect(lastOpenBody()).toMatchObject({ takeover: true });
    unmount();
  });
});
