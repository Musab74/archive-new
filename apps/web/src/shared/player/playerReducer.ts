import type { PlayerDescriptor, TickAck } from '../api/schemas';
import type { SaveStatus, TickStep } from './tickScheduler';
import type { PackageSource } from './packageSource';

export type BlockReason = 'playlock' | 'dailyCap' | 'idleTimeout' | 'sessionExpired' | 'periodExpired' | 'preAssessment' | 'noAccess' | 'notFound' | 'unknown';

export type PlayerPhase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'identityCheck' }
  | { kind: 'ready' }
  | { kind: 'playing' }
  | { kind: 'paused'; reason: 'user' | 'overlap' | 'serverError' | 'idleWarn' }
  | { kind: 'blocked'; reason: BlockReason; message?: string; details?: unknown }
  | { kind: 'ended' }
  | { kind: 'exiting' };

export interface AckSummary {
  /** Chapter StudyTime from the latest ack (seconds). Shown as-is; never computed client-side. */
  studyTime: number | null;
  chapterProgress: number | null;
  totalProgress: number | null;
  passOk: boolean | null;
  positionSec: number | null;
}

export interface PlayerState {
  phase: PlayerPhase;
  descriptor: PlayerDescriptor | null;
  saveStatus: SaveStatus;
  ack: AckSummary;
  /** Server message from the last ChkError F / Overlap response. */
  notice: string | null;
  idleWarning: boolean;
  /** Seconds played locally in this window (for the daily-cap client stop); not shown as credit. */
  localElapsedSec: number;
  /** Packaged (type A) content only: how the position is derived for ticks. Null for real media / before load. */
  packageSource: PackageSource | null;
}

export type PlayerEvent =
  | { type: 'OPEN' }
  | { type: 'OPENED'; descriptor: PlayerDescriptor }
  | { type: 'OPEN_FAILED'; code: string; message?: string; details?: unknown; status?: number }
  | { type: 'IDENTITY_OK' }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'MEDIA_ENDED' }
  | { type: 'ELAPSED'; seconds: number }
  | { type: 'PACKAGE_SOURCE'; source: PackageSource }
  | { type: 'SAVE_STATUS'; status: SaveStatus }
  | { type: 'TICK_ACK'; step: TickStep; ack: TickAck }
  | { type: 'TICK_FAILED'; step: TickStep }
  | { type: 'HEARTBEAT_FAILED'; error: string; message?: string }
  | { type: 'DAILY_CAP' }
  | { type: 'IDLE_WARN' }
  | { type: 'IDLE_ACTIVITY' }
  | { type: 'IDLE_TIMEOUT' }
  | { type: 'SESSION_EXPIRED' }
  | { type: 'EXIT' }
  | { type: 'RESET' };

export const initialPlayerState: PlayerState = {
  phase: { kind: 'idle' },
  descriptor: null,
  saveStatus: 'IDLE',
  ack: { studyTime: null, chapterProgress: null, totalProgress: null, passOk: null, positionSec: null },
  notice: null,
  idleWarning: false,
  localElapsedSec: 0,
  packageSource: null,
};

/** Maps a POST /player/session error code onto the block reason shown full-screen. */
export function blockReasonFor(code: string, status?: number): BlockReason {
  switch (code) {
    case 'PLAYLOCK': return 'playlock';
    case 'DAILY_CAP': return 'dailyCap';
    case 'PERIOD_EXPIRED': return 'periodExpired';
    case 'PRE_ASSESSMENT_REQUIRED': return 'preAssessment';
    case 'NO_ACCESS': case 'FORBIDDEN': return 'noAccess';
    case 'SESSION_EXPIRED': case 'UNAUTHENTICATED': case 'OTHER_SESSION': return 'sessionExpired';
    case 'NOT_FOUND': return 'notFound';
    default: return status === 401 ? 'sessionExpired' : 'unknown';
  }
}

/** Where the window lands after the session descriptor arrives: identity gate → daily cap → ready. */
export function phaseForDescriptor(d: PlayerDescriptor): PlayerPhase {
  if (d.gates.identity === 'required') return { kind: 'identityCheck' };
  if (d.gates.dailyCapReached) return { kind: 'blocked', reason: 'dailyCap' };
  return { kind: 'ready' };
}

const isActive = (p: PlayerPhase) => p.kind === 'playing' || p.kind === 'paused' || p.kind === 'ready';

export function playerReducer(state: PlayerState, ev: PlayerEvent): PlayerState {
  const { phase } = state;
  switch (ev.type) {
    case 'RESET': return initialPlayerState;
    case 'OPEN': return { ...initialPlayerState, phase: { kind: 'loading' } };
    case 'OPENED': {
      const d = ev.descriptor;
      return {
        ...state,
        descriptor: d,
        phase: phaseForDescriptor(d),
        notice: null,
        ack: { ...initialPlayerState.ack, studyTime: d.chapter.studyTime, chapterProgress: d.chapter.progress, positionSec: d.resume.positionSec },
      };
    }
    case 'OPEN_FAILED': return { ...state, descriptor: null, phase: { kind: 'blocked', reason: blockReasonFor(ev.code, ev.status), message: ev.message, details: ev.details } };
    case 'IDENTITY_OK': return phase.kind === 'identityCheck' ? { ...state, phase: { kind: 'ready' } } : state;
    case 'PLAY':
      if (phase.kind === 'ready' || phase.kind === 'paused' || phase.kind === 'ended') return { ...state, phase: { kind: 'playing' }, notice: phase.kind === 'paused' && phase.reason === 'user' ? state.notice : null };
      return state;
    case 'PAUSE': return phase.kind === 'playing' ? { ...state, phase: { kind: 'paused', reason: 'user' } } : state;
    case 'MEDIA_ENDED': return phase.kind === 'playing' || phase.kind === 'paused' ? { ...state, phase: { kind: 'ended' } } : state;
    case 'ELAPSED': return phase.kind === 'playing' ? { ...state, localElapsedSec: state.localElapsedSec + Math.max(0, ev.seconds) } : state;
    case 'PACKAGE_SOURCE': return state.packageSource === ev.source ? state : { ...state, packageSource: ev.source };
    case 'SAVE_STATUS': return { ...state, saveStatus: ev.status };
    case 'TICK_FAILED': return { ...state, saveStatus: 'SAVE_FAILED' };
    case 'TICK_ACK': {
      const a = ev.ack;
      const ack: AckSummary = {
        studyTime: typeof a.StudyTime === 'number' ? a.StudyTime : state.ack.studyTime,
        chapterProgress: typeof a.ChapterProgress === 'number' ? a.ChapterProgress : state.ack.chapterProgress,
        totalProgress: typeof a.Total_Progress === 'number' ? a.Total_Progress : state.ack.totalProgress,
        passOk: a.PassOk === 'Y' ? true : a.PassOk === 'N' ? false : state.ack.passOk,
        positionSec: typeof a.PositionSec === 'number' ? a.PositionSec : state.ack.positionSec,
      };
      const next = { ...state, ack, saveStatus: 'SAVED' as SaveStatus };
      if (a.DailyCap === 'Y') return { ...next, phase: { kind: 'blocked', reason: 'dailyCap', message: a.message } };
      if (a.ChkError === 'F') return { ...next, notice: a.message ?? null, phase: phase.kind === 'playing' ? { kind: 'paused', reason: 'serverError' } : phase };
      if (a.Overlap === 'Y') return { ...next, notice: a.message ?? null, phase: phase.kind === 'playing' ? { kind: 'paused', reason: 'overlap' } : phase };
      return next;
    }
    case 'HEARTBEAT_FAILED':
      if (phase.kind === 'exiting') return state;
      return { ...state, phase: { kind: 'blocked', reason: ev.error === 'other_session' ? 'playlock' : 'sessionExpired', message: ev.message } };
    case 'DAILY_CAP': return isActive(phase) || phase.kind === 'ended' ? { ...state, phase: { kind: 'blocked', reason: 'dailyCap' } } : state;
    case 'IDLE_WARN': return isActive(phase) ? { ...state, idleWarning: true } : state;
    case 'IDLE_ACTIVITY': return state.idleWarning ? { ...state, idleWarning: false } : state;
    case 'IDLE_TIMEOUT': return phase.kind === 'exiting' ? state : { ...state, idleWarning: false, phase: { kind: 'blocked', reason: 'idleTimeout' } };
    case 'SESSION_EXPIRED': return phase.kind === 'exiting' ? state : { ...state, phase: { kind: 'blocked', reason: 'sessionExpired' } };
    case 'EXIT': return { ...state, idleWarning: false, phase: { kind: 'exiting' } };
    default: return state;
  }
}

/** True when the custom controls may start playback. */
export const canPlay = (p: PlayerPhase): boolean => p.kind === 'ready' || p.kind === 'paused' || p.kind === 'ended';
