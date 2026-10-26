import { describe, expect, it } from 'vitest';
import { blockReasonFor, canPlay, initialPlayerState, phaseForDescriptor, playerReducer, type PlayerState } from '../shared/player/playerReducer';
import type { PlayerDescriptor } from '../shared/api/schemas';

const descriptor = (over: Partial<PlayerDescriptor['gates']> = {}, extra: Partial<PlayerDescriptor> = {}): PlayerDescriptor => ({
  playToken: 'tok',
  study: { seq: 1, lectureCode: 'ARC2026', serviceType: 'A', mode: 'REFUND', lectureStart: '2026-10-02', lectureEnd: '2026-12-31', passOk: false },
  contentLectureCode: 'D00001',
  chapter: { chapterSeq: 1002, number: 2, title: '2차시', minutes: 30, contentsIdx: 12, contentsDetailSeq: 121, contentsType: 'B', url: '/contents/D00001/02.mp4', mobileUrl: null, progress: 0, studyTime: 0, lastStudy: null, total: 2, completeTimeSec: 1800 },
  chapters: [],
  resume: { positionSec: 120, studyTimeSec: 0 },
  totals: { recognizedSec: 54000, todaySec: 1800, dailyCapSec: 28800, dailyCapClientStopSec: 28770 },
  gates: { identity: 'ok', dailyCapReached: false, dailyCapApplies: true, alreadyDone: false, ...over },
  tick: { intervalMs: 60000, heartbeatMs: 60000, idleTimeoutMs: 7200000 },
  identityUrl: null,
  review: { mine: 0 },
  assessment: { postDone: false },
  ...extra,
});

const run = (events: Parameters<typeof playerReducer>[1][], from: PlayerState = initialPlayerState) => events.reduce(playerReducer, from);

describe('playerReducer', () => {
  it('opens into ready when every gate passes and seeds the ack summary from the descriptor', () => {
    const s = run([{ type: 'OPEN' }, { type: 'OPENED', descriptor: descriptor() }]);
    expect(s.phase).toEqual({ kind: 'ready' });
    expect(s.ack.positionSec).toBe(120);
    expect(s.ack.chapterProgress).toBe(0);
  });

  it('identity gate → identityCheck → ready after IDENTITY_OK', () => {
    const s = run([{ type: 'OPEN' }, { type: 'OPENED', descriptor: descriptor({ identity: 'required' }) }]);
    expect(s.phase.kind).toBe('identityCheck');
    expect(canPlay(s.phase)).toBe(false);
    expect(run([{ type: 'IDENTITY_OK' }], s).phase.kind).toBe('ready');
  });

  it('daily cap gate blocks immediately', () => {
    expect(phaseForDescriptor(descriptor({ dailyCapReached: true }))).toEqual({ kind: 'blocked', reason: 'dailyCap' });
  });

  it('maps session errors to block reasons (PLAYLOCK keeps details.lastHeartbeat)', () => {
    const s = run([{ type: 'OPEN' }, { type: 'OPEN_FAILED', code: 'PLAYLOCK', status: 409, message: '다른 창', details: { lastHeartbeat: '2026-10-12 10:00:00' } }]);
    expect(s.phase).toMatchObject({ kind: 'blocked', reason: 'playlock', message: '다른 창', details: { lastHeartbeat: '2026-10-12 10:00:00' } });
    expect(blockReasonFor('PRE_ASSESSMENT_REQUIRED')).toBe('preAssessment');
    expect(blockReasonFor('PERIOD_EXPIRED')).toBe('periodExpired');
    expect(blockReasonFor('NO_ACCESS')).toBe('noAccess');
    expect(blockReasonFor('SESSION_EXPIRED')).toBe('sessionExpired');
    expect(blockReasonFor('WHATEVER', 401)).toBe('sessionExpired');
  });

  it('playing ⇄ paused and ended', () => {
    const ready = run([{ type: 'OPEN' }, { type: 'OPENED', descriptor: descriptor() }]);
    const playing = playerReducer(ready, { type: 'PLAY' });
    expect(playing.phase.kind).toBe('playing');
    const paused = playerReducer(playing, { type: 'PAUSE' });
    expect(paused.phase).toEqual({ kind: 'paused', reason: 'user' });
    expect(playerReducer(paused, { type: 'PLAY' }).phase.kind).toBe('playing');
    const ended = playerReducer(playing, { type: 'MEDIA_ENDED' });
    expect(ended.phase.kind).toBe('ended');
    expect(canPlay(ended.phase)).toBe(true);
  });

  it('ack: StudyTime/Total_Progress come only from the server; F pauses with the message; Overlap pauses; DailyCap blocks', () => {
    const playing = run([{ type: 'OPEN' }, { type: 'OPENED', descriptor: descriptor() }, { type: 'PLAY' }]);
    const ok = playerReducer(playing, { type: 'TICK_ACK', step: 'Middle', ack: { ChkError: 'N', StudyTime: 63, PositionSec: 183, ChapterProgress: 10, Total_Progress: 100, PassOk: 'Y' } });
    expect(ok.ack).toEqual({ studyTime: 63, chapterProgress: 10, totalProgress: 100, passOk: true, positionSec: 183 });
    expect(ok.phase.kind).toBe('playing');
    expect(ok.saveStatus).toBe('SAVED');
    const failed = playerReducer(playing, { type: 'TICK_ACK', step: 'Middle', ack: { ChkError: 'F', message: '사전진단 필요' } });
    expect(failed.phase).toEqual({ kind: 'paused', reason: 'serverError' });
    expect(failed.notice).toBe('사전진단 필요');
    const overlap = playerReducer(playing, { type: 'TICK_ACK', step: 'Middle', ack: { ChkError: 'N', Overlap: 'Y' } });
    expect(overlap.phase).toEqual({ kind: 'paused', reason: 'overlap' });
    const cap = playerReducer(playing, { type: 'TICK_ACK', step: 'Middle', ack: { ChkError: 'N', DailyCap: 'Y' } });
    expect(cap.phase).toMatchObject({ kind: 'blocked', reason: 'dailyCap' });
    expect(playerReducer(playing, { type: 'TICK_FAILED', step: 'Middle' }).saveStatus).toBe('SAVE_FAILED');
  });

  it('heartbeat other_session → playlock block, session_expired → sessionExpired; idle warning/timeout; exiting ignores late failures', () => {
    const playing = run([{ type: 'OPEN' }, { type: 'OPENED', descriptor: descriptor() }, { type: 'PLAY' }]);
    expect(playerReducer(playing, { type: 'HEARTBEAT_FAILED', error: 'other_session' }).phase).toMatchObject({ kind: 'blocked', reason: 'playlock' });
    expect(playerReducer(playing, { type: 'HEARTBEAT_FAILED', error: 'session_expired' }).phase).toMatchObject({ kind: 'blocked', reason: 'sessionExpired' });
    const warned = playerReducer(playing, { type: 'IDLE_WARN' });
    expect(warned.idleWarning).toBe(true);
    expect(playerReducer(warned, { type: 'IDLE_ACTIVITY' }).idleWarning).toBe(false);
    expect(playerReducer(warned, { type: 'IDLE_TIMEOUT' }).phase).toMatchObject({ kind: 'blocked', reason: 'idleTimeout' });
    const exiting = playerReducer(playing, { type: 'EXIT' });
    expect(exiting.phase.kind).toBe('exiting');
    expect(playerReducer(exiting, { type: 'HEARTBEAT_FAILED', error: 'other_session' }).phase.kind).toBe('exiting');
    expect(playerReducer(exiting, { type: 'SESSION_EXPIRED' }).phase.kind).toBe('exiting');
  });

  it('local elapsed only accumulates while playing', () => {
    const ready = run([{ type: 'OPEN' }, { type: 'OPENED', descriptor: descriptor() }]);
    expect(playerReducer(ready, { type: 'ELAPSED', seconds: 5 }).localElapsedSec).toBe(0);
    expect(run([{ type: 'PLAY' }, { type: 'ELAPSED', seconds: 5 }, { type: 'ELAPSED', seconds: 2 }], ready).localElapsedSec).toBe(7);
  });
});
