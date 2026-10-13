/**
 * TickScheduler — drives the Start / Middle / End progress saves of the learning window (AR-06).
 *
 * - `Start` is sent exactly once (first play).
 * - `Middle` is sent every `intervalMs` while playing. A plain setInterval is used on purpose: browsers throttle
 *   background-tab timers to ≥1 s but do not stop them, so saves keep going while the tab is hidden.
 * - `End` is sent once on exit / chapter switch / media ended / pagehide. The caller may ask for a beacon
 *   transport (`end({ beacon: true })`) which bypasses the queue because the page is going away.
 * - Ticks form an ordered queue with a single in-flight request; the next tick is sent only after the previous
 *   one was acknowledged (or failed). A failed tick reports SAVE_FAILED and does not block later ticks.
 *
 * Pure TypeScript, no React, no DOM dependency beyond setInterval/clearInterval (fake-timer friendly).
 */
export type TickStep = 'Start' | 'Middle' | 'End';
export type SaveStatus = 'IDLE' | 'SAVING' | 'SAVED' | 'SAVE_FAILED';

export interface TickSchedulerOptions<Ack> {
  intervalMs: number;
  /** Current playhead position in whole seconds (floor of video.currentTime). */
  getPosition: () => number;
  /**
   * Packaged (type A) content without a readable playhead: synthetic position (resume base + elapsed seconds)
   * sent as `progressTime` while `positionSec` is 0. Omitted / 0 for real media.
   */
  getProgressTime?: () => number;
  /** Sends one tick; resolves with the server acknowledgement. Rejects on transport failure. */
  send: (step: TickStep, positionSec: number, progressTime: number) => Promise<Ack>;
  /** Fire-and-forget transport used for `End` on pagehide. Return true when a request was handed off. */
  beacon?: (step: TickStep, positionSec: number, progressTime: number) => boolean;
  onAck?: (step: TickStep, ack: Ack) => void;
  onError?: (step: TickStep, error: unknown) => void;
  onStatus?: (status: SaveStatus) => void;
}

interface QueuedTick { step: TickStep; positionSec: number; progressTime: number }

export class TickScheduler<Ack = unknown> {
  private readonly opts: TickSchedulerOptions<Ack>;
  private queue: QueuedTick[] = [];
  private inFlight: QueuedTick | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private ended = false;
  private disposed = false;
  private statusValue: SaveStatus = 'IDLE';
  private processing: Promise<void> | null = null;

  constructor(opts: TickSchedulerOptions<Ack>) { this.opts = opts; }

  get status(): SaveStatus { return this.statusValue; }
  get hasStarted(): boolean { return this.started; }
  get hasEnded(): boolean { return this.ended; }
  get pending(): number { return this.queue.length + (this.inFlight ? 1 : 0); }
  get running(): boolean { return this.timer !== null; }

  /** First play: send Start once and begin the Middle interval. Subsequent calls just resume the interval. */
  start(): void {
    if (this.disposed || this.ended) return;
    if (!this.started) { this.started = true; this.enqueue('Start'); }
    this.arm();
  }

  /** Pause stops the interval; nothing is sent (a Middle on pause is the caller's choice via tickNow). */
  pause(): void { this.disarm(); }

  /** Resume after pause — never re-sends Start. */
  resume(): void { if (this.started && !this.ended && !this.disposed) this.arm(); }

  /** Manual Middle (e.g. before pausing so the latest position is persisted). */
  tickNow(): void { if (this.started && !this.ended && !this.disposed) this.enqueue('Middle'); }

  /**
   * Send End once and stop. With `beacon: true` the End goes through the fire-and-forget transport
   * (pagehide) and the queue is abandoned; otherwise it is queued behind any in-flight tick.
   */
  end(options: { beacon?: boolean } = {}): void {
    if (this.disposed || this.ended) return;
    this.disarm();
    this.ended = true;
    if (!this.started) return; // never played: there is nothing to close
    if (options.beacon && this.opts.beacon) {
      const ok = this.opts.beacon('End', Math.max(0, Math.floor(this.opts.getPosition())), this.progressTime());
      if (ok) { this.setStatus('SAVED'); return; }
    }
    this.enqueue('End');
  }

  /** Resolves when the queue is drained (used by the exit flow before navigating away). */
  flush(): Promise<void> { return this.processing ?? Promise.resolve(); }

  dispose(): void { this.disarm(); this.disposed = true; this.queue = []; }

  private arm(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.enqueue('Middle'), this.opts.intervalMs);
  }
  private disarm(): void { if (this.timer !== null) { clearInterval(this.timer); this.timer = null; } }

  private progressTime(): number { return Math.max(0, Math.floor(this.opts.getProgressTime?.() ?? 0)); }

  private setStatus(s: SaveStatus): void { if (this.statusValue !== s) { this.statusValue = s; this.opts.onStatus?.(s); } }

  private enqueue(step: TickStep): void {
    if (this.disposed) return;
    // Collapse duplicate Middles that pile up while a request is slow: keep only the newest position.
    if (step === 'Middle') this.queue = this.queue.filter((q) => q.step !== 'Middle');
    this.queue.push({ step, positionSec: Math.max(0, Math.floor(this.opts.getPosition())), progressTime: this.progressTime() });
    void this.pump();
  }

  private pump(): Promise<void> {
    if (this.processing) return this.processing;
    this.processing = (async () => {
      while (this.queue.length && !this.disposed) {
        const tick = this.queue.shift()!;
        this.inFlight = tick;
        this.setStatus('SAVING');
        try {
          const ack = await this.opts.send(tick.step, tick.positionSec, tick.progressTime);
          if (this.disposed) break;
          this.setStatus('SAVED');
          this.opts.onAck?.(tick.step, ack);
        } catch (e) {
          if (this.disposed) break;
          this.setStatus('SAVE_FAILED');
          this.opts.onError?.(tick.step, e);
        } finally {
          this.inFlight = null;
        }
      }
      this.processing = null;
    })();
    return this.processing;
  }
}
