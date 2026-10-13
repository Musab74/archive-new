import { z } from 'zod';
import { api } from '../client';
import {
  BadgesSchema, CertificateListItemSchema, CertificateSchema, CompanySchema, CompletionRecordSchema, CorrectionNoticesSchema, CounselSchema, DashboardSchema, HistoryRecordSchema, LearnerProfileSchema, MyStatusSchema, OkSchema, pageOf, RankingSchema, RecordChaptersSchema, SavedItemSchema, WeeklySchema,
  type Badges, type Certificate, type CertificateListItem, type Company, type CompletionRecord, type CorrectionNotices, type Counsel, type Dashboard, type HistoryRecord, type LearnerProfile, type MyStatus, type Ranking, type RecordChapters, type SavedItem, type Weekly,
} from '../schemas';

export interface HistoryQuery { tab: 'records' | 'completion'; page?: number; size?: number; q?: string; from?: string; to?: string }
export interface Page<T> { items: T[]; page: number; size: number; total: number }
export type ProfilePatch = { email?: string; mobile?: string; tel?: string; zipcode?: string; address01?: string; address02?: string; depart?: string; position?: string; etc01?: string };

export const myRoomApi = {
  status: (signal?: AbortSignal) => api.get<MyStatus>('/my/status', { schema: MyStatusSchema, signal }),
  dashboard: (signal?: AbortSignal) => api.get<Dashboard>('/my/dashboard', { schema: DashboardSchema, signal }),
  historyRecords: (q: Omit<HistoryQuery, 'tab'>, signal?: AbortSignal) => api.get<Page<HistoryRecord>>('/my/history', { query: { ...q, tab: 'records' }, schema: pageOf(HistoryRecordSchema), signal }),
  historyCompletion: (q: Omit<HistoryQuery, 'tab'>, signal?: AbortSignal) => api.get<Page<CompletionRecord>>('/my/history', { query: { ...q, tab: 'completion' }, schema: pageOf(CompletionRecordSchema), signal }),
  recordChapters: (studySeq: number, signal?: AbortSignal) => api.get<RecordChapters>(`/my/records/${studySeq}/chapters`, { schema: RecordChaptersSchema, signal }),
  certificates: (signal?: AbortSignal) => api.get<CertificateListItem[]>('/my/certificates', { schema: z.array(CertificateListItemSchema), signal }),
  certificate: (studySeq: number, signal?: AbortSignal) => api.get<Certificate>(`/my/certificates/${studySeq}`, { schema: CertificateSchema, signal }),
  saved: (signal?: AbortSignal) => api.get<SavedItem[]>('/my/saved', { schema: z.array(SavedItemSchema), signal }),
  unsave: (lectureCode: string) => api.delete<{ ok: boolean; removed?: number }>(`/my/saved/${encodeURIComponent(lectureCode)}`, { schema: OkSchema.extend({ removed: z.number().optional() }) }),
  badges: (signal?: AbortSignal) => api.get<Badges>('/my/badges', { schema: BadgesSchema, signal }),
  ranking: (scope: 'all' | 'company', signal?: AbortSignal) => api.get<Ranking>('/my/ranking', { query: { scope }, schema: RankingSchema, signal }),
  weekly: (signal?: AbortSignal) => api.get<Weekly>('/my/report/weekly', { schema: WeeklySchema, signal }),
  notices: (signal?: AbortSignal) => api.get<CorrectionNotices>('/my/notices', { schema: CorrectionNoticesSchema, signal }),
  ackNotices: () => api.post<{ ok: boolean; updated?: number }>('/my/notices/ack', undefined, { schema: OkSchema.extend({ updated: z.number().optional() }) }),
  me: (signal?: AbortSignal) => api.get<LearnerProfile>('/members/me', { schema: LearnerProfileSchema, signal }),
  updateMe: (patch: ProfilePatch) => api.patch<LearnerProfile>('/members/me', patch, { schema: LearnerProfileSchema }),
  company: (signal?: AbortSignal) => api.get<Company>('/members/me/company', { schema: CompanySchema, signal }),
  /** Consent flags (AR-18 토글). marketing: N / E(email) / S(sms) / Y(both). */
  terms: (body: { mandatory: boolean; sending: boolean; marketing: 'N' | 'E' | 'S' | 'Y' }) => api.post<{ ok: boolean; consents?: unknown }>('/members/me/terms', body, { schema: OkSchema.extend({ consents: z.unknown().optional() }) }),
  counsel: (q: { page?: number; size?: number; q?: string }, signal?: AbortSignal) => api.get<Page<Counsel>>('/support/counsel', { query: q, schema: pageOf(CounselSchema), signal }),
};
