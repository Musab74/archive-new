import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ElapsedCounter, isPackageChapter, packageTickPosition, parsePlayhead, readPlayhead } from '../shared/player/packageSource';

describe('parsePlayhead', () => {
  it('parses mm:ss and hh:mm:ss', () => {
    expect(parsePlayhead('05:09')).toBe(309);
    expect(parsePlayhead('00:00')).toBe(0);
    expect(parsePlayhead(' 1:02:03 ')).toBe(3723);
    expect(parsePlayhead('12:34:56')).toBe(45296);
  });
  it('rejects invalid input', () => {
    expect(parsePlayhead('')).toBeNull();
    expect(parsePlayhead(null)).toBeNull();
    expect(parsePlayhead(undefined)).toBeNull();
    expect(parsePlayhead('abc')).toBeNull();
    expect(parsePlayhead('12')).toBeNull();
    expect(parsePlayhead('1:2:3:4')).toBeNull();
    expect(parsePlayhead('mm:ss')).toBeNull();
    expect(parsePlayhead('-1:00')).toBeNull();
    expect(parsePlayhead('05:09 / 10:00')).toBeNull();
  });
});

describe('readPlayhead', () => {
  const doc = (html: string) => { const d = document.implementation.createHTMLDocument('pkg'); d.body.innerHTML = html; return d; };
  it('prefers .time1 .playerText, then .playerText, then [data-current-time], then media currentTime', () => {
    expect(readPlayhead(doc('<div class="time1"><span class="playerText">05:09</span></div><span class="playerText">01:00</span>'))).toBe(309);
    expect(readPlayhead(doc('<span class="playerText">01:00</span>'))).toBe(60);
    expect(readPlayhead(doc('<div data-current-time="42.9"></div>'))).toBe(42);
    expect(readPlayhead(doc('<div data-current-time="01:30"></div>'))).toBe(90);
    const d = doc('<video></video>');
    Object.defineProperty(d.querySelector('video')!, 'currentTime', { value: 17.6 });
    expect(readPlayhead(d)).toBe(17);
  });
  it('returns null when nothing usable exists or the document is unreachable', () => {
    expect(readPlayhead(null)).toBeNull();
    expect(readPlayhead(doc('<p>hello</p>'))).toBeNull();
    expect(readPlayhead(doc('<span class="playerText">loading</span>'))).toBeNull();
    const d = doc('<video></video>');
    Object.defineProperty(d.querySelector('video')!, 'currentTime', { value: 0 });
    expect(readPlayhead(d)).toBeNull();
  });
});

describe('isPackageChapter', () => {
  it('matches contentsType A or an .html/.htm url', () => {
    expect(isPackageChapter({ contentsType: 'A', url: '/contents/B/05/B0502/001/01/index.html' })).toBe(true);
    expect(isPackageChapter({ contentsType: null, url: '/contents/x/index.htm?x=1' })).toBe(true);
    expect(isPackageChapter({ contentsType: 'B', url: '/contents/D00001/02.mp4' })).toBe(false);
    expect(isPackageChapter({ contentsType: '', url: null, mobileUrl: '/m/index.html' })).toBe(true);
  });
});

describe('packageTickPosition', () => {
  it('sends the real playhead when detected, otherwise a cumulative synthetic progressTime with positionSec 0', () => {
    expect(packageTickPosition(309, 50, 600)).toEqual({ positionSec: 309, progressTime: 0 });
    expect(packageTickPosition(null, 50, 600)).toEqual({ positionSec: 0, progressTime: 650 });
    expect(packageTickPosition(0, 7.9, 0)).toEqual({ positionSec: 0, progressTime: 7 });
  });
});

describe('ElapsedCounter', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('counts whole seconds only while running', () => {
    const ticks: number[] = [];
    const c = new ElapsedCounter({ onSecond: (t) => ticks.push(t) });
    vi.advanceTimersByTime(5_000);
    expect(c.seconds).toBe(0);
    c.start();
    vi.advanceTimersByTime(3_000);
    expect(c.seconds).toBe(3);
    expect(ticks).toEqual([1, 2, 3]);
    c.stop();
    vi.advanceTimersByTime(10_000);
    expect(c.seconds).toBe(3);
    c.start();
    vi.advanceTimersByTime(2_000);
    expect(c.seconds).toBe(5);
    c.dispose();
  });

  it('pauses while the tab is hidden and resumes when visible again', () => {
    const c = new ElapsedCounter();
    c.start();
    vi.advanceTimersByTime(2_000);
    c.setVisible(false);
    expect(c.isCounting).toBe(false);
    vi.advanceTimersByTime(30_000);
    expect(c.seconds).toBe(2);
    c.setVisible(true);
    expect(c.isCounting).toBe(true);
    vi.advanceTimersByTime(4_000);
    expect(c.seconds).toBe(6);
    c.dispose();
  });

  it('pauses after 120 s without activity and resumes on the next activity', () => {
    const c = new ElapsedCounter();
    c.start();
    vi.advanceTimersByTime(119_000);
    expect(c.isCounting).toBe(true);
    expect(c.seconds).toBe(119);
    vi.advanceTimersByTime(1_000);
    expect(c.isIdle).toBe(true);
    expect(c.isCounting).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(c.seconds).toBe(120);
    c.activity();
    expect(c.isIdle).toBe(false);
    vi.advanceTimersByTime(5_000);
    expect(c.seconds).toBe(125);
    // activity keeps re-arming the idle timeout
    vi.advanceTimersByTime(100_000);
    c.activity();
    vi.advanceTimersByTime(100_000);
    expect(c.isCounting).toBe(true);
    expect(c.seconds).toBe(325);
    c.dispose();
  });

  it('hidden + idle both have to clear before counting resumes; custom idleMs is honoured', () => {
    const c = new ElapsedCounter({ idleMs: 10_000, visible: false });
    c.start();
    expect(c.isCounting).toBe(false);
    vi.advanceTimersByTime(20_000);
    expect(c.seconds).toBe(0);
    expect(c.isIdle).toBe(true);
    c.setVisible(true);
    expect(c.isCounting).toBe(false);
    c.activity();
    expect(c.isCounting).toBe(true);
    vi.advanceTimersByTime(3_000);
    expect(c.seconds).toBe(3);
    c.dispose();
    vi.advanceTimersByTime(3_000);
    expect(c.seconds).toBe(3);
  });
});
