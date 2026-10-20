import type { ProgressTick } from '@ainex/contracts';
import { api, API_BASE, request } from '../client';
import { tokenStore } from '../../auth/tokenStore';
import { HeartbeatAckSchema, PlayerChapterSchema, PlayerDescriptorSchema, TickAckSchema, type HeartbeatAck, type PlayerChapter, type PlayerDescriptor, type TickAck } from '../schemas';
import { z } from 'zod';

export interface OpenSessionBody { lectureCode: string; chapterNumber: string; studySeq?: number; playToken?: string; takeover?: boolean }

/**
 * Fire-and-forget POST that survives page unload. The API only accepts a Bearer header, which `navigator.sendBeacon`
 * cannot send, so a keepalive fetch (carries the header) goes first; sendBeacon with ?token= (LearnerGuard and the
 * write gate both read it) is the fallback when fetch/keepalive is unavailable. Returns true when a request was handed to the browser.
 */
function sendKeepalive(path: string, body: unknown): boolean {
  const token = tokenStore.get();
  const url = `${API_BASE}${path}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  const json = JSON.stringify(body);
  try {
    if (typeof fetch === 'function') {
      void fetch(url, { method: 'POST', keepalive: true, credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: json }).catch(() => undefined);
      return true;
    }
  } catch { /* fall through to beacon */ }
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') return navigator.sendBeacon(url, new Blob([json], { type: 'application/json' }));
  } catch { /* ignore */ }
  return false;
}

export const playerApi = {
  /** Runs every gate (enrollment, 사전진단, 본인인증, PlayLock) and returns the descriptor; `takeover` replaces another window's lock. */
  open: (body: OpenSessionBody, signal?: AbortSignal) => api.post<PlayerDescriptor>('/player/session', body, { schema: PlayerDescriptorSchema, signal }),
  /** DELETE with a JSON body (the API reads playToken from the body so a blocked second tab cannot release the lock). */
  close: (playToken: string) => request<{ released: boolean }>('/player/session', { method: 'DELETE', body: { playToken }, schema: z.object({ released: z.boolean() }) }),
  heartbeat: (playToken: string, signal?: AbortSignal) => api.post<HeartbeatAck>('/player/heartbeat', { playToken }, { schema: HeartbeatAckSchema, signal }),
  tick: (body: ProgressTick, signal?: AbortSignal) => api.post<TickAck>('/player/progress', body, { schema: TickAckSchema, signal }),
  chapters: (studySeq: number, lectureCode: string, signal?: AbortSignal) => api.get<{ chapters: PlayerChapter[] }>(`/player/chapters/${studySeq}`, { query: { lectureCode }, schema: z.object({ chapters: z.array(PlayerChapterSchema) }), signal }),
  dailyTime: (signal?: AbortSignal) => api.get<{ date: string; seconds: number; capSeconds: number }>('/player/daily-time', { signal }),
  /** Fire-and-forget End tick for pagehide / unmount. */
  beaconTick: (body: ProgressTick): boolean => sendKeepalive('/player/progress', body),
  /** Fire-and-forget lock release for pagehide / unmount, so closing the tab frees the PlayLock at once (not after 90 s). */
  release: (playToken: string): boolean => sendKeepalive('/player/session/release', { playToken }),
};
