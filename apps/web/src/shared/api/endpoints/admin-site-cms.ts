import { z } from 'zod';
import { API_BASE, api, AppError, refreshAdminAccessToken } from '../client';
import { adminTokenStore } from '../../auth/adminTokenStore';
import { pageOf } from '../schemas';
import { downloadAdminFile } from './admin';

type Q = Record<string, string | number | boolean | null | undefined>;
export interface Page<T> { items: T[]; page: number; size: number; total: number }

const nstr = z.string().nullable().optional();
const nnum = z.number().nullable().optional();
export const OkSchema = z.object({ ok: z.boolean() }).passthrough();
export type Ok = z.infer<typeof OkSchema>;

// 수강후기 (Review)
export const ReviewRowSchema = z.object({ idx: z.number(), lectureCode: nstr, courseName: nstr, id: nstr, starPoint: nnum, stars: z.string(), title: nstr, ip: nstr, regDate: nstr, viewCount: z.number() });
export type ReviewRow = z.infer<typeof ReviewRowSchema>;
export const ReviewDetailSchema = ReviewRowSchema.extend({ contents: nstr });
export type ReviewDetail = z.infer<typeof ReviewDetailSchema>;

// 아카이빙 (Archiving)
export const ArchivingRowSchema = z.object({ idx: z.number(), id: nstr, title: nstr, regDate: nstr, regDate2: nstr, status: nstr, statusLabel: z.string(), replier: nstr, hasFile: z.boolean() });
export type ArchivingRow = z.infer<typeof ArchivingRowSchema>;
export const ArchivingDetailSchema = z.object({ idx: z.number(), id: nstr, name: nstr, email: nstr, mobile: nstr, companyName: nstr, title: nstr, contents: nstr, regDate: nstr, fileName1: nstr, realFileName1: nstr, status: nstr, statusLabel: z.string(), name2: nstr, contents2: nstr, regDate2: nstr });
export type ArchivingDetail = z.infer<typeof ArchivingDetailSchema>;

// 학습자료실 (StudyPDS)
export const EdudataFileSchema = z.object({ slot: z.number(), fileName: nstr, realFileName: nstr });
export const EdudataRowSchema = z.object({ idx: z.number(), useYN: nstr, useLabel: nstr, notice: nstr, category: nstr, categoryLabel: z.string(), title: nstr, content: nstr, files: z.array(EdudataFileSchema), firstFile: nstr, viewCount: z.number(), regDate: nstr });
export type EdudataRow = z.infer<typeof EdudataRowSchema>;
export const EdudataPageSchema = pageOf(EdudataRowSchema).extend({ notices: z.array(EdudataRowSchema).default([]) });
export type EdudataPage = z.infer<typeof EdudataPageSchema>;
export const EdudataMetaSchema = z.object({ categories: z.array(z.object({ value: z.string(), label: z.string() })), uploadEnabled: z.boolean(), uploadDir: z.string() });
export type EdudataMeta = z.infer<typeof EdudataMetaSchema>;

// 이벤트관리 (LectureEvent)
export const LectureEventRowSchema = z.object({ idx: z.number(), id: nstr, name: nstr, mobile: nstr, stage: nnum, stageLabel: z.string(), stageCount: nnum, status: nstr, statusLabel: z.string(), regDate: nstr });
export type LectureEventRow = z.infer<typeof LectureEventRowSchema>;
export const LectureEventDetailSchema = LectureEventRowSchema.extend({ statusRegDate: nstr, statusName: nstr });
export type LectureEventDetail = z.infer<typeof LectureEventDetailSchema>;

// 팝업 (Popup / Popup_Link)
export const PopupMobileSchema = z.object({ imgName: nstr, imgWidth: z.string(), imgHeight: z.string(), popupLeft: z.string(), popupTop: z.string() });
export const PopupRowSchema = z.object({ idx: z.number(), title: nstr, imgName: nstr, imgWidth: nstr, imgHeight: nstr, popupLeft: nstr, popupTop: nstr, endDate: nstr, useYN: nstr, regDate: nstr, regDay: nstr, mobile: PopupMobileSchema });
export type PopupRow = z.infer<typeof PopupRowSchema>;
export const PopupPageSchema = pageOf(PopupRowSchema).extend({ uploadEnabled: z.boolean().default(false) });
export type PopupPage = z.infer<typeof PopupPageSchema>;
export const PopupLinkSchema = z.object({ num: z.number(), imgArea: nstr, linkUrl: nstr });
export type PopupLink = z.infer<typeof PopupLinkSchema>;
export const PopupDetailSchema = z.object({ popup: PopupRowSchema, links: z.array(PopupLinkSchema) });
export type PopupDetail = z.infer<typeof PopupDetailSchema>;

// 백업 목록 (backup_data_list)
export const BackupRowSchema = z.object({ idx: z.number(), regDate: nstr, regDay: nstr, backupType: nstr, backupInterval: nstr, expiryDate: nstr, expiryDay: nstr, webFile: nstr, weblogFile: nstr, dbFile: nstr, vodFile: nstr });
export type BackupRow = z.infer<typeof BackupRowSchema>;

// 접속통계 (Sta)
export const VisitStatsSchema = z.object({ year: z.number(), month: z.number(), days: z.array(z.object({ day: z.number(), total: z.number(), hours: z.array(z.number()) })), totals: z.object({ total: z.number(), hours: z.array(z.number()) }) });
export type VisitStats = z.infer<typeof VisitStatsSchema>;

// 정보수정 (StaffInfo)
export const MyInfoSchema = z.object({ id: z.string(), dept: nstr, deptIdx: z.number(), deptName: nstr, deptPath: z.string(), name: nstr, team: nstr, mobile: nstr, phone: nstr, email: nstr, bankName: nstr, bankNumber: nstr, useYN: nstr, lastLogin: nstr, lastLoginIp: nstr, showBank: z.boolean() });
export type MyInfo = z.infer<typeof MyInfoSchema>;

/** GET an authenticated binary (popup preview image) as an object URL; callers revoke it. */
export async function fetchAdminBlobUrl(path: string, query: Q = {}): Promise<string> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const qs = params.toString();
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
  const go = () => fetch(url, { headers: { Authorization: `Bearer ${adminTokenStore.get() ?? ''}` }, credentials: 'include' });
  let res = await go();
  if (res.status === 401 && (await refreshAdminAccessToken())) res = await go();
  if (!res.ok) throw new AppError(res.status === 404 ? 'NOT_FOUND' : 'INTERNAL', res.status === 404 ? '이미지가 없습니다.' : '이미지를 불러오지 못했습니다.', res.status);
  return URL.createObjectURL(await res.blob());
}

const formOf = (file: File) => { const fd = new FormData(); fd.append('file', file, file.name); return fd; };

/** /admin/* for 커뮤니티관리(수강후기·아카이빙·학습자료실·이벤트) + 사이트관리(팝업·백업·접속통계) + 정보수정. */
export const adminSiteCmsApi = {
  // 수강후기 F4
  reviews: (query: Q, signal?: AbortSignal) => api.get<Page<ReviewRow>>('/admin/reviews', { query, schema: pageOf(ReviewRowSchema), signal }),
  review: (idx: number, signal?: AbortSignal) => api.get<ReviewDetail>(`/admin/reviews/${idx}`, { schema: ReviewDetailSchema, signal }),
  deleteReview: (idx: number) => api.delete<Ok>(`/admin/reviews/${idx}`, { schema: OkSchema }),
  downloadReviewsCsv: (query: Q) => downloadAdminFile('/admin/reviews/export', query, 'reviews.csv'),

  // 아카이빙 F5
  archiving: (query: Q, signal?: AbortSignal) => api.get<Page<ArchivingRow>>('/admin/archiving', { query, schema: pageOf(ArchivingRowSchema), signal }),
  archivingDetail: (idx: number, signal?: AbortSignal) => api.get<ArchivingDetail>(`/admin/archiving/${idx}`, { schema: ArchivingDetailSchema, signal }),
  archivingReply: (idx: number, body: { Status: 'A' | 'B'; Name2: string; Contents2: string }) => api.patch<Ok>(`/admin/archiving/${idx}/reply`, body, { schema: OkSchema }),
  deleteArchiving: (idx: number) => api.delete<Ok>(`/admin/archiving/${idx}`, { schema: OkSchema }),
  downloadArchivingFile: (idx: number, name: string) => downloadAdminFile(`/admin/archiving/${idx}/file`, {}, name),

  // 학습자료실 F7
  edudata: (query: Q, signal?: AbortSignal) => api.get<EdudataPage>('/admin/edudata', { query, schema: EdudataPageSchema, signal }),
  edudataMeta: (signal?: AbortSignal) => api.get<EdudataMeta>('/admin/edudata/meta', { schema: EdudataMetaSchema, signal }),
  edudataDetail: (idx: number, signal?: AbortSignal) => api.get<EdudataRow>(`/admin/edudata/${idx}`, { schema: EdudataRowSchema, signal }),
  createEdudata: (body: Record<string, unknown>) => api.post<Ok & { idx: number }>('/admin/edudata', body, { schema: OkSchema.extend({ idx: z.number() }) }),
  patchEdudata: (idx: number, body: Record<string, unknown>) => api.patch<Ok>(`/admin/edudata/${idx}`, body, { schema: OkSchema }),
  deleteEdudata: (idx: number) => api.delete<Ok>(`/admin/edudata/${idx}`, { schema: OkSchema }),
  uploadEdudataFile: (idx: number, slot: number, file: File) => api.post<Ok>(`/admin/edudata/${idx}/files/${slot}`, formOf(file), { schema: OkSchema }),
  downloadEdudataFile: (idx: number, slot: number, name: string) => downloadAdminFile(`/admin/edudata/${idx}/files/${slot}`, {}, name),

  // 이벤트관리 F7
  lectureEvents: (query: Q, signal?: AbortSignal) => api.get<Page<LectureEventRow>>('/admin/lecture-events', { query, schema: pageOf(LectureEventRowSchema), signal }),
  lectureEvent: (idx: number, signal?: AbortSignal) => api.get<LectureEventDetail>(`/admin/lecture-events/${idx}`, { schema: LectureEventDetailSchema, signal }),
  setLectureEventStatus: (idx: number, body: { Status: 'A' | 'B'; StatusName: string }) => api.patch<Ok>(`/admin/lecture-events/${idx}/status`, body, { schema: OkSchema }),
  downloadLectureEventsCsv: (query: Q) => downloadAdminFile('/admin/lecture-events/export', query, 'lecture_events.csv'),

  // 팝업 G2
  popups: (query: Q, signal?: AbortSignal) => api.get<PopupPage>('/admin/popups', { query, schema: PopupPageSchema, signal }),
  popup: (idx: number, signal?: AbortSignal) => api.get<PopupDetail>(`/admin/popups/${idx}`, { schema: PopupDetailSchema, signal }),
  createPopup: (body: Record<string, unknown>) => api.post<Ok & { idx: number }>('/admin/popups', body, { schema: OkSchema.extend({ idx: z.number() }) }),
  patchPopup: (idx: number, body: Record<string, unknown>) => api.patch<Ok>(`/admin/popups/${idx}`, body, { schema: OkSchema }),
  deletePopup: (idx: number) => api.delete<Ok>(`/admin/popups/${idx}`, { schema: OkSchema }),
  uploadPopupImage: (idx: number, kind: 'pc' | 'mobile', file: File) => api.post<Ok>(`/admin/popups/${idx}/image`, formOf(file), { query: { kind }, schema: OkSchema }),
  popupImageUrl: (idx: number, kind: 'pc' | 'mobile') => fetchAdminBlobUrl(`/admin/popups/${idx}/image`, { kind }),
  addPopupLink: (idx: number, body: { ImgArea: string; LinkURL: string }) => api.post<Ok>(`/admin/popups/${idx}/links`, body, { schema: OkSchema }),
  deletePopupLink: (idx: number, num: number) => api.delete<Ok>(`/admin/popups/${idx}/links/${num}`, { schema: OkSchema }),

  // 백업 목록 G3
  backups: (query: Q, signal?: AbortSignal) => api.get<Page<BackupRow>>('/admin/backups', { query, schema: pageOf(BackupRowSchema), signal }),
  downloadBackupsCsv: (query: Q) => downloadAdminFile('/admin/backups/export', query, 'backups.csv'),

  // 접속통계 G3
  visitStats: (query: Q, signal?: AbortSignal) => api.get<VisitStats>('/admin/visit-stats', { query, schema: VisitStatsSchema, signal }),

  // 정보수정
  myInfo: (signal?: AbortSignal) => api.get<MyInfo>('/admin/my-info', { schema: MyInfoSchema, signal }),
  updateMyInfo: (body: Record<string, unknown>) => api.put<Ok & { passwordChanged?: boolean }>('/admin/my-info', body, { schema: OkSchema }),
};
