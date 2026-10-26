import { useQuery } from '@tanstack/react-query';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { enrollmentApi } from '../../shared/api/endpoints/enrollment';
import { assessmentApi } from '../../shared/api/endpoints/assessment';
import type { Enrollment, MyStatus } from '../../shared/api/schemas';

export const qk = {
  status: ['my', 'status'] as const,
  dashboard: ['my', 'dashboard'] as const,
  enrollments: ['enrollments', 'me'] as const,
  current: ['enrollments', 'current'] as const,
  preStatus: (seq?: number | null) => ['assessment', 'pre-status', seq ?? 'current'] as const,
  result: (seq?: number | null) => ['assessment', 'result', seq ?? 'current'] as const,
  notices: ['my', 'notices'] as const,
};

export const useMyStatus = () => useQuery({ queryKey: qk.status, queryFn: ({ signal }) => myRoomApi.status(signal) });
export const useDashboard = () => useQuery({ queryKey: qk.dashboard, queryFn: ({ signal }) => myRoomApi.dashboard(signal) });
export const useEnrollments = () => useQuery({ queryKey: qk.enrollments, queryFn: ({ signal }) => enrollmentApi.list(signal) });
export const useCurrentEnrollment = () => useQuery({ queryKey: qk.current, queryFn: ({ signal }) => enrollmentApi.current(signal) });
export const usePreStatus = (seq?: number | null, enabled = true) => useQuery({ queryKey: qk.preStatus(seq), queryFn: ({ signal }) => assessmentApi.preStatus(seq ?? undefined, signal), enabled });
export const useAssessmentResult = (seq?: number | null, enabled = true) => useQuery({ queryKey: qk.result(seq), queryFn: ({ signal }) => assessmentApi.result(seq ?? undefined, signal), enabled });

export type UsageMode = 'refund' | 'general';
export type UsageState = 'ACTIVE' | 'BEFORE' | 'ENDED' | 'NONE';

/** Derives mode/state from /my/status (in-window enrollment) and /enrollments/me (for BEFORE/ENDED when no active one). */
export function usageOf(status: MyStatus | null | undefined, enrollments: Enrollment[] | undefined): { mode: UsageMode; state: UsageState; enrollment: Enrollment | null } {
  const active = status?.studySeq != null ? enrollments?.find((e) => e.studySeq === status.studySeq) ?? null : null;
  // /my/status falls back to the newest row when nothing is in its window; usageState says which case it is (data-logic.php:142-194).
  if (status?.studySeq != null && status.usageState && status.usageState !== 'ACTIVE') return { mode: modeOf(status.serviceType, status.serviceTypeLabel), state: status.usageState, enrollment: active };
  if (status?.studySeq != null) return { mode: modeOf(status.serviceType, status.serviceTypeLabel), state: 'ACTIVE', enrollment: active };
  const list = enrollments ?? [];
  const before = list.find((e) => e.state === 'BEFORE');
  if (before) return { mode: modeOf(before.serviceType, undefined, before.mode), state: 'BEFORE', enrollment: before };
  const ended = list.find((e) => e.state === 'ENDED'); // the list is newest first (LectureStart DESC)
  if (ended) return { mode: modeOf(ended.serviceType, undefined, ended.mode), state: 'ENDED', enrollment: ended };
  return { mode: 'general', state: 'NONE', enrollment: null };
}

export function modeOf(serviceType?: string | null, label?: string, mode?: string): UsageMode {
  if (mode === 'NON_REFUND' || serviceType === 'W' || label === '비환급') return 'general';
  return 'refund';
}

/** "2026-10-12 18:09:02" → "2026.10.12 18:09" */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return iso;
  return m[4] ? `${m[1]}.${m[2]}.${m[3]} ${m[4]}:${m[5]}` : `${m[1]}.${m[2]}.${m[3]}`;
}
export function fmtDate(iso: string | null | undefined): string { return fmtDateTime(iso).slice(0, 10); }
export const todayLabel = () => fmtDateTime(new Date().toISOString().replace('T', ' '));

/** Learn link for a content row: the saved chapter (Progress.Chapter_Seq) of that enrollment, else the content page. */
export const resumeLink = (r: { studySeq: number; lectureCode: string; resumeChapterSeq?: number | null }) =>
  r.resumeChapterSeq && r.studySeq ? `/learn/${r.studySeq}/${r.resumeChapterSeq}?lectureCode=${encodeURIComponent(r.lectureCode)}` : `/courses/${encodeURIComponent(r.lectureCode)}`;
