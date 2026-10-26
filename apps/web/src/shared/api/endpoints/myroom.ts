import { z } from 'zod';
import { api, API_BASE, AppError, refreshAccessToken } from '../client';
import { tokenStore } from '../../auth/tokenStore';
import {
  ArchivingDetailSchema, ArchivingListSchema, CourseHistorySchema, MyEventsSchema, MyInsightSchema, MyLevelSchema, MyReportSchema,
  type ArchivingDetail, type ArchivingList, type CourseHistory, type MyEvents, type MyInsight, type MyLevel, type MyReportData,
  BadgesSchema, CertificateListItemSchema, CertificateSchema, CompanySchema, CompletionRecordSchema, CorrectionNoticesSchema, CounselSchema, DashboardSchema, HistoryRecordSchema, LearnerProfileSchema, MyStatusSchema, OkSchema, pageOf, RankingSchema, RecordChaptersSchema, SavedItemSchema, WeeklySchema,
  type Badges, type Certificate, type CertificateListItem, type Company, type CompletionRecord, type CorrectionNotices, type Counsel, type Dashboard, type HistoryRecord, type LearnerProfile, type MyStatus, type Ranking, type RecordChapters, type SavedItem, type Weekly,
} from '../schemas';

export interface CourseHistoryQuery { page?: number; size?: number; status?: 'all' | 'progress' | 'completed'; year?: number; q?: string; sort?: 'latest' | 'progress' | 'completed'; studySeq?: number; from?: string; to?: string; rating?: 'rated' | 'unrated' }
type Q = Record<string, string | number | boolean | undefined | null>;

/**
 * GETs a learner file (PDF / attachment) with the bearer token. JSON error bodies become AppError with the API message, so the PHP
 * alert texts ("미수료 상태에서는 수료증을 발급할 수 없습니다." / "출력 가능일: …") reach the screen.
 */
export async function fetchLearnerFile(path: string, query: Q = {}): Promise<{ blob: Blob; fileName: string | null; inline: boolean }> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const qs = params.toString();
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
  const go = () => fetch(url, { headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}` }, credentials: 'include' });
  let res = await go();
  if (res.status === 401 && (await refreshAccessToken())) res = await go();
  if (!res.ok) {
    let body: { code?: string; message?: string; error?: { code?: string; message?: string } } = {};
    try { body = await res.json(); } catch { /* not JSON */ }
    const message = body.error?.message ?? body.message ?? (res.status === 403 ? '권한이 없습니다.' : '파일을 내려받지 못했습니다.');
    throw new AppError(body.error?.code ?? body.code ?? (res.status === 403 ? 'NO_ACCESS' : res.status === 404 ? 'NOT_FOUND' : 'INTERNAL'), message, res.status);
  }
  const cd = res.headers.get('Content-Disposition') ?? '';
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1];
  const plain = /filename="?([^";]+)"?/i.exec(cd)?.[1];
  return { blob: await res.blob(), fileName: star ? decodeURIComponent(star) : plain ?? null, inline: /^\s*inline/i.test(cd) };
}

/** Opens a PDF like the PHP popup (inline → new tab opened in the click handler, else a download). */
export async function openLearnerPdf(path: string, query: Q, win?: Window | null): Promise<void> {
  try {
    const f = await fetchLearnerFile(path, query);
    const pdf = f.blob.type === 'application/pdf' ? f.blob : new Blob([f.blob], { type: 'application/pdf' });
    const href = URL.createObjectURL(pdf);
    if (f.inline && win && !win.closed) { win.location.href = href; return; }
    win?.close();
    saveHref(href, f.fileName ?? 'certificate.pdf');
  } catch (err) { win?.close(); throw err; }
}
/** Saves a learner attachment under its original name. */
export async function downloadLearnerFile(path: string, fallbackName: string): Promise<void> {
  const f = await fetchLearnerFile(path);
  saveHref(URL.createObjectURL(f.blob), f.fileName ?? fallbackName);
}
function saveHref(href: string, fileName: string) {
  const a = document.createElement('a'); a.href = href; a.download = fileName; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

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
  courses: (q: CourseHistoryQuery, signal?: AbortSignal) => api.get<CourseHistory>('/my/courses', { query: q as Q, schema: CourseHistorySchema, signal }),
  level: (signal?: AbortSignal) => api.get<MyLevel>('/my/level', { schema: MyLevelSchema, signal }),
  insight: (signal?: AbortSignal) => api.get<MyInsight>('/my/insight', { schema: MyInsightSchema, signal }),
  report: (studySeq?: number, signal?: AbortSignal) => api.get<MyReportData>('/my/report', { query: { studySeq }, schema: MyReportSchema, signal }),
  events: (signal?: AbortSignal) => api.get<MyEvents>('/my/events', { schema: MyEventsSchema, signal }),
  /** 수료증 PDF (include/certificate_pdf01.php) — `win` opened synchronously in the click handler. */
  certificatePdf: (studySeq: number, win?: Window | null) => openLearnerPdf(`/my/certificates/${studySeq}/pdf`, {}, win),
  /** 이수증 PDF (public/mypage/certificate_pdf01.php). */
  subjectCertificatePdf: (lectureCode: string, seq: number | undefined, win?: Window | null) => openLearnerPdf('/my/certificates/subject/pdf', { lectureCode, seq }, win),
  archiving: (signal?: AbortSignal) => api.get<ArchivingList>('/my/archiving', { schema: ArchivingListSchema, signal }),
  archivingDetail: (idx: number, signal?: AbortSignal) => api.get<ArchivingDetail>(`/my/archiving/${idx}`, { schema: ArchivingDetailSchema, signal }),
  archivingCreate: (form: FormData) => api.post<{ ok: boolean; idx?: number; message?: string }>('/my/archiving', form, { schema: OkSchema.extend({ idx: z.number().optional(), message: z.string().optional() }) }),
  archivingDownload: (idx: number, fallbackName: string) => downloadLearnerFile(`/my/archiving/${idx}/file`, fallbackName),
  removeSaved: (likeIdx: number[]) => api.post<{ ok: boolean; removed?: number }>('/my/saved/remove', { likeIdx }, { schema: OkSchema.extend({ removed: z.number().optional() }) }),
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
