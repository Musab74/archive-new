import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TickScheduler, type SaveStatus, type TickStep } from '../shared/player/tickScheduler';

interface Sent { step: TickStep; pos: number }

function make(opts: { fail?: (step: TickStep) => boolean; delay?: number } = {}) {
  const sent: Sent[] = [];
  const statuses: SaveStatus[] = [];
  const acks: TickStep[] = [];
  const errors: TickStep[] = [];
  let pos = 0;
  const resolvers: Array<() => void> = [];
  const beacon = vi.fn((_step: TickStep, _pos: number, _progressTime: number) => true);
  const s = new TickScheduler<{ ok: true }>({
    intervalMs: 60_000,
    getPosition: () => pos,
    send: (step, p) => {
      sent.push({ step, pos: p });
      if (opts.fail?.(step)) return Promise.reject(new Error('net'));
      if (opts.delay === -1) return new Promise((resolve) => { resolvers.push(() => resolve({ ok: true })); });
      return Promise.resolve({ ok: true });
    },
    beacon,
    onAck: (step) => acks.push(step),
    onError: (step) => errors.push(step),
    onStatus: (st) => statuses.push(st),
  });
  return { s, sent, statuses, acks, errors, beacon, resolvers, setPos: (n: number) => { pos = n; } };
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('TickScheduler', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sends Start exactly once on first play and Middle at every interval while running', async () => {
    const t = make();
    t.s.start();
    await flush();
    expect(t.sent.map((x) => x.step)).toEqual(['Start']);
    t.setPos(60);
    await vi.advanceTimersByTimeAsync(60_000);
    t.setPos(120);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.sent.map((x) => x.step)).toEqual(['Start', 'Middle', 'Middle']);
    expect(t.sent[2].pos).toBe(120);
    // resume after a pause never re-sends Start
    t.s.pause();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(t.sent.length).toBe(3);
    t.s.resume();
    t.s.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.sent.filter((x) => x.step === 'Start').length).toBe(1);
    expect(t.sent.at(-1)?.step).toBe('Middle');
  });

  it('sends End once on exit and stops the interval', async () => {
    const t = make();
    t.s.start();
    await flush();
    t.setPos(33.9);
    t.s.end();
    await flush();
    expect(t.sent.map((x) => x.step)).toEqual(['Start', 'End']);
    expect(t.sent[1].pos).toBe(33);
    t.s.end();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(t.sent.length).toBe(2);
    expect(t.s.hasEnded).toBe(true);
  });

  it('does not send End when playback never started', async () => {
    const t = make();
    t.s.end();
    await flush();
    expect(t.sent).toEqual([]);
  });

  it('keeps a single in-flight request and collapses queued Middles to the newest position', async () => {
    const t = make({ delay: -1 });
    t.s.start();
    await flush();
    expect(t.sent.length).toBe(1); // Start in flight
    t.setPos(60);
    await vi.advanceTimersByTimeAsync(60_000);
    t.setPos(120);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.sent.length).toBe(1); // still waiting for Start ack
    expect(t.s.pending).toBe(2); // in-flight Start + one collapsed Middle
    t.resolvers.shift()!();
    await flush();
    expect(t.sent.map((x) => x.step)).toEqual(['Start', 'Middle']);
    expect(t.sent[1].pos).toBe(120);
    expect(t.statuses).toEqual(['SAVING', 'SAVED', 'SAVING']);
  });

  it('reports SAVE_FAILED on a rejected ack and continues with later ticks', async () => {
    const t = make({ fail: (step) => step === 'Middle' });
    t.s.start();
    await flush();
    await vi.advanceTimersByTimeAsync(60_000);
    await flush();
    expect(t.errors).toEqual(['Middle']);
    expect(t.s.status).toBe('SAVE_FAILED');
    t.s.end();
    await flush();
    expect(t.acks).toEqual(['Start', 'End']);
    expect(t.s.status).toBe('SAVED');
  });

  it('uses the beacon transport for End on pagehide and marks the save as handed off', async () => {
    const t = make();
    t.s.start();
    await flush();
    t.setPos(45);
    t.s.end({ beacon: true });
    expect(t.beacon).toHaveBeenCalledWith('End', 45, 0, ''); // progressTime is 0 for real media; no getLastStudy → ''
    expect(t.sent.map((x) => x.step)).toEqual(['Start']);
    expect(t.s.status).toBe('SAVED');
  });

  it('dispose stops everything without sending', async () => {
    const t = make();
    t.s.start();
    await flush();
    t.s.dispose();
    await vi.advanceTimersByTimeAsync(120_000);
    t.s.end();
    await flush();
    expect(t.sent.length).toBe(1);
  });
});
