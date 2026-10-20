import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { ProgressTick } from '@ainex/contracts';
import { playerApi } from '../../shared/api/endpoints/player';
import { isAppError } from '../../shared/api/client';
import type { PlayerDescriptor, TickAck } from '../../shared/api/schemas';
import { TickScheduler, type TickStep } from '../../shared/player/tickScheduler';
import { initialPlayerState, playerReducer, type PlayerState } from '../../shared/player/playerReducer';
import { ElapsedCounter, iframeDocument, isPackageChapter, packageTickPosition, readPlayhead } from '../../shared/player/packageSource';
import { IDLE_LIMIT_MS, IDLE_WARN_MS, startIdleTimer } from '../../shared/auth/idleTimer';

export interface EngineTarget { studySeq: number; lectureCode: string; chapterNumber: string }

export interface PlayerEngine {
  state: PlayerState;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Packaged (type A) content: the embedded iframe; polled for the package's playhead. */
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** True once the descriptor says the chapter is packaged HTML (contentsType 'A' or an .html URL). */
  isPackage: boolean;
  /** Runs the gates again; `takeover` ends the other window's session (「여기서 학습 계속하기」). */
  open: (opts?: { takeover?: boolean }) => void;
  play: () => void;
  pause: () => void;
  /** Called by the stage on every timeupdate: accumulates watched seconds (skip detection) and local elapsed for the daily cap. */
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onMediaEnded: () => void;
  /** Package stage: the iframe finished loading → Start tick (auto-play) when the gates are clear. */
  onPackageLoaded: () => void;
  /** Package stage display: elapsed seconds counted in this window, the detected playhead, and whether the counter runs. */
  packageElapsedSec: number;
  packagePlayheadSec: number | null;
  packageCounting: boolean;
  /** End + close + resolve; the caller navigates afterwards. */
  exit: () => Promise<void>;
  /** End the current chapter (no close) so a sibling chapter can be opened; resolves when the End tick was acked. */
  endForSwitch: () => Promise<void>;
  retrySave: () => void;
  acknowledgeIdle: () => void;
  /** Watched seconds accumulated from ≤2 s timeupdate deltas — or the elapsed counter for packaged content (never used as credit). */
  watchedSec: () => number;
}

/**
 * Builds the legacy progress body from the descriptor; `chapterNumber` is a string like the PHP form field.
 * `progressTime` is 0 for real media; for packaged content without a readable playhead it carries the synthetic
 * position (resume base + elapsed) while `positionSec` is 0, which the API substitutes (the PHP ProgressTime fallback).
 */
export function tickBody(d: PlayerDescriptor, step: TickStep, positionSec: number, playToken: string, progressTime = 0): ProgressTick {
  return {
    studySeq: d.study.seq,
    lectureCode: d.contentLectureCode,
    studyLectureCode: d.study.lectureCode,
    chapterSeq: d.chapter.chapterSeq,
    chapterNumber: String(d.chapter.number),
    contentsIdx: d.chapter.contentsIdx,
    contentsDetailSeq: d.chapter.contentsDetailSeq,
    lastStudy: d.chapter.lastStudy ?? '',
    completeTime: d.chapter.completeTimeSec,
    progressStep: step,
    positionSec: Math.max(0, Math.floor(positionSec)),
    progressTime: Math.max(0, Math.floor(progressTime)),
    playToken,
  };
}

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

/**
 * The play token survives a reload of the same tab (sessionStorage is per tab), so F5 re-opens this tab's own session
 * instead of being blocked by it for 90 s when the pagehide release did not reach the server.
 */
const TOKEN_KEY = 'ainex.player.playToken';
const storedToken = (): string => { try { return window.sessionStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; } };
const storeToken = (t: string): void => { try { if (t) window.sessionStorage.setItem(TOKEN_KEY, t); else window.sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ } };

/**
 * Wires the reducer, TickScheduler, heartbeat, idle timer and daily-cap stop to a <video> — or, for packaged
 * (type A) content, to an iframe whose playhead is polled every second with an elapsed-time counter as fallback.
 * All server-facing side effects live here; the page only renders state and forwards user intents.
 */
export function usePlayerEngine(target: EngineTarget | null): PlayerEngine {
  const [state, dispatch] = useReducer(playerReducer, initialPlayerState);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const descriptorRef = useRef<PlayerDescriptor | null>(null);
  const schedulerRef = useRef<TickScheduler<TickAck> | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const watchedRef = useRef(0);
  const elapsedRef = useRef(0);
  const phaseRef = useRef(state.phase);
  const openSeq = useRef(0);
  // Packaged content
  const packageRef = useRef(false);
  const playheadRef = useRef<number | null>(null);
  const counterRef = useRef<ElapsedCounter | null>(null);
  const packageLoadedRef = useRef(false);
  const [packageElapsedSec, setPackageElapsedSec] = useState(0);
  const [packagePlayheadSec, setPackagePlayheadSec] = useState<number | null>(null);
  const [packageCounting, setPackageCounting] = useState(false);
  phaseRef.current = state.phase;
  descriptorRef.current = state.descriptor;

  const isPackage = !!state.descriptor && isPackageChapter(state.descriptor.chapter);

  const packagePair = useCallback(() => {
    const d = descriptorRef.current;
    return packageTickPosition(playheadRef.current, counterRef.current?.seconds ?? 0, d?.resume.positionSec ?? 0);
  }, []);
  const position = useCallback(() => {
    if (packageRef.current) return packagePair().positionSec;
    return Math.max(0, Math.floor(videoRef.current?.currentTime ?? 0));
  }, [packagePair]);
  const progressTime = useCallback(() => (packageRef.current ? packagePair().progressTime : 0), [packagePair]);

  const makeScheduler = useCallback((d: PlayerDescriptor) => {
    schedulerRef.current?.dispose();
    const s = new TickScheduler<TickAck>({
      intervalMs: d.tick.intervalMs,
      getPosition: position,
      getProgressTime: progressTime,
      send: (step, pos, pt) => playerApi.tick(tickBody(d, step, pos, d.playToken, pt)),
      beacon: (step, pos, pt) => playerApi.beaconTick(tickBody(d, step, pos, d.playToken, pt)),
      onAck: (step, ack) => dispatch({ type: 'TICK_ACK', step, ack }),
      onError: (step, e) => { dispatch({ type: 'TICK_FAILED', step }); if (isAppError(e) && e.isAuth) dispatch({ type: 'SESSION_EXPIRED' }); },
      onStatus: (status) => dispatch({ type: 'SAVE_STATUS', status }),
    });
    schedulerRef.current = s;
    return s;
  }, [position, progressTime]);

  /** Elapsed counter for packaged content: 1 credited second → ELAPSED + daily-cap check (same rule as the video path). */
  const makeCounter = useCallback((d: PlayerDescriptor) => {
    counterRef.current?.dispose();
    const c = new ElapsedCounter({
      visible: typeof document === 'undefined' || document.visibilityState !== 'hidden',
      onSecond: (total) => {
        setPackageElapsedSec(total);
        dispatch({ type: 'ELAPSED', seconds: 1 });
        if (d.totals.todaySec + total >= d.totals.dailyCapClientStopSec) {
          c.stop();
          schedulerRef.current?.end();
          dispatch({ type: 'DAILY_CAP' });
        }
      },
    });
    counterRef.current = c;
    setPackageElapsedSec(0);
    setPackageCounting(false);
    return c;
  }, []);

  const inflight = useRef<{ key: string; promise: Promise<PlayerDescriptor> } | null>(null);
  const mounted = useRef(true);
  const closed = useRef(false);

  const open = useCallback((opts?: { takeover?: boolean }) => {
    if (!target) return;
    const takeover = !!opts?.takeover;
    const key = `${target.studySeq}|${target.lectureCode}|${target.chapterNumber}|${takeover ? 'takeover' : ''}`;
    const seq = ++openSeq.current;
    dispatch({ type: 'OPEN' });
    // One request per target even when the effect runs twice (StrictMode) — a second POST would collide with our own PlayLock.
    // A re-check while a token is held passes it back so the server re-validates the same session instead of blocking it.
    let promise = inflight.current?.key === key ? inflight.current.promise : null;
    if (!promise) {
      promise = playerApi.open({ lectureCode: target.lectureCode, chapterNumber: target.chapterNumber, studySeq: target.studySeq, playToken: descriptorRef.current?.playToken || storedToken() || undefined, ...(takeover ? { takeover } : {}) });
      inflight.current = { key, promise };
      void promise.finally(() => { if (inflight.current?.promise === promise) inflight.current = null; }).catch(() => undefined);
    }
    promise
      .then((d) => {
        if (seq !== openSeq.current || !mounted.current) { if (d.playToken && !mounted.current) void playerApi.close(d.playToken).catch(() => undefined); return; }
        storeToken(d.playToken);
        packageRef.current = isPackageChapter(d.chapter);
        playheadRef.current = null;
        setPackagePlayheadSec(null);
        makeScheduler(d); watchedRef.current = 0; elapsedRef.current = 0; lastTimeRef.current = null; closed.current = false;
        if (packageRef.current) makeCounter(d); else { counterRef.current?.dispose(); counterRef.current = null; }
        dispatch({ type: 'OPENED', descriptor: d });
      })
      .catch((e: unknown) => {
        if (seq !== openSeq.current || !mounted.current) return;
        if (isAppError(e)) dispatch({ type: 'OPEN_FAILED', code: e.code, message: e.message, details: e.details, status: e.status });
        else dispatch({ type: 'OPEN_FAILED', code: 'NETWORK' });
      });
  }, [target, makeScheduler, makeCounter]);

  useEffect(() => { mounted.current = true; open(); }, [open]);

  // Unmount / SPA navigation: close the chapter without waiting (beacon End + keepalive release).
  useEffect(() => () => {
    mounted.current = false;
    const s = schedulerRef.current;
    const d = descriptorRef.current;
    if (s && s.hasStarted && !s.hasEnded) s.end({ beacon: true });
    s?.dispose();
    counterRef.current?.dispose();
    if (d?.playToken && !closed.current) { playerApi.release(d.playToken); storeToken(''); }
  }, []);

  // pagehide (tab closed, reload, leaving the site) → beacon End, then release the PlayLock so another window can start at once.
  // pageshow from the back/forward cache → that session was released (and ended), so run the gates again for a fresh one.
  useEffect(() => {
    const onHide = () => {
      const s = schedulerRef.current;
      if (s && s.hasStarted && !s.hasEnded) s.end({ beacon: true });
      const t = descriptorRef.current?.playToken;
      if (t && !closed.current) { playerApi.release(t); closed.current = true; }
    };
    const onShow = (e: PageTransitionEvent) => { if (e.persisted && closed.current && descriptorRef.current?.playToken) open(); };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onShow);
    return () => { window.removeEventListener('pagehide', onHide); window.removeEventListener('pageshow', onShow); };
  }, [open]);

  // Heartbeat keeps the PlayLock alive while a token is held and the window is not blocked.
  const token = state.descriptor?.playToken ?? '';
  const heartbeatMs = state.descriptor?.tick.heartbeatMs ?? 60_000;
  const blockedKind = state.phase.kind;
  useEffect(() => {
    if (!token || blockedKind === 'blocked' || blockedKind === 'exiting') return;
    const id = setInterval(() => {
      playerApi.heartbeat(token).then((r) => { if (!r.ok) dispatch({ type: 'HEARTBEAT_FAILED', error: r.error ?? 'session_expired', message: r.message }); })
        .catch((e: unknown) => { if (isAppError(e) && e.isAuth) dispatch({ type: 'SESSION_EXPIRED' }); });
    }, heartbeatMs);
    return () => clearInterval(id);
  }, [token, heartbeatMs, blockedKind]);

  // Idle: 2 h without user input → end the session; warning at 115 min. Media events are not activity.
  useEffect(() => {
    if (!state.descriptor || blockedKind === 'blocked' || blockedKind === 'exiting') return;
    const idleMs = state.descriptor.tick.idleTimeoutMs || IDLE_LIMIT_MS;
    const handle = startIdleTimer({
      warnAfterMs: Math.min(IDLE_WARN_MS, Math.max(idleMs - 5 * 60_000, idleMs / 2)),
      timeoutAfterMs: idleMs,
      onWarn: () => dispatch({ type: 'IDLE_WARN' }),
      onTimeout: () => {
        videoRef.current?.pause();
        counterRef.current?.stop();
        schedulerRef.current?.end();
        dispatch({ type: 'IDLE_TIMEOUT' });
        const t = descriptorRef.current?.playToken;
        if (t) void playerApi.close(t).catch(() => undefined);
      },
    });
    const onActivity = () => dispatch({ type: 'IDLE_ACTIVITY' });
    document.addEventListener('pointerdown', onActivity, { passive: true });
    document.addEventListener('keydown', onActivity);
    return () => { handle.stop(); document.removeEventListener('pointerdown', onActivity); document.removeEventListener('keydown', onActivity); };
  }, [state.descriptor, blockedKind]);

  // Blocked while playing (heartbeat lost, daily cap, idle) → make sure the media is paused and ticks stop.
  useEffect(() => {
    if (blockedKind === 'blocked') { videoRef.current?.pause(); counterRef.current?.stop(); schedulerRef.current?.pause(); }
  }, [blockedKind]);

  // Packaged content: the elapsed counter runs only while the phase is 'playing' (any pause/overlap/server stop halts it).
  useEffect(() => {
    if (!isPackage) return;
    if (blockedKind !== 'playing') counterRef.current?.stop();
    setPackageCounting(!!counterRef.current?.isCounting);
  }, [isPackage, blockedKind]);

  // Packaged content: visibility + user activity gate the elapsed counter (120 s without input pauses it).
  useEffect(() => {
    if (!isPackage) return;
    const onVis = () => { counterRef.current?.setVisible(document.visibilityState !== 'hidden'); setPackageCounting(!!counterRef.current?.isCounting); };
    const onActivity = () => { counterRef.current?.activity(); setPackageCounting(!!counterRef.current?.isCounting); };
    document.addEventListener('visibilitychange', onVis);
    ACTIVITY_EVENTS.forEach((ev) => document.addEventListener(ev, onActivity, { passive: true }));
    return () => { document.removeEventListener('visibilitychange', onVis); ACTIVITY_EVENTS.forEach((ev) => document.removeEventListener(ev, onActivity)); };
  }, [isPackage]);

  // Packaged content: poll the same-origin iframe for a playhead every second; an advancing playhead counts as activity.
  useEffect(() => {
    if (!isPackage) return;
    const poll = () => {
      const doc = iframeDocument(iframeRef.current);
      let p: number | null = null;
      try { p = readPlayhead(doc); } catch { p = null; }
      if (p !== null) {
        if (playheadRef.current !== null && p > playheadRef.current) counterRef.current?.activity();
        playheadRef.current = p;
        setPackagePlayheadSec(p);
        dispatch({ type: 'PACKAGE_SOURCE', source: 'playhead' });
      } else {
        playheadRef.current = null;
        setPackagePlayheadSec(null);
        if (packageLoadedRef.current) dispatch({ type: 'PACKAGE_SOURCE', source: 'elapsed' });
      }
      setPackageCounting(!!counterRef.current?.isCounting);
    };
    const id = setInterval(poll, 1000);
    return () => clearInterval(id);
  }, [isPackage]);

  const play = useCallback(() => {
    const d = descriptorRef.current;
    if (!d) return;
    if (!schedulerRef.current || schedulerRef.current.hasEnded) makeScheduler(d); // replay after End → new Start
    if (packageRef.current) {
      if (!counterRef.current) makeCounter(d);
      dispatch({ type: 'PLAY' });
      counterRef.current?.start(); // counter first: a Middle due at the same instant sees the full elapsed second
      schedulerRef.current?.start();
      setPackageCounting(!!counterRef.current?.isCounting);
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => undefined);
    dispatch({ type: 'PLAY' });
    schedulerRef.current?.start();
  }, [makeScheduler, makeCounter]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    counterRef.current?.stop();
    schedulerRef.current?.pause();
    dispatch({ type: 'PAUSE' });
  }, []);

  // Package iframe loaded: wire activity events inside the (same-origin) frame and auto-start when the gates are clear.
  const onPackageLoaded = useCallback(() => {
    packageLoadedRef.current = true;
    const doc = iframeDocument(iframeRef.current);
    if (doc) {
      const onActivity = () => { counterRef.current?.activity(); dispatch({ type: 'IDLE_ACTIVITY' }); };
      try { ACTIVITY_EVENTS.forEach((ev) => doc.addEventListener(ev, onActivity, { passive: true })); } catch { /* cross-origin */ }
    }
    let first: number | null = null;
    try { first = readPlayhead(doc); } catch { first = null; }
    playheadRef.current = first;
    setPackagePlayheadSec(first);
    dispatch({ type: 'PACKAGE_SOURCE', source: first !== null ? 'playhead' : 'elapsed' });
    if (phaseRef.current.kind === 'ready') play();
  }, [play]);

  // Gate cleared after the frame had already loaded (identity re-check, re-open) → start then.
  useEffect(() => {
    if (isPackage && packageLoadedRef.current && blockedKind === 'ready') play();
  }, [isPackage, blockedKind, play]);

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    const d = descriptorRef.current;
    if (!v || !d) return;
    const now = v.currentTime;
    const last = lastTimeRef.current;
    lastTimeRef.current = now;
    if (phaseRef.current.kind !== 'playing' || v.paused) return;
    if (last !== null) {
      const delta = now - last;
      if (delta > 0 && delta <= 2) {
        watchedRef.current += delta;
        elapsedRef.current += delta;
        if (elapsedRef.current >= 1) { const whole = Math.floor(elapsedRef.current); elapsedRef.current -= whole; dispatch({ type: 'ELAPSED', seconds: whole }); }
      }
    }
    // Daily cap: today's server seconds + what was watched in this window.
    if (d.totals.todaySec + watchedRef.current >= d.totals.dailyCapClientStopSec) {
      v.pause();
      schedulerRef.current?.end();
      dispatch({ type: 'DAILY_CAP' });
    }
  }, []);

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    const d = descriptorRef.current;
    if (!v || !d) return;
    const pos = d.resume.positionSec;
    if (pos > 0 && Number.isFinite(v.duration) && pos < v.duration - 1) { try { v.currentTime = pos; } catch { /* not seekable yet */ } }
    lastTimeRef.current = v.currentTime;
  }, []);

  const onMediaEnded = useCallback(() => {
    counterRef.current?.stop();
    schedulerRef.current?.end();
    dispatch({ type: 'MEDIA_ENDED' });
  }, []);

  const endForSwitch = useCallback(async () => {
    counterRef.current?.stop();
    const s = schedulerRef.current;
    if (s && s.hasStarted && !s.hasEnded) { s.end(); await s.flush(); }
  }, []);

  const exit = useCallback(async () => {
    dispatch({ type: 'EXIT' });
    videoRef.current?.pause();
    counterRef.current?.stop();
    const s = schedulerRef.current;
    if (s && s.hasStarted && !s.hasEnded) { s.end(); await s.flush(); }
    const t = descriptorRef.current?.playToken;
    if (t) { try { await playerApi.close(t); closed.current = true; storeToken(''); } catch { /* lock expires on its own */ } }
  }, []);

  const retrySave = useCallback(() => { const s = schedulerRef.current; if (s && s.hasStarted && !s.hasEnded) s.tickNow(); }, []);
  const acknowledgeIdle = useCallback(() => dispatch({ type: 'IDLE_ACTIVITY' }), []);
  const watchedSec = useCallback(() => (packageRef.current ? counterRef.current?.seconds ?? 0 : Math.floor(watchedRef.current)), []);

  return {
    state, videoRef, iframeRef, isPackage, open, play, pause, onTimeUpdate, onLoadedMetadata, onMediaEnded,
    onPackageLoaded, packageElapsedSec, packagePlayheadSec, packageCounting,
    exit, endForSwitch, retrySave, acknowledgeIdle, watchedSec,
  };
}
