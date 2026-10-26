import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ProgressTick } from '@ainex/contracts';
import type { PlayerDescriptor } from '../shared/api/schemas';
import { exitRatingDue, phaseForDescriptor } from '../shared/player/playerReducer';
import { installTypeAAutoNext, normalizeArchiveLastStudy, packageLastStudy, seoulYmd } from '../shared/player/packageSource';
import { identityPopupUrl } from '../features/player/media';

const sent: ProgressTick[] = [];
const beaconed: ProgressTick[] = [];
vi.mock('../shared/api/endpoints/player', () => ({
  playerApi: {
    open: vi.fn(() => Promise.resolve(current)),
    close: vi.fn(() => Promise.resolve({ released: true })),
    heartbeat: vi.fn(() => Promise.resolve({ ok: true })),
    tick: vi.fn((body: ProgressTick) => { sent.push(body); return Promise.resolve({ ChkError: 'N', StudyTime: 10, PositionSec: body.positionSec || body.progressTime }); }),
    beaconTick: vi.fn((body: ProgressTick) => { beaconed.push(body); return true; }),
    release: vi.fn(() => true),
    chapters: vi.fn(),
    dailyTime: vi.fn(),
  },
}));

const base = (over: Partial<PlayerDescriptor> = {}): PlayerDescriptor => ({
  playToken: 'tok',
  study: { seq: 7, lectureCode: 'ARC2026', serviceType: 'A', mode: 'REFUND', lectureStart: '2026-10-02', lectureEnd: '2026-12-31', passOk: false },
  contentLectureCode: 'B0502',
  chapter: { chapterSeq: 505, number: 2, order: 5, title: '5차시', minutes: 30, contentsIdx: 88, contentsDetailSeq: 880, contentsType: 'A', url: '/contents/B/05/B0502/001/01/index.html', mobileUrl: null, progress: 0, studyTime: 0, lastStudy: null, total: 3, completeTimeSec: 1800, urlSelect: 'A', mode: 'C', startLastStudy: '/B/05/B0502/001/02/index.html' },
  chapters: [],
  resume: { positionSec: 0, studyTimeSec: 0 },
  totals: { recognizedSec: 0, todaySec: 0, dailyCapSec: 28800, dailyCapClientStopSec: 28800 },
  gates: { identity: 'ok', dailyCapReached: false, dailyCapApplies: true, alreadyDone: false },
  review: { mine: 0 },
  assessment: { postDone: false },
  tick: { intervalMs: 60000, heartbeatMs: 60000, idleTimeoutMs: 7200000 },
  identityUrl: null,
  ...over,
});
let current = base();

import { usePlayerEngine } from '../features/player/usePlayerEngine';
import { usePackageBridge } from '../features/player/PackageBridge';

const target = { studySeq: 7, lectureCode: 'B0502', chapterNumber: '5' };
const frame = (pathname: string | null, html = '') => {
  const doc = document.implementation.createHTMLDocument('pkg');
  doc.body.innerHTML = html;
  return { contentDocument: doc, contentWindow: pathname === null ? null : { location: { pathname } }, getAttribute: () => null, src: '' } as unknown as HTMLIFrameElement;
};
const boot = async () => {
  const hook = renderHook(() => usePlayerEngine(target));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return hook;
};

describe('player2.php parity in the learning window', () => {
  beforeEach(() => { vi.useFakeTimers(); sent.length = 0; beaconed.length = 0; current = base(); });
  afterEach(() => { vi.useRealTimers(); });

  it('posts Chapter_Number = OrderByNum and the LastStudy PHP posts (Start: opened page; later: the current section page)', async () => {
    const { result, unmount } = await boot();
    result.current.iframeRef.current = frame('/contents/B/05/B0502/001/02/index.html');
    await act(async () => { result.current.onPackageLoaded(); await Promise.resolve(); });
    expect(sent[0]).toMatchObject({ progressStep: 'Start', chapterNumber: '5', lastStudy: '/B/05/B0502/001/02/index.html' });
    result.current.iframeRef.current = frame('/contents/B/05/B0502/001/03/index.html');
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(sent[1]).toMatchObject({ progressStep: 'Middle', chapterNumber: '5', lastStudy: '/B/05/B0502/001/03/index.html' });
    unmount();
    expect(beaconed.at(-1)).toMatchObject({ progressStep: 'End', lastStudy: '/B/05/B0502/001/03/index.html' });
  });

  it('a package seek (ArchivePlayerSeek) sends one Seek save at the new position after 250 ms', async () => {
    const { result, unmount } = await boot();
    result.current.iframeRef.current = frame('/contents/B/05/B0502/001/01/index.html');
    await act(async () => { result.current.onPackageLoaded(); await Promise.resolve(); });
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'ArchivePlayerSeek', from: 10, to: 150 }, origin: window.location.origin }));
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'ArchivePlayerSeek', from: 150, to: 200 }, origin: window.location.origin }));
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'ArchivePlayerSeek', from: 0, to: 999 }, origin: 'https://evil.example' }));
      await vi.advanceTimersByTimeAsync(300);
    });
    const seeks = sent.filter((t) => t.progressStep === 'Seek');
    expect(seeks).toHaveLength(1);
    expect(seeks[0]).toMatchObject({ positionSec: 200, chapterNumber: '5' });
    unmount();
  });

  it('installs the auto-next helper into each section page and blocks its context menu', async () => {
    const { result, unmount } = await boot();
    const f = frame('/contents/B/05/B0502/001/01/index.html');
    result.current.iframeRef.current = f;
    await act(async () => { result.current.onPackageLoaded(); await vi.advanceTimersByTimeAsync(150); });
    const doc = f.contentDocument!;
    expect(doc.querySelectorAll('script[data-hrde-type-a-autonext]')).toHaveLength(1);
    const ev = new Event('contextmenu', { cancelable: true });
    doc.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    unmount();
  });

  it('8-hour stop: no further save, End included; TestID learners are exempt', async () => {
    current = base({ totals: { recognizedSec: 0, todaySec: 28800 - 5, dailyCapSec: 28800, dailyCapClientStopSec: 28800 } });
    const { result, unmount } = await boot();
    result.current.iframeRef.current = frame(null);
    await act(async () => { result.current.onPackageLoaded(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    expect(result.current.state.phase).toMatchObject({ kind: 'blocked', reason: 'dailyCap' });
    const count = sent.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    unmount();
    expect(sent.length).toBe(count);
    expect(beaconed.filter((t) => t.progressStep === 'End')).toHaveLength(0);

    current = base({ totals: { recognizedSec: 0, todaySec: 28800 - 5, dailyCapSec: 28800, dailyCapClientStopSec: 28800 }, gates: { identity: 'ok', dailyCapReached: false, dailyCapApplies: false, alreadyDone: false } });
    const second = await boot();
    second.result.current.iframeRef.current = frame(null);
    await act(async () => { second.result.current.onPackageLoaded(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(second.result.current.state.phase.kind).toBe('playing');
    second.unmount();
  });

  it('the 8-hour count restarts at Seoul midnight', async () => {
    vi.setSystemTime(new Date('2026-10-26T14:59:50Z')); // 23:59:50 KST
    current = base({ totals: { recognizedSec: 0, todaySec: 28800 - 30, date: '2026-10-26', dailyCapSec: 28800, dailyCapClientStopSec: 28800 } });
    const { result, unmount } = await boot();
    result.current.iframeRef.current = frame(null);
    await act(async () => { result.current.onPackageLoaded(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(40_000); }); // crosses 00:00 KST after 10 s
    expect(seoulYmd()).toBe('2026-10-27');
    expect(result.current.state.phase.kind).toBe('playing');
    unmount();
  });
});

describe('player2.php parity — pure rules', () => {
  it('8-hour limit wins over 본인인증 when both apply (player2.php:864-924 order)', () => {
    expect(phaseForDescriptor(base({ gates: { identity: 'required', dailyCapReached: true, dailyCapApplies: true, alreadyDone: false } }))).toEqual({ kind: 'blocked', reason: 'dailyCap' });
    expect(phaseForDescriptor(base({ gates: { identity: 'required', dailyCapReached: false, dailyCapApplies: true, alreadyDone: false } }))).toEqual({ kind: 'identityCheck' });
  });
  it('exit rating: no own review and ≥ 50 % watched (player2.php:5208-5228)', () => {
    expect(exitRatingDue(0, false, 900, 1800)).toBe(true);
    expect(exitRatingDue(0, false, 899, 1800)).toBe(false);
    expect(exitRatingDue(1, false, 1800, 1800)).toBe(false);
    expect(exitRatingDue(0, true, 1800, 1800)).toBe(false);
  });
  it('normalizeArchiveLastStudy (player2.php:3388-3407)', () => {
    expect(normalizeArchiveLastStudy('https://www.hrdeedu.co.kr/contents/D/01/02/index.html?x=1')).toBe('/D/01/02/index.html');
    expect(normalizeArchiveLastStudy('/contents/')).toBe('');
    expect(normalizeArchiveLastStudy('blank')).toBe('');
    expect(normalizeArchiveLastStudy('/D/01/index.html')).toBe('/D/01/index.html');
    expect(packageLastStudy(null, null)).toBe('blank');
  });
  it('auto-next helper installs once per document', () => {
    const doc = document.implementation.createHTMLDocument('x');
    expect(installTypeAAutoNext(doc)).toBe(true);
    expect(installTypeAAutoNext(doc)).toBe(true);
    expect(doc.querySelectorAll('script[data-hrde-type-a-autonext]')).toHaveLength(1);
    expect(installTypeAAutoNext(null)).toBe(false);
  });
  it('mOTP popup URL carries the API query', () => {
    expect(identityPopupUrl('class_tme=5&EvalCd=01')).toBe('https://www.hrdeedu.co.kr/player/motp.php?class_tme=5&EvalCd=01');
    expect(identityPopupUrl(null)).toBe('https://www.hrdeedu.co.kr/player/motp.php');
  });
  it('parent-window bridges packaged lessons call (PlayStudyCounsel 2/3-arg, PlayStudyInfo, closers)', () => {
    const onExit = vi.fn();
    const { result, unmount } = renderHook(() => usePackageBridge({ lectureCode: 'B0502', contentsIdx: 88 }, onExit));
    const w = window as unknown as Record<string, (...a: unknown[]) => void>;
    act(() => { w.PlayStudyCounsel('B0502', '12', '99'); });
    expect(result.current.layer).toEqual({ kind: 'counsel', lectureCode: 'B0502', contentsIdx: 99 });
    act(() => { w.PlayInfoClose(); });
    expect(result.current.layer).toBeNull();
    act(() => { w.PlayStudyCounsel('B0502', '77'); });
    expect(result.current.layer).toEqual({ kind: 'counsel', lectureCode: 'B0502', contentsIdx: 77 });
    act(() => { w.PlayStudyInfo('B0502', 88); });
    expect(result.current.layer).toEqual({ kind: 'info', lectureCode: 'B0502', contentsIdx: 88 });
    act(() => { w.DataResultClose(); });
    expect(onExit).toHaveBeenCalledTimes(1);
    unmount();
    expect(w.PlayStudyCounsel).toBeUndefined();
  });
});
